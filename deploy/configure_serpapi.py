#!/usr/bin/env python3
"""Recebe a chave pela entrada privada SSH e consulta somente a conta SerpAPI."""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from configure_anthropic import ConfigurationError, write_private_values

ROOT = Path(__file__).resolve().parents[1]


def read_key(stream):
    raw = stream.read(2049)
    if len(raw) > 2048:
        raise ConfigurationError('Entrada muito longa. Nenhum arquivo alterado.')
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ConfigurationError('Entrada inválida. Nenhum arquivo alterado.') from None
    if not isinstance(payload, dict) or set(payload) != {'key'} or not isinstance(payload['key'], str):
        raise ConfigurationError('Informe somente a chave pelo configurador Windows.')
    key = payload['key'].strip()
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,200}', key):
        raise ConfigurationError('Formato de chave inválido. Nenhum arquivo alterado.')
    return key


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_account(key):
    url = 'https://serpapi.com/account.json?' + urllib.parse.urlencode({'api_key': key})
    with urllib.request.build_opener(NoRedirect).open(url, timeout=25) as response:
        raw = response.read(65537)
    if len(raw) > 65536:
        raise ConfigurationError('Resposta de conta inválida. Nenhum arquivo alterado.')
    try:
        account = json.loads(raw)
    except ValueError:
        raise ConfigurationError('Resposta de conta inválida. Nenhum arquivo alterado.') from None
    if not isinstance(account, dict) or account.get('error') or str(account.get('account_status', '')).lower() != 'active':
        raise ConfigurationError('A SerpAPI não confirmou uma conta ativa para esta chave. Nenhum arquivo alterado.')
    remaining = account.get('total_searches_left')
    return remaining if isinstance(remaining, int) and remaining >= 0 else None


def main():
    if os.geteuid() != 0 or sys.stdin.isatty():
        raise ConfigurationError('Use a janela do Windows, com entrada redirecionada pela conexão SSH.')
    env_path = ROOT / '.env'
    original = env_path.read_bytes()
    key = read_key(sys.stdin)
    remaining = check_account(key)
    values = {'SERPAPI_API_KEY': key}
    for name, default in [('SEARCH_MONTHLY_LIMIT', '200'), ('SEARCH_HOURLY_LIMIT', '40')]:
        if not re.search('^' + name + '=', original.decode(), re.M):
            values[name] = default
    backup = write_private_values(env_path, original, values, 'serpapi')
    print('Chave SerpAPI validada e salva na VPS. Nenhuma pesquisa foi executada.')
    if remaining is not None:
        print('Consultas disponíveis informadas pela conta:', remaining)
    print('Backup privado:', backup)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-stdin', action='store_true', required=True)
    parser.parse_args()
    try:
        main()
    except urllib.error.HTTPError as error:
        print('A consulta de conta SerpAPI falhou com HTTP', error.code, '— confira a nova chave. Nenhum arquivo alterado.', file=sys.stderr)
        sys.exit(1)
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Não foi possível concluir a configuração SerpAPI. A chave não será exibida.', file=sys.stderr)
        sys.exit(1)

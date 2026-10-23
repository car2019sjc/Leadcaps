#!/usr/bin/env python3
"""Configura Serper por stdin SSH; valida com uma consulta de autocomplete."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
from configure_anthropic import ConfigurationError, write_private_values

ROOT = Path(__file__).resolve().parents[1]


def read_key(stream):
    raw = stream.read(2049)
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ConfigurationError('Entrada inválida. Nenhum arquivo alterado.') from None
    if len(raw) > 2048 or not isinstance(payload, dict) or set(payload) != {'key'} or not isinstance(payload['key'], str):
        raise ConfigurationError('Informe somente a chave pelo configurador Windows.')
    key = payload['key'].strip()
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,200}', key):
        raise ConfigurationError('Formato de chave inválido. Nenhum arquivo alterado.')
    return key


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_access(key):
    request = urllib.request.Request(
        'https://google.serper.dev/autocomplete',
        data=json.dumps({'q': 'service desk', 'gl': 'br', 'hl': 'pt'}).encode(),
        headers={'Content-Type': 'application/json', 'X-API-KEY': key}, method='POST')
    with urllib.request.build_opener(NoRedirect).open(request, timeout=35) as response:
        raw = response.read(65537)
    try:
        result = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ConfigurationError('Resposta Serper inválida. Nenhum arquivo alterado.') from None
    if len(raw) > 65536 or not isinstance(result, dict) or result.get('error') or result.get('message'):
        raise ConfigurationError('A Serper não confirmou a consulta. Nenhum arquivo alterado.')
    suggestions = result.get('suggestions')
    if not isinstance(suggestions, list) or len(suggestions) > 200 or any(
        not isinstance(item, dict) or not isinstance(item.get('value'), str) or not item['value'].strip() or len(item['value']) > 300
        for item in suggestions
    ):
        raise ConfigurationError('Resposta Serper sem sugestões válidas. Nenhum arquivo alterado.')


def main():
    if os.geteuid() != 0 or sys.stdin.isatty():
        raise ConfigurationError('Use a janela do Windows com entrada redirecionada pela conexão SSH.')
    env_path = ROOT / '.env'
    original = env_path.read_bytes()
    key = read_key(sys.stdin)
    print('Validando com 1 consulta de autocomplete (pode consumir créditos Serper). Sem repetição automática.')
    check_access(key)
    values = {'SERPER_API_KEY': key, 'SEARCH_PROVIDER': 'serper'}
    for name, default in [('SEARCH_MONTHLY_LIMIT', '200'), ('SEARCH_HOURLY_LIMIT', '40')]:
        if not re.search('^' + name + '=', original.decode(), re.M):
            values[name] = default
    backup = write_private_values(env_path, original, values, 'serper')
    print('Chave Serper validada e salva na VPS. Provedor selecionado: Serper.')
    print('A consulta de teste não é uma coleta editorial e não aparece no histórico do aplicativo.')
    print('Backup privado:', backup)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-stdin', action='store_true', required=True)
    parser.parse_args()
    try:
        main()
    except urllib.error.HTTPError as error:
        print('A Serper recusou o teste com HTTP', error.code, '— confira a chave e o saldo em serper.dev. Nenhum arquivo alterado.', file=sys.stderr)
        sys.exit(1)
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Não foi possível confirmar o teste Serper; pode ter ocorrido consumo. A configuração não foi concluída e a chave não será exibida.', file=sys.stderr)
        sys.exit(1)

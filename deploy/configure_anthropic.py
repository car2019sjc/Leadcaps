#!/usr/bin/env python3
"""Configuração local da Anthropic, sem imprimir nem passar a chave por argumentos."""
import argparse
import datetime
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


class ConfigurationError(ValueError):
    """Mensagem local que pode ser mostrada sem expor a credencial."""


def replace_values(source, values):
    lines = source.splitlines(keepends=True)
    for key, value in values.items():
        indexes = [i for i, line in enumerate(lines) if line.startswith(key + '=')]
        if len(indexes) > 1:
            raise ConfigurationError(f'A variável {key} aparece mais de uma vez no .env. Revise localmente.')
        if indexes:
            lines[indexes[0]] = key + '=' + value + '\n'
        else:
            if lines and not lines[-1].endswith('\n'):
                lines[-1] += '\n'
            lines.append(key + '=' + value + '\n')
    return ''.join(lines)


def choose_model(models, input_fn=input, output_fn=print):
    while True:
        choice = input_fn('Modelo (número da lista, nome ou ID; cancelar para sair): ').strip()
        normalized = ' '.join(choice.casefold().split())
        if normalized in ('cancelar', 'sair', 'exit'):
            raise KeyboardInterrupt
        if re.fullmatch(r'[0-9]+', choice):
            index = int(choice) - 1
            if 0 <= index < len(models):
                return models[index]['id']
        matches = [model for model in models if normalized in (
            ' '.join(model['id'].casefold().split()),
            ' '.join(model.get('display_name', model['id']).casefold().split())
        )]
        if normalized and len(matches) == 1:
            return matches[0]['id']
        output_fn('Escolha não reconhecida. Digite o número, o nome ou o ID de um modelo da lista. A chave não precisa ser informada novamente.')


def validate_credentials(key, workspace):
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,500}', key):
        raise ConfigurationError('Formato de chave inválido. Nenhum arquivo alterado.')
    if workspace and not re.fullmatch(r'wrkspc_[A-Za-z0-9_-]{5,150}', workspace):
        raise ConfigurationError('Formato de workspace inválido. Nenhum arquivo alterado.')


def read_private_payload(stream):
    raw = stream.read(4097)
    if len(raw) > 4096:
        raise ConfigurationError('Entrada de configuração muito longa. Nenhum arquivo alterado.')
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, UnicodeError):
        raise ConfigurationError('Entrada de configuração inválida. Nenhum arquivo alterado.') from None
    if (not isinstance(payload, dict) or not {'key', 'model'} <= payload.keys()
            or not payload.keys() <= {'key', 'model', 'workspace'}
            or any(not isinstance(value, str) for value in payload.values())):
        raise ConfigurationError('Campos de configuração inválidos. Nenhum arquivo alterado.')
    key = payload['key'].strip()
    workspace = payload.get('workspace', '').strip()
    model = payload['model'].strip()
    validate_credentials(key, workspace)
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,150}', model):
        raise ConfigurationError('Identificador de modelo inválido. Nenhum arquivo alterado.')
    return key, workspace, model


def available_models(key, workspace):
    headers = {'Authorization': 'Bearer ' + key, 'anthropic-version': '2026-10-21'}
    if workspace:
        headers['anthropic-workspace-id'] = workspace
    models = []
    after = None
    for _ in range(5):
        url = 'https://api.anthropic.com/v1/models?limit=100' + ('&after_id=' + after if after else '')
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as response:
            result = json.load(response)
        for model in result.get('data', []):
            capability = model.get('capabilities', {}).get('structured_outputs')
            if model.get('lifecycle') not in ('retired', 'deprecated') and (capability is None or capability.get('supported')):
                models.append(model)
        if not result.get('has_more'):
            break
        after = result.get('last_id')
        if not after:
            break
    models.sort(key=lambda m: (0 if 'sonnet' in m['id'] else 1, m['id']))
    if not models:
        raise ConfigurationError('Nenhum modelo elegível retornou para esta chave. Nenhum arquivo alterado.')
    return models


def save_configuration(env_path, original, key, workspace, model):
    values = {'ANTHROPIC_API_KEY': key, 'ANTHROPIC_MODEL': model, 'ANTHROPIC_WORKSPACE_ID': workspace}
    if not re.search(r'^CONTENT_DAILY_LIMIT=', original.decode(), re.M):
        values['CONTENT_DAILY_LIMIT'] = '20'
    updated = replace_values(original.decode(), values)
    os.umask(0o077)
    backups = env_path.parent / 'backups'
    backups.mkdir(mode=0o700, exist_ok=True)
    os.chmod(backups, 0o700)
    backup = Path(tempfile.mkdtemp(prefix='anthropic-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-', dir=backups))
    shutil.copy2(env_path, backup / 'env.before')
    if env_path.read_bytes() != original:
        raise ConfigurationError('O .env mudou durante a configuração. Nenhuma substituição foi feita.')
    with env_path.open('wb') as file:
        file.write(updated.encode())
        file.flush()
        os.fsync(file.fileno())
    os.chmod(env_path, 0o600)
    return backup


def main(from_stdin=False):
    if os.geteuid() != 0:
        raise ConfigurationError('Execute o configurador como root na VPS.')
    if from_stdin == sys.stdin.isatty():
        raise ConfigurationError('Use uma sessão SSH interativa ou --from-stdin com entrada redirecionada, sem terminal remoto.')
    env_path = ROOT / '.env'
    original = env_path.read_bytes()
    if from_stdin:
        key, workspace, model = read_private_payload(sys.stdin)
    else:
        key = getpass.getpass('Chave da API Anthropic (entrada oculta): ').strip()
        validate_credentials(key, '')
        workspace = input('ID de workspace, se sua chave exigir (Enter para omitir): ').strip()
        validate_credentials(key, workspace)
    models = available_models(key, workspace)
    if from_stdin:
        if model not in {item['id'] for item in models}:
            raise ConfigurationError('O modelo selecionado não está disponível para esta chave. Nenhum arquivo alterado.')
    else:
        print('Modelos disponíveis para sua conta (consulta sem geração de conteúdo):')
        for index, item in enumerate(models, 1):
            print(f"{index}. {item.get('display_name', item['id'])} — {item['id']}")
        model = choose_model(models)
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,150}', model):
        raise ConfigurationError('Identificador de modelo inválido.')
    backup = save_configuration(env_path, original, key, workspace, model)
    print('Configuração salva na VPS. Modelo:', model)
    print('Backup privado:', backup)
    print('Nenhuma geração foi realizada. Recrie somente a API conforme docs/modulo-conteudo.md.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-stdin', action='store_true', help='Receber JSON privado por stdin, sem alocar terminal remoto.')
    args = parser.parse_args()
    try:
        main(from_stdin=args.from_stdin)
    except urllib.error.HTTPError as error:
        print('A consulta à Anthropic falhou com HTTP', error.code, '— confira chave, workspace e permissões. Nenhum arquivo alterado.', file=sys.stderr)
        sys.exit(1)
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print('Configuração interrompida. Confira a entrada e a conexão. A chave não será exibida.', file=sys.stderr)
        sys.exit(1)

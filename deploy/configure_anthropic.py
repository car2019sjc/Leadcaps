#!/usr/bin/env python3
"""Configuração local da Anthropic, sem imprimir nem passar a chave por argumentos."""
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


def replace_values(source, values):
    lines = source.splitlines(keepends=True)
    for key, value in values.items():
        indexes = [i for i, line in enumerate(lines) if line.startswith(key + '=')]
        if len(indexes) > 1:
            raise ValueError(f'A variável {key} aparece mais de uma vez no .env. Revise localmente.')
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


def main():
    if os.geteuid() != 0 or not sys.stdin.isatty():
        raise ValueError('Execute como root em uma sessão SSH interativa da VPS.')
    env_path = ROOT / '.env'
    original = env_path.read_bytes()
    key = getpass.getpass('Chave da API Anthropic (entrada oculta): ').strip()
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,500}', key):
        raise ValueError('Formato de chave inválido. Nenhum arquivo alterado.')
    workspace = input('ID de workspace, se sua chave exigir (Enter para omitir): ').strip()
    if workspace and not re.fullmatch(r'wrkspc_[A-Za-z0-9_-]{5,150}', workspace):
        raise ValueError('Formato de workspace inválido.')
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
        raise ValueError('Nenhum modelo elegível retornou para esta chave. Nenhum arquivo alterado.')
    print('Modelos disponíveis para sua conta (consulta sem geração de conteúdo):')
    for index, model in enumerate(models, 1):
        print(f"{index}. {model.get('display_name', model['id'])} — {model['id']}")
    model = choose_model(models)
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,150}', model):
        raise ValueError('Identificador de modelo inválido.')
    values = {'ANTHROPIC_API_KEY': key, 'ANTHROPIC_MODEL': model, 'ANTHROPIC_WORKSPACE_ID': workspace}
    if not re.search(r'^CONTENT_DAILY_LIMIT=', original.decode(), re.M):
        values['CONTENT_DAILY_LIMIT'] = '20'
    updated = replace_values(original.decode(), values)
    os.umask(0o077)
    backups = ROOT / 'backups'
    backups.mkdir(mode=0o700, exist_ok=True)
    os.chmod(backups, 0o700)
    backup = Path(tempfile.mkdtemp(prefix='anthropic-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-', dir=backups))
    shutil.copy2(env_path, backup / 'env.before')
    if env_path.read_bytes() != original:
        raise ValueError('O .env mudou durante a configuração. Nenhuma substituição foi feita.')
    with env_path.open('wb') as file:
        file.write(updated.encode())
        file.flush()
        os.fsync(file.fileno())
    os.chmod(env_path, 0o600)
    print('Configuração salva na VPS. Modelo:', model)
    print('Backup privado:', backup)
    print('Nenhuma geração foi realizada. Recrie somente a API conforme docs/modulo-conteudo.md.')


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        print('A consulta à Anthropic falhou com HTTP', error.code, '— confira chave, workspace e permissões. Nenhum arquivo alterado.', file=sys.stderr)
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print('Configuração interrompida. Confira a entrada e a conexão. A chave não será exibida.', file=sys.stderr)
        sys.exit(1)

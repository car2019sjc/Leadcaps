#!/usr/bin/env bash
# Executar dentro da VPS: bash deploy/update-bases.sh
set -euo pipefail
cd /opt/leadcaps
test -f .env
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Há alterações locais no código. Revise antes de atualizar.'; exit 1; }
umask 077
mkdir -p backups
chmod 700 backups
LEADCAPS_UPDATE_BACKUP=$(mktemp -d "$PWD/backups/bases-update-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
trap 'echo "Atualização interrompida. Backup preservado em: $LEADCAPS_UPDATE_BACKUP" >&2' ERR
docker compose --project-name leadcaps exec -T db pg_dump -U leadcaps -d leadcaps -Fc > "$LEADCAPS_UPDATE_BACKUP/database.dump"
test -s "$LEADCAPS_UPDATE_BACKUP/database.dump"
docker compose --project-name leadcaps exec -T db pg_restore --list < "$LEADCAPS_UPDATE_BACKUP/database.dump" > /dev/null
cp -p .env "$LEADCAPS_UPDATE_BACKUP/config.env"
git rev-parse HEAD > "$LEADCAPS_UPDATE_BACKUP/checkout-commit.txt"
LEADCAPS_API_CONTAINER=$(docker compose --project-name leadcaps ps -q api)
docker inspect "$LEADCAPS_API_CONTAINER" --format '{{.Image}}' > "$LEADCAPS_UPDATE_BACKUP/previous-api-image.txt"
sha256sum "$LEADCAPS_UPDATE_BACKUP/database.dump" > "$LEADCAPS_UPDATE_BACKUP/database.dump.sha256"
echo "Backup verificado: $LEADCAPS_UPDATE_BACKUP"
git pull --ff-only
docker compose --project-name leadcaps config --quiet
docker compose --project-name leadcaps build api
docker compose --project-name leadcaps up -d --no-deps --wait --wait-timeout 150 api
docker compose --project-name leadcaps ps
LEADCAPS_CHECK_PORT=$(awk -F= '$1=="API_PORT" {print $2}' .env)
curl --fail --show-error --max-time 20 "http://127.0.0.1:${LEADCAPS_CHECK_PORT:-8310}/health"
echo
echo 'Backend atualizado. Publique o novo dist no Netlify conforme docs/powershell.md.'

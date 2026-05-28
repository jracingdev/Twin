#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/twin}"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

cd "${APP_DIR:-/opt/twin}/infra/docker"

docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u"${DB_USERNAME:-twin}" -p"${DB_PASSWORD}" --all-databases \
  > "$BACKUP_DIR/mysql_$DATE.sql"

docker compose -f docker-compose.prod.yml exec -T minio \
  mc mirror /data "$BACKUP_DIR/minio_$DATE" 2>/dev/null || true

find "$BACKUP_DIR" -name "*.sql" -mtime +14 -delete
echo "Backup concluído: $BACKUP_DIR"

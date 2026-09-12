#!/bin/sh
# Gunluk veritabani yedegi alir, 14 gunden eski yedekleri siler.
# Kurulum icin README > "Yayina alma (VPS + Docker)" > Notlar bolumune bak.
set -eu

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-smartcafe}" "${POSTGRES_DB:-smartcafe}" \
  | gzip > "$BACKUP_DIR/smartcafe-$STAMP.sql.gz"

find "$BACKUP_DIR" -name "smartcafe-*.sql.gz" -mtime "+$KEEP_DAYS" -delete

echo "Yedek alindi: $BACKUP_DIR/smartcafe-$STAMP.sql.gz"

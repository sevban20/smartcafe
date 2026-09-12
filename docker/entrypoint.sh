#!/bin/sh
set -e

echo "Veritabani semasi kontrol ediliyor (prisma db push)..."
# Yikici bir degisiklik varsa burada durur ve loglara yazar; veri kaybini
# otomatik onaylamaz. Gerekirse elle:
#   docker compose exec app npx prisma db push --accept-data-loss
npx prisma db push --skip-generate

exec "$@"

#!/bin/sh
set -e

# Konteyner acilirken zorunlu degiskenleri dogrula — uygulama yarim calismasin
eksik=""
[ -z "$DATABASE_URL" ] && eksik="$eksik DATABASE_URL"
[ -z "$NEXTAUTH_SECRET" ] && eksik="$eksik NEXTAUTH_SECRET"
[ -z "$NEXTAUTH_URL" ] && eksik="$eksik NEXTAUTH_URL"

if [ -n "$eksik" ]; then
  echo "[smartcafe] HATA: su ortam degiskenleri eksik:$eksik"
  echo "[smartcafe] .env dosyanizi kontrol edin. NEXTAUTH_SECRET icin: openssl rand -base64 32"
  exit 1
fi

echo "[smartcafe] Bekleyen veritabani migration'lari uygulaniyor..."
node node_modules/prisma/build/index.js migrate deploy

echo "[smartcafe] Sunucu baslatiliyor (port ${PORT})..."
exec "$@"

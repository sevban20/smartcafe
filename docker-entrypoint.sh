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

# Sema guncellemesi: migration klasoru varsa migration'lari uygula, yoksa
# semayi dogrudan veritabanina yansit (proje `db push` duzeniyle kuruldu).
# `db push` veri kaybina yol acacak bir degisiklikte --accept-data-loss
# olmadan DURUR; boyle bir durumda konteyner acilmaz, sessizce bozulmaz.
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[smartcafe] Bekleyen veritabani migration'lari uygulaniyor..."
  node node_modules/prisma/build/index.js migrate deploy
else
  echo "[smartcafe] Sema veritabanina yansitiliyor (prisma db push)..."
  node node_modules/prisma/build/index.js db push --skip-generate
fi

echo "[smartcafe] Sunucu baslatiliyor (port ${PORT})..."
exec "$@"

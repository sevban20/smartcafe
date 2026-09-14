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

# Sema ile veritabani gercekten ortusuyor mu? (Migration uretmeyi unutmak,
# uygulamanin acilip her istekte P2022/P2021 hatasi vermesine yol aciyordu.)
# Uyari veriyoruz ama sunucuyu baslatiyoruz — karar operatorde kalsin.
if node node_modules/prisma/build/index.js migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma \
     --exit-code >/tmp/sema-fark.txt 2>&1; then
  echo "[smartcafe] Sema ile veritabani uyumlu."
else
  durum=$?
  if [ "$durum" = "2" ]; then
    echo "[smartcafe] ============================================================"
    echo "[smartcafe] UYARI: VERITABANI SEMAYLA UYUSMUYOR."
    echo "[smartcafe] Muhtemelen sema degistirildi ama migration uretilmedi."
    echo "[smartcafe] Yerelde: npm run db:migrate -- --name aciklama  (sonra commit+push)"
    echo "[smartcafe] Eksik olanlar:"
    sed 's/^/[smartcafe]   /' /tmp/sema-fark.txt
    echo "[smartcafe] ============================================================"
  else
    echo "[smartcafe] Bilgi: sema karsilastirmasi yapilamadi (cikis kodu $durum), atlaniyor."
  fi
fi

echo "[smartcafe] Sunucu baslatiliyor (port ${PORT})..."
exec "$@"

#!/bin/sh
set -e

echo "[smartcafe] Bekleyen veritabani migration'lari uygulaniyor..."
node node_modules/prisma/build/index.js migrate deploy

echo "[smartcafe] Sunucu baslatiliyor (port ${PORT})..."
exec "$@"

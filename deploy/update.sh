#!/bin/bash
# Update-Script für laufende Instanz (bei jeder neuen Version aufrufen)
# Ausführen mit: bash /var/www/baubegehungsberichte/deploy/update.sh

set -e

APP_DIR="/var/www/baubegehungsberichte"

echo "=== Update Baubegehungsberichte ==="

cd "$APP_DIR"

echo "--- Git Pull ---"
git pull origin main

echo "--- Dependencies aktualisieren ---"
npm ci

echo "--- Production Build ---"
npm run build

echo "--- PM2 neu starten ---"
pm2 restart baubegehungsberichte

echo "=== Update abgeschlossen! ==="
pm2 status baubegehungsberichte

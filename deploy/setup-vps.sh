#!/bin/bash
# Einmalige VPS-Einrichtung (als root oder sudo-User ausführen)
# Ausführen mit: bash setup-vps.sh

set -e

APP_DIR="/var/www/baubegehungsberichte"
UPLOADS_DIR="/var/uploads"
LOG_DIR="/var/log/pm2"
REPO_URL="https://github.com/Palladi0/Baubegehungsberichte.git"

echo "=== 1. System-Updates ==="
apt update && apt upgrade -y

echo "=== 2. Node.js 20.x installieren ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== 3. PM2 global installieren ==="
npm install -g pm2

echo "=== 4. Nginx installieren ==="
apt install -y nginx

echo "=== 5. Certbot (Let's Encrypt) installieren ==="
apt install -y certbot python3-certbot-nginx

echo "=== 6. Verzeichnisse anlegen ==="
mkdir -p "$APP_DIR"
mkdir -p "$UPLOADS_DIR/photos"
mkdir -p "$UPLOADS_DIR/templates"
mkdir -p "$LOG_DIR"

echo "=== 7. Repository klonen ==="
git clone "$REPO_URL" "$APP_DIR"

echo "=== 8. .env.local anlegen (MANUELL AUSFÜLLEN!) ==="
cp "$APP_DIR/.env.local.example" "$APP_DIR/.env.local"
echo ""
echo ">>> WICHTIG: Jetzt .env.local bearbeiten:"
echo ">>> nano $APP_DIR/.env.local"
echo ""

echo "=== 9. Abhängigkeiten installieren und Build ==="
cd "$APP_DIR"
npm ci
npm run build

echo "=== 10. PM2 starten und beim Boot aktivieren ==="
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save
pm2 startup | tail -1 | bash

echo "=== 11. Nginx konfigurieren ==="
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/baubegehungsberichte
ln -sf /etc/nginx/sites-available/baubegehungsberichte /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup abgeschlossen! ==="
echo ""
echo "Nächste Schritte:"
echo "1. Domain in /etc/nginx/sites-available/baubegehungsberichte eintragen"
echo "2. DNS-Eintrag für deine Domain auf diese VPS-IP zeigen lassen"
echo "3. SSL-Zertifikat: sudo certbot --nginx -d berichte.ppb-net.de"
echo "4. .env.local ausfüllen: nano $APP_DIR/.env.local"
echo "5. App neu starten: pm2 restart baubegehungsberichte"

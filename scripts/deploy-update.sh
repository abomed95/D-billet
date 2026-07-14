#!/usr/bin/env bash
# Mise a jour de l'application D-Billet sur un Droplet deja deploye.
# A executer en root depuis /var/www/dbillet:
#   sudo bash scripts/deploy-update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dbillet}"
cd "$APP_DIR"

echo "==> git pull"
git pull --ff-only

echo "==> pip install"
"$APP_DIR/.venv/bin/pip" install -q -r backend/requirements.txt

echo "==> frontend build"
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund --legacy-peer-deps
NODE_OPTIONS="--max-old-space-size=2048" npm run build
cd - >/dev/null

echo "==> restart backend"
systemctl restart dbillet-api
sleep 2
systemctl is-active --quiet dbillet-api && echo "  backend OK" || {
    journalctl -u dbillet-api -n 30 --no-pager
    exit 1
}

echo "==> reload nginx"
nginx -t
systemctl reload nginx

echo "==> health check"
curl -fsS http://127.0.0.1:8001/health && echo "  OK"

echo "Mise a jour terminee."

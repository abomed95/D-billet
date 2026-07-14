#!/usr/bin/env bash
# =============================================================================
# D-Billet - Script de deploiement automatise sur un Droplet Ubuntu 22.04/24.04
# =============================================================================
# A lancer EN SSH SUR LE DROPLET, avec un utilisateur sudo.
#
# Pre-requis cote DigitalOcean / DNS:
#   - Droplet Ubuntu 22.04 ou 24.04 LTS cree, ports 22/80/443 ouverts
#   - Cluster MongoDB managed cree, chaine de connexion en main
#   - Enregistrements DNS A pour d-billet.com et www.d-billet.com pointent
#     sur l'IP publique du Droplet (propage avant de lancer certbot)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/<user>/D-billet/main/scripts/deploy-digitalocean.sh -o deploy.sh
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Le script vous demandera de manière interactive :
#   - URL du repo Git
#   - URL MongoDB
#   - Domaine
#   - Email pour Let's Encrypt
#   - Credentials Google OAuth (facultatifs)
# =============================================================================
set -euo pipefail

# ---------- Configuration par defaut (override-able via env) ----------
APP_DIR="${APP_DIR:-/var/www/dbillet}"
APP_USER="${APP_USER:-www-data}"
APP_GROUP="${APP_GROUP:-www-data}"
NODE_MAJOR="${NODE_MAJOR:-20}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log()   { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}!! ${NC} $*"; }
fatal() { echo -e "${RED}xx ${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || fatal "Lance ce script avec sudo."

# ---------- 1. Inputs interactifs ----------
log "Configuration du deploiement"
read -rp "URL du repo Git (https://github.com/...): " REPO_URL
[[ -z "$REPO_URL" ]] && fatal "URL du repo requise."

read -rp "Domaine principal (ex: d-billet.com): " DOMAIN
[[ -z "$DOMAIN" ]] && fatal "Domaine requis."

read -rp "Inclure www.${DOMAIN} dans le certificat ? [O/n] " WWW_INCLUDE
WWW_INCLUDE=${WWW_INCLUDE:-O}

read -rp "Chaine de connexion MongoDB (mongodb+srv://... ou mongodb://...): " MONGO_URL
[[ -z "$MONGO_URL" ]] && fatal "URL MongoDB requise."

read -rp "Nom de la base MongoDB [dbillet]: " DB_NAME
DB_NAME=${DB_NAME:-dbillet}

read -rp "Email pour Let's Encrypt (notifications certificat): " LE_EMAIL
[[ -z "$LE_EMAIL" ]] && fatal "Email requis pour Let's Encrypt."

read -rp "GOOGLE_CLIENT_ID (laisser vide pour desactiver Google login): " GOOGLE_CLIENT_ID
read -rp "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

log "Generation du JWT_SECRET..."
JWT_SECRET=$(openssl rand -hex 64)
log "JWT_SECRET genere ($(echo -n "$JWT_SECRET" | wc -c) caracteres)."

# ---------- 2. Installation des paquets systeme ----------
log "Mise a jour des paquets et installation des dependances systeme"
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt install -y -qq \
    python3 python3-venv python3-pip python3-dev \
    build-essential libffi-dev \
    nginx certbot python3-certbot-nginx \
    git curl ufw fail2ban

# Node.js LTS
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_MAJOR" ]]; then
    log "Installation de Node.js ${NODE_MAJOR}.x"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt install -y -qq nodejs
fi
node -v
npm -v

# ---------- 3. Pare-feu ----------
log "Configuration du pare-feu UFW"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status

# ---------- 4. Clone / pull du repo ----------
log "Recuperation du code dans $APP_DIR"
mkdir -p "$APP_DIR"
chown "$(logname 2>/dev/null || echo root)":"$(logname 2>/dev/null || echo root)" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
    log "Repo deja present, git pull"
    git -C "$APP_DIR" pull --ff-only
else
    git clone "$REPO_URL" "$APP_DIR"
fi

# ---------- 5. Backend Python ----------
log "Creation du virtualenv backend"
"$PYTHON_BIN" -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip wheel
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

log "Creation du dossier uploads persistant"
mkdir -p "$APP_DIR/shared/uploads"

log "Generation de backend/.env"
cat > "$APP_DIR/backend/.env" <<ENV
APP_ENV=production

APP_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
BACKEND_CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

MONGO_URL=${MONGO_URL}
DB_NAME=${DB_NAME}
MONGO_SERVER_SELECTION_TIMEOUT_MS=5000

JWT_SECRET=${JWT_SECRET}

GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

UPLOAD_DIR=${APP_DIR}/shared/uploads

AUTO_SEED_DEMO_DATA=false
ALLOW_PUBLIC_SEED_ROUTE=false
ENV

chmod 600 "$APP_DIR/backend/.env"

# ---------- 6. Frontend ----------
log "Generation de frontend/.env.production"
cat > "$APP_DIR/frontend/.env.production" <<ENV
REACT_APP_BACKEND_URL=https://${DOMAIN}
REACT_APP_SITE_URL=https://${DOMAIN}
ENABLE_HEALTH_CHECK=false
ENABLE_VISUAL_EDITS=false
VISUAL_EDIT_ALLOWED_ORIGINS=
GENERATE_SOURCEMAP=false
ENV

log "Build frontend (peut prendre quelques minutes)"
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=2048" npm run build
cd - >/dev/null

# ---------- 7. Permissions ----------
log "Application des permissions ${APP_USER}:${APP_GROUP}"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR/shared/uploads"
chown "$APP_USER:$APP_GROUP" "$APP_DIR/backend/.env"

# ---------- 8. Service systemd ----------
log "Installation du service systemd dbillet-api"
cp "$APP_DIR/deploy/digitalocean/dbillet-api.service" /etc/systemd/system/dbillet-api.service
systemctl daemon-reload
systemctl enable dbillet-api
systemctl restart dbillet-api
sleep 3
systemctl is-active --quiet dbillet-api || {
    warn "Le service dbillet-api ne tourne pas. Logs:"
    journalctl -u dbillet-api -n 40 --no-pager
    fatal "Demarrage du backend echoue. Corrige les erreurs puis relance le script."
}
log "Backend en marche sur 127.0.0.1:8001"

# Health check local
if ! curl -fsS http://127.0.0.1:8001/health >/dev/null; then
    warn "/health ne repond pas. Verifie journalctl -u dbillet-api"
else
    log "Health check OK"
fi

# ---------- 9. Nginx ----------
log "Installation des zones de rate-limiting Nginx"
cp "$APP_DIR/deploy/digitalocean/dbillet-limits.conf" /etc/nginx/conf.d/dbillet-limits.conf

log "Installation du site Nginx (HTTP only avant certbot)"
# Genere un site initial qui sera modifie par certbot
sed "s/d-billet\.com/${DOMAIN}/g" "$APP_DIR/deploy/digitalocean/nginx.conf" > /etc/nginx/sites-available/dbillet

# Pour le 1er passage avant TLS, on commente le block 443 et on garde uniquement le 80
# Certbot va remplacer le block 80 par une redirection et activer le 443.
# On laisse le block 443 commente le temps que certbot fasse son travail.
python3 - <<'PYEOF'
import re
p = "/etc/nginx/sites-available/dbillet"
with open(p) as f:
    txt = f.read()
# Trouve le bloc HTTPS et le commente entierement
m = re.search(r"# =+ HTTPS site.*?\nserver \{.*?\n\}\n", txt, re.DOTALL)
if m:
    block = m.group(0)
    commented = "\n".join(("# " + line) if line.strip() else line for line in block.splitlines()) + "\n"
    txt = txt.replace(block, commented)
# Remplace le block HTTP par un block minimal pour servir l'ACME et le site provisoirement
http_min = """server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ www.__DOMAIN__;
    root __ROOT__;
    index index.html;
    client_max_body_size 10M;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /health { proxy_pass http://127.0.0.1:8001/health; }
    location /uploads/ { alias __UPLOADS__; }
    location / { try_files $uri $uri/ /index.html; }
}
"""
txt = re.sub(r"# =+ HTTP -> HTTPS redirect.*?^}\s*", http_min, txt, count=1, flags=re.DOTALL|re.MULTILINE)
with open(p, "w") as f:
    f.write(txt)
PYEOF

sed -i "s|__DOMAIN__|${DOMAIN}|g; s|__ROOT__|${APP_DIR}/frontend/build|g; s|__UPLOADS__|${APP_DIR}/shared/uploads/|g" /etc/nginx/sites-available/dbillet

ln -sf /etc/nginx/sites-available/dbillet /etc/nginx/sites-enabled/dbillet
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/html
nginx -t
systemctl reload nginx
log "Nginx en HTTP est en ligne. Test : curl -I http://${DOMAIN}"

# ---------- 10. Let's Encrypt ----------
CERT_DOMAINS=("-d" "$DOMAIN")
if [[ "$WWW_INCLUDE" =~ ^[OoYy]$ ]]; then
    CERT_DOMAINS+=("-d" "www.$DOMAIN")
fi

log "Obtention du certificat Let's Encrypt"
certbot --nginx --non-interactive --agree-tos -m "$LE_EMAIL" "${CERT_DOMAINS[@]}" --redirect

log "Remplacement du site Nginx par la version durcie (avec CSP, HSTS, rate-limit)"
# Maintenant que le cert est en place, on bascule sur la vraie config
sed "s/d-billet\.com/${DOMAIN}/g" "$APP_DIR/deploy/digitalocean/nginx.conf" > /etc/nginx/sites-available/dbillet

# Reinjecte les bons chemins SSL trouves par certbot
SSL_LIVE=$(ls -d /etc/letsencrypt/live/${DOMAIN}* 2>/dev/null | head -n1)
if [[ -z "$SSL_LIVE" ]]; then
    fatal "Repertoire /etc/letsencrypt/live/${DOMAIN} introuvable."
fi
# decommente les directives ssl_certificate
sed -i "s|# ssl_certificate     /etc/letsencrypt/live/d-billet.com/fullchain.pem;|ssl_certificate ${SSL_LIVE}/fullchain.pem;|" /etc/nginx/sites-available/dbillet
sed -i "s|# ssl_certificate_key /etc/letsencrypt/live/d-billet.com/privkey.pem;|ssl_certificate_key ${SSL_LIVE}/privkey.pem;|" /etc/nginx/sites-available/dbillet
sed -i "s|# include /etc/letsencrypt/options-ssl-nginx.conf;|include /etc/letsencrypt/options-ssl-nginx.conf;|" /etc/nginx/sites-available/dbillet
sed -i "s|# ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|" /etc/nginx/sites-available/dbillet
# Ajuste root et uploads alias
sed -i "s|/var/www/dbillet/frontend/build|${APP_DIR}/frontend/build|g; s|/var/www/dbillet/shared/uploads/|${APP_DIR}/shared/uploads/|g" /etc/nginx/sites-available/dbillet

nginx -t
systemctl reload nginx

# ---------- 11. Renouvellement Certbot ----------
log "Verification du renouvellement automatique du certificat"
systemctl enable --now certbot.timer
certbot renew --dry-run >/dev/null 2>&1 && log "Renouvellement auto OK" || warn "Verifie certbot.timer manuellement"

# ---------- 12. Fail2ban basique ----------
log "Configuration de fail2ban (sshd)"
systemctl enable --now fail2ban

# ---------- 13. Verifications finales ----------
log "Tests finaux"
sleep 2
set +e
echo ""
echo "  curl -I https://${DOMAIN}/"
curl -sI "https://${DOMAIN}/" | head -1
echo "  curl -fsS https://${DOMAIN}/health"
curl -fsS "https://${DOMAIN}/health" || warn "/health a echoue"
echo ""
set -e

cat <<EOM

================================================================
   ${GREEN}Deploiement termine${NC}
================================================================
   Site         : https://${DOMAIN}
   Health       : https://${DOMAIN}/health
   Backend logs : journalctl -u dbillet-api -f
   Nginx logs   : tail -f /var/log/nginx/{access,error}.log
   App dir      : ${APP_DIR}
   Uploads      : ${APP_DIR}/shared/uploads

   JWT_SECRET genere et stocke dans ${APP_DIR}/backend/.env

   Pour mettre a jour le code plus tard:
     cd ${APP_DIR} && sudo -u root bash scripts/deploy-update.sh
================================================================
EOM

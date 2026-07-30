# Deploiement DigitalOcean - D-Billet

Ce projet est pret pour DigitalOcean sans `emergent.sh`.

## Architecture recommandee

- **1 Droplet Ubuntu 24.04 LTS** pour servir le frontend React build + Nginx + API FastAPI
- **1 cluster MongoDB manage DigitalOcean** dans la meme region
- **1 seul domaine public** pour le frontend et l'API: `d-billet.com`

Routing:

- Site public: `https://d-billet.com`
- API proxifiee par Nginx: `https://d-billet.com/api/...`
- Uploads servis par Nginx: `https://d-billet.com/uploads/...`

Le projet stocke encore les images uploadees sur disque via `UPLOAD_DIR`. Sur App Platform, ce stockage serait ephemere - tant que les uploads ne sont pas migres vers un stockage objet (DO Spaces / S3), un Droplet est plus adapte.

## Fichiers prepares dans le repo

- Backend env: `backend/env.production.example`
- Frontend env: `frontend/env.production.example`
- Service systemd: `deploy/digitalocean/dbillet-api.service`
- Nginx site: `deploy/digitalocean/nginx.conf`
- Nginx rate-limit zones: `deploy/digitalocean/dbillet-limits.conf`

## 1. Creer l'infra DigitalOcean

1. Cree un **Droplet Ubuntu 24.04 LTS** (minimum 2 GB RAM recommandes).
2. Cree un **cluster MongoDB manage** dans la meme region.
3. Recupere la chaine de connexion MongoDB depuis le panneau DigitalOcean (avec `tls=true`).
4. Pointe `d-billet.com` (A) et `www.d-billet.com` (CNAME) vers l'IP du Droplet.

## 2. Installer les paquets sur le Droplet

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx git curl
# Node.js 20 LTS (necessaire pour le build du frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Recuperer le projet

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <URL_DU_REPO> dbillet
cd /var/www/dbillet
```

## 4. Preparer le backend

```bash
python3 -m venv /var/www/dbillet/.venv
/var/www/dbillet/.venv/bin/pip install --upgrade pip
/var/www/dbillet/.venv/bin/pip install -r /var/www/dbillet/backend/requirements.txt

mkdir -p /var/www/dbillet/shared/uploads
cp /var/www/dbillet/backend/env.production.example /var/www/dbillet/backend/.env
```

Edite `/var/www/dbillet/backend/.env` et remplace:

- `MONGO_URL`: chaine MongoDB DO (avec `?tls=true&authSource=admin&replicaSet=...`)
- `JWT_SECRET`: **OBLIGATOIRE**. Generer avec:
  ```bash
  openssl rand -hex 64
  ```
  L'app refusera de demarrer en production sans cette variable.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: laisser vide si tu n'utilises pas Google Login

Verifie que ces deux lignes restent a `false`:

```
AUTO_SEED_DEMO_DATA=false
ALLOW_PUBLIC_SEED_ROUTE=false
```

Permissions:

```bash
sudo chown -R www-data:www-data /var/www/dbillet/shared/uploads
sudo chmod 600 /var/www/dbillet/backend/.env
sudo chown www-data:www-data /var/www/dbillet/backend/.env
```

## 5. Preparer le frontend

```bash
cp /var/www/dbillet/frontend/env.production.example /var/www/dbillet/frontend/.env.production
```

Verifie:

- `REACT_APP_BACKEND_URL=https://d-billet.com` (sans `/api`)
- `REACT_APP_SITE_URL=https://d-billet.com`
- `GENERATE_SOURCEMAP=false`

Puis build:

```bash
cd /var/www/dbillet/frontend
npm ci
npm run build
```

Le build strip automatiquement `console.log/.debug/.info/.trace` et les `debugger` (configure dans `craco.config.js`).

## 6. Installer le service backend

```bash
sudo cp /var/www/dbillet/deploy/digitalocean/dbillet-api.service /etc/systemd/system/dbillet-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now dbillet-api
sudo systemctl status dbillet-api
```

Logs:

```bash
sudo journalctl -u dbillet-api -f
```

## 7. Installer Nginx (avec rate-limiting)

```bash
# Zones de rate-limiting au niveau http{}
sudo cp /var/www/dbillet/deploy/digitalocean/dbillet-limits.conf /etc/nginx/conf.d/dbillet-limits.conf

# Site
sudo cp /var/www/dbillet/deploy/digitalocean/nginx.conf /etc/nginx/sites-available/dbillet
sudo ln -sf /etc/nginx/sites-available/dbillet /etc/nginx/sites-enabled/dbillet
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Activer HTTPS

```bash
sudo certbot --nginx -d d-billet.com -d www.d-billet.com
```

Certbot va injecter les certificats dans le block `server { listen 443 ssl }` et ajouter une redirection 80 -> 443. Verifie ensuite:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Renouvellement auto:

```bash
sudo systemctl status certbot.timer
```

## 9. Configurer Google OAuth (optionnel)

Dans Google Cloud Console:

- **Authorized JavaScript origins**: `https://d-billet.com`
- **Authorized redirect URIs**: `https://d-billet.com/api/auth/google/callback`

Sans `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, le bouton Google reste desactive.

## 10. Verification finale

```bash
# Backend en local sur le Droplet
curl -i http://127.0.0.1:8001/health

# Site public
curl -I https://d-billet.com
curl -I https://d-billet.com/health
curl -I https://d-billet.com/api
```

Headers de securite attendus sur HTTPS:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ...`

## 11. Smoke-tests fonctionnels

- Page d'accueil charge sans erreur console
- `/auth` permet de se connecter avec le compte admin (cree manuellement via Mongo Compass ou via une commande de seed locale, **pas** via la route publique)
- Achat d'un billet test en mode simulation paiement
- Recu PDF generable

## 12. Surveillance

```bash
# Backend
sudo journalctl -u dbillet-api --since "1 hour ago"

# Nginx
sudo tail -f /var/log/nginx/error.log /var/log/nginx/access.log

# Rate limits 429
sudo grep "limiting requests" /var/log/nginx/error.log
```

## 13. Mises a jour

```bash
cd /var/www/dbillet
git pull
/var/www/dbillet/.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && npm run build && cd ..
sudo systemctl restart dbillet-api
sudo systemctl reload nginx
```

## Notes importantes

- **Paiement WaafiPay (reel)**: l'option **Waafi** est integree a l'API WaafiPay
  (Hosted Payment Page). Elle s'active des que `WAAFIPAY_MERCHANT_UID`,
  `WAAFIPAY_STORE_ID` et `WAAFIPAY_HPP_KEY` sont definies dans `backend/.env`
  (cf. `backend/env.production.example`), puis `systemctl restart dbillet-api`.
  Sans ces variables, le paiement reste simule. D-Money et CAC Bank restent
  simules.
- **Documentation OpenAPI**: `/api/docs` et `/api/redoc` sont **desactives en production** (`APP_ENV=production` masque ces routes).
- **Backups**: configure les backups MongoDB depuis le panneau DigitalOcean. Snapshots Droplet hebdomadaires recommandes.
- **App Platform plus tard**: necessitera la migration des uploads vers DO Spaces et un build CI/CD.

## Docs DigitalOcean utiles

- Managed MongoDB connection: https://docs.digitalocean.com/products/databases/mongodb/how-to/connect/
- Droplet backups: https://docs.digitalocean.com/products/droplets/how-to/enable-backups/
- App Platform app spec: https://docs.digitalocean.com/products/app-platform/reference/app-spec/

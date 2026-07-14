# Deploiement D-Billet sur DigitalOcean

Guide condense pour le 1er deploiement. Le script `scripts/deploy-digitalocean.sh` automatise la partie serveur.

---

## Phase 1 - Avant tout : pousser le code sur GitHub

Sur ta machine, dans le dossier du projet:

```bash
bash scripts/cleanup-before-deploy.sh   # retire les .tmp-* du suivi git
git add -A
git commit -m "chore(deploy): harden config and add deploy scripts"
git push origin main
```

> Le Droplet va `git clone` depuis GitHub. Si le repo est prive, il faudra
> soit le rendre public, soit ajouter une cle SSH de deploiement.

---

## Phase 2 - DigitalOcean

### 2.1 Creer le Droplet

1. Connecte-toi a https://cloud.digitalocean.com
2. Create > Droplets
3. Choix recommandes :
   - **Image** : Ubuntu 24.04 LTS x64
   - **Region** : Frankfurt ou Amsterdam (latence correcte vers Djibouti)
   - **Size** : Basic > Regular > **$12/mois (2 GB RAM, 1 vCPU, 50 GB SSD)**
     (minimum 2 GB RAM pour le build React)
   - **Authentication** : SSH Key (ajoute ta cle publique)
   - **Hostname** : `dbillet-prod`
4. Create Droplet. Note l'**IP publique** (ex: `134.122.xx.xx`)

### 2.2 Creer le cluster MongoDB managed

1. Create > Databases
2. Choix :
   - **Engine** : MongoDB 7
   - **Region** : **meme region que le Droplet**
   - **Plan** : Basic > $15/mois (1 GB RAM)
   - **Cluster name** : `dbillet-db`
3. Une fois cree, va dans l'onglet **Connection Details** et clique
   **Connection string**. Copie l'URL complete, elle ressemble a :
   ```
   mongodb+srv://doadmin:XXXXXX@dbillet-db-xxxx.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=...
   ```
4. Dans **Trusted Sources**, autorise l'IP de ton Droplet.

### 2.3 Configurer le DNS

Chez ton registrar (Gandi/OVH/Namecheap...), ajoute deux enregistrements:

| Type | Nom  | Valeur                    | TTL  |
|------|------|---------------------------|------|
| A    | @    | <IP_DU_DROPLET>           | 300  |
| A    | www  | <IP_DU_DROPLET>           | 300  |

Verifie la propagation:

```bash
dig +short d-billet.com
dig +short www.d-billet.com
```

> Important: **attends que le DNS propage** (1-30 minutes) avant la phase 3,
> sinon certbot ne pourra pas valider le domaine.

---

## Phase 3 - Lancer le script

Connecte-toi en SSH au Droplet:

```bash
ssh root@<IP_DU_DROPLET>
```

Puis :

```bash
# Recupere le script depuis GitHub
curl -fsSL https://raw.githubusercontent.com/<TON_USER>/D-billet/main/scripts/deploy-digitalocean.sh -o deploy.sh
chmod +x deploy.sh

# Lance-le
sudo ./deploy.sh
```

Le script va te demander :

- URL du repo (`https://github.com/<TON_USER>/D-billet.git`)
- Domaine (`d-billet.com`)
- URL MongoDB (colle la chaine de connexion DO)
- Email pour Let's Encrypt
- GOOGLE_CLIENT_ID/SECRET (laisse vide si tu n'utilises pas Google login)

Puis il va :

1. Installer Python, Node.js 20, Nginx, certbot, fail2ban
2. Configurer le pare-feu UFW (22, 80, 443)
3. Cloner ton repo dans `/var/www/dbillet`
4. Creer le venv Python et installer les dependances
5. Generer un `JWT_SECRET` aleatoire et le `.env`
6. Builder le frontend React
7. Demarrer le service systemd `dbillet-api`
8. Configurer Nginx (rate-limiting inclus)
9. Obtenir un certificat Let's Encrypt
10. Activer HTTPS + HSTS + CSP
11. Activer le renouvellement auto du certificat

Duree totale : **5 a 10 minutes**.

---

## Phase 4 - Verification

```bash
curl -I https://d-billet.com
curl -fsS https://d-billet.com/health
```

Headers attendus :

```
HTTP/2 200
strict-transport-security: max-age=31536000; includeSubDomains
x-frame-options: DENY
x-content-type-options: nosniff
content-security-policy: default-src 'self'; ...
```

Ouvre dans un navigateur:

- https://d-billet.com (accueil)
- https://d-billet.com/ferry (page ferry)
- https://d-billet.com/auth (page connexion)

---

## Phase 5 - Creer le 1er compte admin

En production, le seed est **desactive** : aucun compte n'existe.

Option 1 (recommandee) - en SSH sur le Droplet :

```bash
sudo -u www-data /var/www/dbillet/.venv/bin/python -c "
import asyncio, sys, uuid
sys.path.insert(0, '/var/www/dbillet/backend')
from config import db
from services.auth import hash_password
from datetime import datetime, timezone

async def main():
    email = 'admin@d-billet.com'
    pwd   = 'CHANGE_THIS_PASSWORD'  # change le avant !
    existing = await db.users.find_one({'email': email})
    if existing:
        print('Existe deja')
        return
    await db.users.insert_one({
        'id': str(uuid.uuid4()),
        'email': email,
        'phone': '+25377000000',
        'full_name': 'Administrateur',
        'hashed_password': hash_password(pwd),
        'role': 'admin',
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    print('Admin cree')

asyncio.run(main())
"
```

Option 2 - via Mongo Compass connecte au cluster DO.

---

## Mises a jour ulterieures

Apres chaque `git push origin main`, sur le Droplet :

```bash
sudo bash /var/www/dbillet/scripts/deploy-update.sh
```

Ce script fait : git pull, pip install, npm build, restart backend, reload nginx.

---

## Depannage

| Symptome | Action |
|----------|--------|
| Service backend ne demarre pas | `sudo journalctl -u dbillet-api -n 50` |
| 502 Bad Gateway | Backend down: `sudo systemctl status dbillet-api` |
| Certbot echoue | DNS pas encore propage ou ports 80/443 fermes |
| `/api/auth/*` renvoie 429 | Rate-limiting Nginx, normal sous attaque |
| MongoDB connexion refusee | IP du Droplet pas dans Trusted Sources DO |
| Frontend blanc | Verifier `frontend/build/index.html` existe, recompiler si besoin |

Logs :

```bash
sudo journalctl -u dbillet-api -f                       # backend
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## Notes importantes

- **Paiements simules** : Waafi, D-Money, CAC Bank en mode demo. Aucune
  vraie transaction. Les integrations PSP reelles necessiteront du dev en plus.
- **Backups** : active les backups automatiques du Droplet (1$/mois) et
  configure des snapshots MongoDB depuis le panneau DO.
- **Documentation API** : `/api/docs` est **desactive en production** par
  securite. Si tu as besoin de tester l'API, lance le backend en mode dev local.

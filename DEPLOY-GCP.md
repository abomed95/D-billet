# Deploiement D-Billet sur Google Cloud (Cloud Run)

Guide complet pour deployer D-Billet sur Cloud Run. Le script
`deploy/gcp/deploy-cloudrun.sh` automatise la totalite de la partie Google Cloud.

> Ce guide remplace `DEPLOY.md` (DigitalOcean) si tu passes sur GCP. Les deux
> restent valides, le code fonctionne sur les deux cibles sans modification.

---

## Ce qui change par rapport au Droplet

| | DigitalOcean (Droplet) | Google Cloud (Cloud Run) |
|---|---|---|
| Frontend | servi par Nginx | servi par FastAPI (`backend/spa.py`) |
| API | uvicorn derriere Nginx | uvicorn expose directement |
| HTTPS | certbot / Let's Encrypt | gere par Google, renouvellement automatique |
| Uploads | disque du Droplet | bucket Cloud Storage monte sur `/mnt/uploads` |
| Secrets | `backend/.env` | Secret Manager |
| Rate-limiting | Nginx `limit_req` + limiteur applicatif | limiteur applicatif (+ Cloud Armor en option) |
| Mise a l'echelle | taille du Droplet | automatique, 0 a N instances |
| Serveur a maintenir | oui (patchs, ufw, fail2ban) | non |

Points a connaitre avant de commencer :

- **Le systeme de fichiers du conteneur est ephemere.** Tout ce qui est ecrit
  hors de `/mnt/uploads` disparait quand l'instance est recyclee. Le bucket
  Cloud Storage est donc obligatoire, pas optionnel.
- **`REACT_APP_BACKEND_URL` est fige au build.** Changer de domaine impose un
  rebuild, pas seulement un redeploiement.
- **Le rate-limiting applicatif compte par processus.** Avec plusieurs
  instances, la limite effective est multipliee par le nombre d'instances.
  Voir la section Cloud Armor plus bas.

---

## Phase 0 - Prerequis

```bash
# Installer gcloud : https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud projects create dbillet-prod --name="D-Billet"   # ou un projet existant
gcloud config set project dbillet-prod
```

Attache un compte de facturation au projet (obligatoire pour Cloud Run) :
https://console.cloud.google.com/billing

Choix de la region :

| Region | Localisation | Commentaire |
|--------|--------------|-------------|
| `europe-west1` | Belgique | defaut du script, bien desservie |
| `europe-west3` | Francfort | equivalent au choix DigitalOcean actuel |
| `me-central1` | Doha | **latence la plus faible vers Djibouti** |

`me-central1` est le meilleur choix en latence, mais verifie d'abord que ton
hebergeur MongoDB propose la meme region (voir phase 1) : une base dans une
autre region ajoute bien plus de latence que le trajet client-serveur.

---

## Phase 1 - MongoDB

Google Cloud ne propose pas de MongoDB manage. Deux options.

### Option A - MongoDB Atlas sur GCP (recommandee)

1. Cree un compte sur https://cloud.mongodb.com
2. Create Cluster > **Provider: Google Cloud** > meme region que Cloud Run
3. Plan : `M0` (gratuit) pour tester, `M10` minimum en production
   (backups automatiques, replication, pas de mise en veille)
4. Database Access > cree un utilisateur avec un mot de passe long
5. Network Access > voir **Acces reseau** ci-dessous
6. Connect > Drivers > copie la chaine `mongodb+srv://...`

### Option B - MongoDB sur une VM Compute Engine

Moins cher, mais backups, mises a jour et securite reseau sont a ta charge.
La VM et Cloud Run doivent etre sur le meme VPC, et Cloud Run doit utiliser
la sortie VPC (voir ci-dessous). La chaine est alors
`mongodb://user:pass@10.x.x.x:27017/?authSource=admin`.

### Acces reseau : le point important

Par defaut, **Cloud Run sort sur Internet avec des IP partagees et
changeantes**. Il n'y a donc pas d'IP a autoriser dans Atlas. Trois facons de
regler ca, de la meilleure a la moins bonne :

**1. Sortie VPC + Cloud NAT avec IP fixe (recommande)**

```bash
REGION=europe-west1

gcloud compute networks create dbillet-vpc --subnet-mode=custom
gcloud compute networks subnets create dbillet-subnet \
    --network=dbillet-vpc --region=$REGION --range=10.8.0.0/24

gcloud compute addresses create dbillet-nat-ip --region=$REGION
gcloud compute routers create dbillet-router \
    --network=dbillet-vpc --region=$REGION
gcloud compute routers nats create dbillet-nat \
    --router=dbillet-router --region=$REGION \
    --nat-custom-subnet-ip-ranges=dbillet-subnet \
    --nat-external-ip-pool=dbillet-nat-ip

# Tout le trafic sortant passe par le VPC, donc par l'IP fixe
gcloud run services update dbillet --region=$REGION \
    --network=dbillet-vpc --subnet=dbillet-subnet --vpc-egress=all-traffic

# IP a autoriser dans Atlas > Network Access
gcloud compute addresses describe dbillet-nat-ip --region=$REGION \
    --format='value(address)'
```

**2. Private Endpoint Atlas (PrivateLink)** — la base n'est jamais exposee sur
Internet. Reserve aux clusters dedies (M10+). Voir la doc Atlas.

**3. Autoriser `0.0.0.0/0` dans Atlas** — a n'utiliser que pour un test de
courte duree. La base reste protegee par TLS et par le mot de passe, mais
elle est joignable depuis n'importe ou.

---

## Phase 2 - Lancer le script

Depuis la racine du depot, sur ta machine :

```bash
./deploy/gcp/deploy-cloudrun.sh
```

Ou avec des valeurs explicites :

```bash
PROJECT_ID=dbillet-prod \
REGION=europe-west1 \
DOMAIN=d-billet.com \
MIN_INSTANCES=1 \
./deploy/gcp/deploy-cloudrun.sh
```

Le script demande la chaine de connexion MongoDB, puis, en option, les cles
Google OAuth et WaafiPay (laisse vide pour garder le paiement simule).

Il execute ensuite :

1. Activation des APIs (Run, Build, Artifact Registry, Secret Manager, Storage)
2. Creation du depot Artifact Registry
3. Creation du bucket d'uploads (acces public bloque)
4. Creation du compte de service d'execution et de ses droits
5. Creation des secrets (le `JWT_SECRET` est genere aleatoirement)
6. Build de l'image via Cloud Build (frontend React + backend Python)
7. Deploiement du service Cloud Run, bucket monte sur `/mnt/uploads`
8. Creation du job Cloud Run de creation d'administrateur

Duree : **8 a 15 minutes** au premier passage, 3 a 5 minutes ensuite.

Le script est **idempotent** : le relancer ne recree rien, il rebuild et
deploie une nouvelle revision.

### Variables reconnues par le script

| Variable | Defaut | Role |
|----------|--------|------|
| `PROJECT_ID` | projet gcloud courant | projet GCP |
| `REGION` | `europe-west1` | region Cloud Run |
| `SERVICE` | `dbillet` | nom du service |
| `BUCKET` | `<projet>-dbillet-uploads` | bucket des uploads |
| `DOMAIN` | `d-billet.com` | domaine public |
| `MIN_INSTANCES` | `0` | `0` = scale a zero, `1` = pas de cold start |
| `MAX_INSTANCES` | `10` | plafond de mise a l'echelle |
| `MEMORY` / `CPU` | `512Mi` / `1` | ressources par instance |
| `ENABLE_PRERENDER` | `true` | pre-rendu SEO des pages publiques |

---

## Phase 3 - Verification

```bash
SERVICE_URL=$(gcloud run services describe dbillet \
    --region europe-west1 --format='value(status.url)')

curl -fsS $SERVICE_URL/health
curl -I $SERVICE_URL
```

En-tetes attendus :

```
HTTP/2 200
cache-control: no-cache, no-store, must-revalidate
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; ...
strict-transport-security: max-age=31536000; includeSubDomains
```

Ouvre ensuite dans un navigateur `$SERVICE_URL`, `/ferry`, `/auth`.

---

## Phase 4 - Creer le premier compte admin

En production, le seed de demo est **desactive** : aucun compte n'existe. Il
n'y a pas de SSH sur Cloud Run, la creation passe par un job qui utilise la
meme image :

```bash
gcloud run jobs execute dbillet-create-admin \
    --region europe-west1 --wait \
    --update-env-vars ADMIN_EMAIL=admin@d-billet.com,ADMIN_PASSWORD='MotDePasseTresLong2026!'
```

Le script est idempotent : le relancer avec le meme email **reinitialise le
mot de passe** du compte existant au lieu d'en creer un second. C'est aussi la
procedure de recuperation en cas de perte du mot de passe admin.

Variables acceptees : `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 caracteres minimum),
`ADMIN_FULL_NAME`, `ADMIN_PHONE`.

---

## Phase 5 - Domaine personnalise

Deux methodes.

### Methode A - Domain mapping Cloud Run (simple)

```bash
gcloud beta run domain-mappings create \
    --service dbillet --domain d-billet.com --region europe-west1
gcloud beta run domain-mappings create \
    --service dbillet --domain www.d-billet.com --region europe-west1
```

La commande affiche les enregistrements DNS a creer chez ton registrar.
Le certificat est emis automatiquement une fois le DNS propage (15 min a 24 h).

> Le domain mapping n'est pas disponible dans toutes les regions. Si la
> commande echoue, utilise la methode B.

### Methode B - Load balancer global (recommande en production)

Plus de configuration, mais c'est le seul chemin qui permet **Cloud Armor**
(WAF, rate-limiting par IP), Cloud CDN et une IP anycast fixe.

```bash
REGION=europe-west1

gcloud compute network-endpoint-groups create dbillet-neg \
    --region=$REGION --network-endpoint-type=serverless \
    --cloud-run-service=dbillet

gcloud compute backend-services create dbillet-backend --global
gcloud compute backend-services add-backend dbillet-backend --global \
    --network-endpoint-group=dbillet-neg --network-endpoint-group-region=$REGION

gcloud compute url-maps create dbillet-lb --default-service=dbillet-backend
gcloud compute ssl-certificates create dbillet-cert \
    --domains=d-billet.com,www.d-billet.com --global
gcloud compute target-https-proxies create dbillet-https \
    --url-map=dbillet-lb --ssl-certificates=dbillet-cert
gcloud compute forwarding-rules create dbillet-fr --global \
    --target-https-proxy=dbillet-https --ports=443
```

Pointe ensuite `@` et `www` (enregistrements A) sur l'IP de la regle de
transfert.

### Apres le mapping : rebuild obligatoire

`REACT_APP_BACKEND_URL` et `REACT_APP_SITE_URL` sont compiles dans le bundle
React. Une fois le domaine actif, relance le script pour rebuilder avec la
bonne URL :

```bash
DOMAIN=d-billet.com ./deploy/gcp/deploy-cloudrun.sh
```

Ce rebuild fige aussi les vraies donnees de pre-rendu SEO : au tout premier
build l'API n'existait pas encore, `generate-prerender-data.js` est donc
tombe sur ses valeurs par defaut.

---

## Phase 6 - Cloud Armor (rate-limiting)

Sans Nginx, la protection anti-brute-force repose sur le limiteur applicatif
(`backend/services/rate_limit.py`), qui compte **par instance**. Avec 5
instances, une limite de 10 tentatives/minute en autorise 50. Pour une limite
reelle, ajoute Cloud Armor devant le load balancer (methode B ci-dessus) :

```bash
gcloud compute security-policies create dbillet-waf \
    --description="Rate limiting D-Billet"

# 10 requetes/minute par IP sur les routes d'authentification
gcloud compute security-policies rules create 1000 \
    --security-policy=dbillet-waf \
    --expression="request.path.matches('/api/auth/')" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=10 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=600 \
    --conform-action=allow --exceed-action=deny-429 \
    --enforce-on-key=IP

gcloud compute backend-services update dbillet-backend --global \
    --security-policy=dbillet-waf
```

---

## Mises a jour

```bash
git push origin main
./deploy/gcp/deploy-cloudrun.sh
```

Le deploiement Cloud Run est atomique : la nouvelle revision ne recoit du
trafic qu'une fois demarree et saine. Revenir en arriere :

```bash
gcloud run revisions list --service dbillet --region europe-west1
gcloud run services update-traffic dbillet --region europe-west1 \
    --to-revisions=dbillet-00007-abc=100
```

### Deploiement continu (optionnel)

`cloudbuild.yaml` est utilisable comme trigger GitHub :

```bash
gcloud builds triggers create github \
    --repo-name=D-billet --repo-owner=<TON_USER> \
    --branch-pattern='^main$' \
    --build-config=cloudbuild.yaml \
    --substitutions=_IMAGE=europe-west1-docker.pkg.dev/dbillet-prod/dbillet/dbillet,_SITE_URL=https://d-billet.com
```

Ajoute une etape `gcloud run deploy` au fichier si tu veux que le trigger
deploie aussi, et non seulement builde.

---

## WaafiPay

Comme sur le Droplet, le paiement reste **simule** tant que les cles ne sont
pas renseignees. Pour les ajouter apres coup :

```bash
printf '%s' 'LA_CLE' | gcloud secrets versions add dbillet-waafipay-api-key --data-file=-

gcloud run services update dbillet --region europe-west1 \
    --update-secrets WAAFIPAY_API_KEY=dbillet-waafipay-api-key:latest
```

L'URL de retour a declarer chez WaafiPay est
`https://d-billet.com/api/payments/waafi/return/...` (identique au Droplet).

---

## Depannage

| Symptome | Action |
|----------|--------|
| Le service ne demarre pas | `gcloud run services logs read dbillet --region europe-west1 --limit 50` |
| Demarrage tres lent puis echec | MongoDB injoignable : chaque index attend le timeout. Verifier `MONGO_URL` et l'acces reseau (phase 1) |
| `JWT_SECRET must be defined...` | Le secret n'est pas monte : `gcloud run services describe dbillet --region ... --format='value(spec.template.spec.containers[0].env)'` |
| Image uploadee puis disparue | `UPLOAD_DIR` ne pointe pas sur `/mnt/uploads`, ou le bucket n'est pas monte |
| `403` a l'ecriture dans le bucket | Le compte de service n'a pas `roles/storage.objectAdmin` sur le bucket |
| Page blanche | Le build frontend a echoue : chercher `Compiled successfully` dans les logs Cloud Build |
| `/api/docs` en 404 | Normal : la documentation est desactivee en production |
| Cold start de plusieurs secondes | `MIN_INSTANCES=1` lors du deploiement |
| Build Cloud Build en timeout | Augmenter `timeout` dans `cloudbuild.yaml`, ou `ENABLE_PRERENDER=false` |

Logs :

```bash
gcloud run services logs tail dbillet --region europe-west1          # temps reel
gcloud run services logs read dbillet --region europe-west1 --limit 100
gcloud builds list --limit 5                                          # builds
```

---

## Couts

Ordres de grandeur, a confirmer avec https://cloud.google.com/products/calculator :

| Poste | `MIN_INSTANCES=0` | `MIN_INSTANCES=1` |
|-------|-------------------|-------------------|
| Cloud Run | quelques dollars/mois a faible trafic | environ 10 $/mois d'instance au repos, plus le trafic |
| Artifact Registry | < 1 $/mois | idem |
| Cloud Storage (uploads) | < 1 $/mois | idem |
| Cloud Build | quelques centimes par build | idem |
| Cloud NAT (si IP fixe) | environ 1 $/mois plus le trafic | idem |
| MongoDB Atlas | M0 gratuit / M10 a partir d'environ 57 $/mois | idem |

`MIN_INSTANCES=0` supprime le cout au repos mais expose la premiere visite
apres une periode creuse a un demarrage a froid de quelques secondes. Pour un
site de billetterie grand public, `MIN_INSTANCES=1` est generalement le bon
compromis.

---

## Sauvegardes

Cloud Run ne stocke rien : les seules donnees a sauvegarder sont la base et
les uploads.

- **MongoDB** : backups automatiques Atlas (inclus a partir de M10), ou
  `mongodump` planifie pour l'option VM.
- **Uploads** : activer le versioning du bucket, et une regle de cycle de vie.

```bash
gcloud storage buckets update gs://dbillet-prod-dbillet-uploads --versioning
```

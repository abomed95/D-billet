# D-BILLET - Audit technique (Phase 0)

> Audit de l'existant avant toute modification, conformement a la regle 1 de la
> mission. **Aucun code applicatif n'a ete modifie pour produire ce document.**
>
> Date : 2026-09-29 - Branche : `claude/awesome-keller-9d8rxk`

---

## 1. Stack detectee

| Couche | Technologie | Remarques |
|--------|-------------|-----------|
| Frontend | React 19, Create React App + craco, TailwindCSS, Radix UI | SPA, `react-router-dom` v7 |
| Pre-rendu SEO | `react-snap` (postbuild) + `scripts/generate-prerender-data.js` | 12 routes publiques pre-rendues en HTML |
| Backend | FastAPI 0.110, uvicorn, Python 3.11 | Routes modulaires sous `backend/routes/` |
| Base de donnees | **MongoDB** (motor/pymongo), repli JSON local (`localdb.py`) | **Pas PostgreSQL** - voir section 6 |
| Auth | JWT maison (`python-jose`), bcrypt via passlib, Google OAuth | Jeton porteur, deja utilisable par une app native |
| Billets | `qrcode` (image) + `reportlab` (PDF) | QR non signe - voir section 5 |
| Paiement | WaafiPay (HPP + debit direct), sinon simulation | D-Money et CAC Bank simules |
| Deploiement | DigitalOcean (Nginx + systemd) **et** Google Cloud Run | Cloud Run ajoute le 17/09, conteneur unique |

**Il y a bien un backend separe.** Le front ne parle jamais directement a MongoDB.

---

## 2. Arborescence reelle

```
backend/            API FastAPI
  main.py           app, middlewares, montage des routers
  config.py         configuration par variables d'environnement
  spa.py            service du build React (Cloud Run uniquement)
  create_admin.py   creation du premier admin (job Cloud Run)
  localdb.py        backend JSON local (dev sans MongoDB)
  models/           schemas Pydantic
  routes/           auth, events, cart, tickets, transport, staff,
                    organizer, admin, content, seo, setup, payments
  services/         auth, payments, waafipay, pdf, seo, seed,
                    indexes, rate_limit
  tests/            10 fichiers (8 d'integration, 2 autonomes)

frontend/           PWA React
  public/           manifest.json, service-worker.js, images, sitemaps
  src/
    lib/api.js      API_BASE centralise (peu utilise - voir 5.3)
    context/        AuthContext, CartContext, StaffAuthContext
    pages/          pages publiques + admin/ + organizer/ + staff/
    components/     composants, dont PWAInstallPrompt

deploy/digitalocean/  Nginx, systemd, rate-limit
deploy/gcp/           script de deploiement Cloud Run, reference des variables
Dockerfile            image multi-etages (React puis FastAPI)
cloudbuild.yaml       pipeline Cloud Build
```

---

## 3. Etat actuel de la PWA

### Ce qui existe deja et fonctionne

- `manifest.webmanifest` (nomme `manifest.json`) : `name`, `short_name`,
  `start_url`, `scope`, `display: standalone`, `theme_color`,
  `background_color`, `lang: fr`, `dir: ltr`, `categories`.
- `service-worker.js` ecrit a la main, enregistre depuis `public/index.html` :
  - navigation : *network-first* avec repli sur `index.html` en cache ;
  - `/api/*` : jamais mis en cache ;
  - statiques : *cache-first* ;
  - cross-origin : ignore ; requetes non-GET : ignorees ;
  - gestion du message `SKIP_WAITING` pour activer une nouvelle version.
- `PWAInstallPrompt.js` : invite d'installation Android (`beforeinstallprompt`).
- En-tetes de securite et CSP poses par Nginx (Droplet) ou par l'application
  (Cloud Run).

### Ce qui manque ou pose probleme

| Point | Constat verifie |
|-------|-----------------|
| Icones | ~~JPEG renommes `.png`~~ - **corrige le 29/09.** Quatre vrais PNG generes. `dbillet-logo.png` reste un JPEG renomme, mais il ne sert plus au manifest. |
| Tailles d'icones | ~~Un seul fichier declare en 3 tailles~~ - **corrige le 29/09.** Un fichier par taille (192 et 512), plus deux icones `maskable` dediees. |
| `purpose: "any maskable"` | ~~Applique a un JPEG~~ - **corrige le 29/09.** `any` et `maskable` sont separes ; le contenu maskable tient dans 71 % du diametre (zone sure : 80 %). |
| Page hors ligne | Pas de page de secours dediee ; repli sur `index.html` en cache. |
| Billets hors ligne | **Aucun IndexedDB dans le projet.** `MyTicketsPage` appelle l'API a chaque affichage : sans reseau, pas de billet. |
| Notification de mise a jour | `SKIP_WAITING` est gere cote worker, mais aucune interface ne previent l'utilisateur. |
| i18n | **Absent.** Tous les textes sont en dur en francais dans les composants. Aucune preparation RTL. |
| Budget JS | **235,61 ko gzip** pour `main.js` (mesure au build du 17/09), en un seul bundle. Budget vise : ~200 ko. |
| Code splitting | **Aucun** `React.lazy` / `Suspense`. Admin, organisateur et staff sont charges par tous les visiteurs. |
| Images | 1,1 Mo dans `public/images/`, dont **818 ko de fichiers jamais references** (`dbilleh-icon.png` 545 ko, `dbilleh-logo.png` 253 ko - noter la faute de frappe « dbilleh »). Logos de paiement en PNG non optimises (`dmoney` 124 ko, `waafi` 55 ko) alors que `cac-bank-logo.webp` ne pese que 5 ko. |

---

## 4. Correspondance avec les phases de la mission

| Phase | Etat | Detail |
|-------|------|--------|
| 0 - Audit | **Ce document** | `CLAUDE.md` cree en meme temps |
| 1 - Separation front / API | **Largement acquis** | Backend separe, auth par jeton, CORS par variable d'environnement, OpenAPI auto-genere par FastAPI. Manquent : versionnage `/api/v1`, `/healthz`, format d'erreur formalise, client front centralise reellement utilise |
| 2 - PWA solide | **Partiel** | Manifest + service worker + invite d'installation OK. Manquent : billets hors ligne, QR signe, i18n, budget de performance, icones correctes |
| 3 - Espace controleur | **Partiel** | `/staff/login` + `/staff/scanner` existent avec jeton dedie 24 h et journal de scans. Manquent : decodage reel du QR, manifeste hors ligne, file d'attente et synchronisation |
| 4 - Ports et adaptateurs | **Partiel** | Le paiement bascule deja WaafiPay / simulation selon les variables d'environnement, et `services/payments.py` est idempotent. Manquent : interfaces formalisees, fabrique par variable, anti-double-vente au niveau base, webhooks generiques |
| 5 - Preparation GCP | **Largement acquis (17/09)** | Dockerfile multi-etages, `$PORT`, sans etat, `cloudbuild.yaml`, script de deploiement, `DEPLOY-GCP.md`. Manquent : `docker-compose.yml`, CI GitHub Actions, `.env.example` de developpement |
| 6 - Play Store (TWA) | **Non commence** | Ni `assetlinks.json`, ni `docs/PLAY-STORE.md` |

---

## 5. Ecarts classes par risque

### 5.1 - Critique : anti-double-vente non garanti (bug actuel)

`backend/routes/cart.py` (checkout) lit le stock puis le reecrit :

```python
available = ticket_type["quantity"] - ticket_type.get("sold", 0)   # lecture
...
tt["sold"] = tt.get("sold", 0) + item["quantity"]                  # calcul en memoire
await db.events.update_one({"id": event["id"]},
                           {"$set": {"ticket_types": ticket_types}})  # reecriture complete
```

Deux achats simultanes peuvent lire la meme valeur de `sold` et ecraser
l'increment de l'autre : **survente et compteur fausse**. Meme schema pour le
transport (`transport.py`), ou la capacite est calculee en comptant les
reservations existantes avant insertion.

Aucune contrainte d'unicite en base, aucune transaction, aucune reservation
temporaire de place pendant le paiement.

### 5.2 - Critique : le controle des billets ne peut pas fonctionner hors ligne

- Le contenu du QR est `DBILLET-<uuid>` / `TRAIN-<uuid>` / `FERRY-<uuid>` :
  **aucune signature**. La validite ne peut etre etablie qu'en interrogeant le
  serveur.
- `ScannerPage.js` porte le commentaire *« Simple QR detection simulation (in
  real app, use a QR library like jsQR or html5-qrcode) »* : la camera est
  affichee mais **le QR n'est jamais decode**, la validation passe par une
  saisie manuelle. Meme constat sur `StaffScannerPage.js`.

Consequence directe : dans le train ou sur le ferry, sans reseau, le controle
est impossible aujourd'hui.

### 5.3 - Moyen : le client API centralise est contourne

`frontend/src/lib/api.js` expose `API_BASE`, mais **29 fichiers** reconstruisent
leur propre URL :

```js
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
```

Ni intercepteur, ni gestion d'erreur commune, ni point unique pour ajouter le
rafraichissement de jeton ou le mode hors ligne.

### 5.4 - Moyen : pas de versionnage ni de contrat d'erreur

- Tous les routers sont montes sous `/api`, jamais `/api/v1`. Casser le contrat
  pour une future app mobile obligera a gerer la compatibilite autrement.
- Les erreurs sont des `HTTPException(detail="texte en francais")` : pas de code
  machine exploitable par un client.
- `/health` existe ; `/healthz` (attendu par la mission) non.

### 5.5 - Mineur : outillage de developpement absent

Pas de `docker-compose.yml`, pas de CI GitHub Actions, pas de `.env.example` de
developpement (seuls `backend/env.production.example` et
`frontend/env.production.example` existent).

---

## 6. Deux conflits avec la mission - arbitrage necessaire

Ces deux points opposent la mission a l'architecture existante. La consigne
etant de **ne pas modifier l'architecture**, voici le constat et ma
recommandation ; la decision vous revient.

### 6.1 - Base de donnees : MongoDB en place, PostgreSQL demande

La phase 5 prevoit **Cloud SQL PostgreSQL**. Le projet utilise **MongoDB**
(motor) dans les 13 routers, avec un repli JSON local.

Migrer signifie reecrire tout l'acces aux donnees, les modeles, le seed, les
index et les tests : c'est une refonte, pas une preparation.

> **Recommandation : rester sur MongoDB**, avec MongoDB Atlas heberge en region
> GCP (deja documente dans `DEPLOY-GCP.md`). Un point merite attention : la
> garantie anti-double-vente (5.1) se construit differemment en MongoDB
> (mise a jour atomique conditionnelle `$inc` avec filtre sur le stock
> disponible, plus un index unique) mais elle est tout a fait realisable.

### 6.2 - Hebergement du front : Firebase Hosting ou le conteneur unique deja en place

La phase 5 prevoit **Firebase Hosting** pour le front avec une reecriture
`/api/**` vers Cloud Run. Le depot contient deja, teste de bout en bout, un
**conteneur unique Cloud Run** qui sert le build React et l'API sur la meme
origine.

| | Conteneur unique (en place) | Firebase Hosting + Cloud Run |
|---|---|---|
| Origine | une seule, pas de CORS | deux, reecriture a configurer |
| CDN | non (sauf load balancer + Cloud CDN) | oui, edge mondial inclus |
| Cout | un service | Hosting gratuit jusqu'a un quota |
| En-tetes du service worker | geres par l'application | a declarer dans `firebase.json` |
| Etat | **valide** (build, demarrage, en-tetes, tests) | a construire |

> **Recommandation : garder le conteneur unique** pour la mise en ligne. Si la
> latence depuis Djibouti se revele decevante a l'usage, ajouter un load
> balancer avec Cloud CDN devant Cloud Run donnera le meme benefice qu'un CDN,
> sans scinder l'application.

---

## 7. Structure cible proposee

La mission propose `apps/web`, `apps/api`, `packages/shared`, `infra/`, `docs/`.

> **Recommandation : ne pas deplacer l'arborescence.** `backend/` et
> `frontend/` remplissent deja le role de `apps/api` et `apps/web`. Un
> deplacement casserait le Dockerfile, les deux scripts de deploiement, la
> configuration Nginx, les imports et l'historique Git, pour un benefice
> uniquement cosmetique.

Ce que je propose d'ajouter **sans rien deplacer** :

```
backend/            (= apps/api)      inchange
frontend/           (= apps/web)      inchange
shared/             NOUVEAU  constantes partagees front/back :
                             codes d'erreur, statuts, format du QR, roles
docs/               NOUVEAU  AUDIT.md, INTEGRATIONS.md, PLAY-STORE.md
deploy/             existant (= infra/) : digitalocean/, gcp/
CLAUDE.md           NOUVEAU  contexte et conventions
```

`shared/` serait du JSON ou un module minimal genere, consomme des deux cotes :
pas de monorepo, pas d'outil de build supplementaire.

---

## 8. Ordre de traitement suggere

Classe par risque reel, pas par numero de phase :

| Priorite | Sujet | Phase | Pourquoi d'abord |
|----------|-------|-------|------------------|
| 1 | Anti-double-vente atomique + reservation temporaire | 4 | Bug en production : deux clients peuvent acheter la meme place |
| 2 | QR signe Ed25519 + decodage reel du QR au scan | 2 et 3 | Le controle hors ligne est impossible sans les deux |
| 3 | Billets en IndexedDB | 2 | Critere d'acceptation, et usage reel sans reseau |
| 4 | Icones PWA correctes (vrais PNG, 192/512, maskable dediee) | 2 | Conditionne l'installabilite et le passage au Play Store |
| 5 | Manifeste de trajet hors ligne + file de scans + `/scans/batch` | 3 | Complete le controle hors ligne |
| 6 | Client API centralise, `/api/v1`, `/healthz`, format d'erreur | 1 | Prepare l'app native et les partenaires |
| 7 | Interfaces fournisseurs + registre par variable d'environnement | 4 | Le paiement en pose deja la moitie |
| 8 | Budget JS : code splitting, images mortes, WebP | 2 | 235 ko -> cible 200 ko, gain immediat sur reseau lent |
| 9 | i18n (francais par defaut, prevu so/aa/ar + RTL) | 2 | Gros volume, aucun risque technique |
| 10 | `docker-compose.yml`, CI, `.env.example` | 5 | Confort de developpement |
| 11 | `assetlinks.json` + `docs/PLAY-STORE.md` | 6 | Depend de l'installabilite (priorite 4) |

---

## 9. Questions ouvertes

1. **MongoDB ou PostgreSQL** (section 6.1) ?
2. **Conteneur unique ou Firebase Hosting** (section 6.2) ?
3. **Module bus** : absent du code (aucune route, aucune page). Fait-il partie
   du perimetre a venir, ou reste-t-il hors sujet pour l'instant ?
4. **Role `controleur`** : la mission demande `/controle` et un role
   `controleur`. Le projet a un module `staff` equivalent avec son propre jeton.
   Faut-il renommer, ou enrichir l'existant sous son nom actuel ?
5. **Cle de signature des QR** : ou stocker la cle privee Ed25519 (Secret
   Manager) et comment diffuser la cle publique aux appareils de controle ?
6. **Operateurs** : dispose-t-on d'une documentation d'API pour le train, le
   ferry ou les compagnies de bus, ou reste-t-on sur des donnees internes ?

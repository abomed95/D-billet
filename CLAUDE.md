# CLAUDE.md - Contexte et conventions du projet D-BILLET

Fichier de reference pour toute session de travail sur ce depot.
Audit detaille de l'existant : [`docs/AUDIT.md`](docs/AUDIT.md).

---

## 1. Le produit

**D-BILLET** (d-billet.com) est la plateforme de billetterie numerique de
Djibouti, portee par **ENTREPRISE AMD DIGITAL**.

Quatre services :

1. **Billetterie d'evenements**
2. **Train** - ligne Nagad - Holl-Holl - Ali-Sabieh - Dire-Dawa
3. **Ferry** - traversees vers Obock
4. **Bus** Djibouti - Ali-Sabieh - *module a venir, absent du code aujourd'hui*

L'application est une **PWA** et le reste : installable, utilisable hors ligne,
publiee plus tard sur le Play Store via une TWA (Trusted Web Activity).

Contact : +253 77 69 48 12 - contact@d-billet.com

---

## 2. Contraintes terrain

Ces contraintes priment sur toute preference technique.

| Contrainte | Consequence concrete |
|------------|----------------------|
| Android d'entree de gamme, 3G/4G instable, donnees cheres | Application legere. Peu de JavaScript, images optimisees, chargement differe. Budget : **JS initial < ~200 ko gzip** - **respecte** depuis le decoupage du 29/09 : **178,9 ko** (contre 235,6 ko). Lighthouse mobile 84/100. |
| Controle des billets sans reseau (train, ferry) | Le billet **et sa verification** doivent fonctionner hors ligne : QR signe, verification par cle publique, manifeste embarque |
| Langue | **Francais** par defaut. Prevoir somali, afar et arabe (**RTL**). Aucun texte en dur : passer par des cles de traduction |
| Monnaie | **Franc djiboutien (DJF), sans decimales** : montants stockes en **entiers**, jamais en flottant |
| Fuseau horaire | **Africa/Djibouti (UTC+3)**. Stocker en **UTC**, afficher en heure locale |
| Telephone | Format **+253** |
| Donnees personnelles | Collecter le **minimum** necessaire a l'emission du billet (nom, telephone) |

---

## 3. Stack en place

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Create React App + craco, TailwindCSS, Radix UI, react-router-dom v7 |
| Pre-rendu SEO | react-snap (postbuild) + `frontend/scripts/generate-prerender-data.js` |
| Backend | FastAPI 0.110, uvicorn, Python 3.11 |
| Base de donnees | **MongoDB** (motor), repli JSON local via `backend/localdb.py` |
| Auth | JWT maison (python-jose), bcrypt (passlib), Google OAuth ; jeton staff separe (24 h) |
| Billets | `qrcode` + `reportlab` (PDF) |
| Paiement | WaafiPay (page hebergee et debit direct) ; D-Money et CAC Bank simules |
| Hebergement | DigitalOcean (Nginx + systemd) **et** Google Cloud Run (conteneur unique) |

Arborescence : `backend/` (API), `frontend/` (PWA), `deploy/` (DigitalOcean et
GCP), `docs/`. **Ne pas deplacer cette arborescence** sans accord explicite.

---

## 4. Regles de travail

1. **Auditer avant de modifier.** Pas de reecriture, pas de changement de
   framework, pas de deplacement de l'arborescence sans accord.
2. **Travailler phase par phase.** A la fin de chaque phase : resume, liste des
   fichiers modifies, procedure de test, puis **s'arreter et attendre
   validation**.
3. **Aucun secret dans le code.** Toute configuration passe par des variables
   d'environnement, documentees dans un fichier d'exemple.
4. **Commits petits et explicites**, un sujet par commit.
5. **Tests obligatoires** sur la logique critique : reservation,
   anti-double-vente, paiement (avec mocks), generation et verification des QR.
6. **Demander plutot qu'inventer**, surtout pour les API des operateurs et des
   moyens de paiement.
7. **Ne rien deployer**, ne creer aucune ressource cloud, n'utiliser aucune cle
   reelle.
8. **Pas de dependance lourde** sans justification (poids, maintenance).
9. **Aucune integration reelle de paiement** : uniquement des mocks.

---

## 5. Conventions du depot

### Documentation et commentaires

- Documentation (`README.md`, `DEPLOY*.md`, `docs/`) : **francais sans
  accents**, pour rester coherent avec l'existant.
- Commentaires et docstrings dans le code : **anglais**, comme le code existant.
- Messages d'erreur destines a l'utilisateur : **francais**.

### Backend

- Configuration : **toujours** via `backend/config.py`, jamais `os.environ` en
  dur dans un router.
- Un router par domaine dans `backend/routes/`, la logique dans
  `backend/services/`.
- Dates : `datetime.now(timezone.utc).isoformat()`.
- Identifiants : `str(uuid.uuid4())`, champ `id` (jamais `_id` expose).
- Les reponses excluent toujours `_id` : `{"_id": 0}` dans les projections.
- Montants : entiers (DJF sans decimales).
- `APP_ENV=production` desactive d'office le seed de demo, la route de seed
  publique et la documentation OpenAPI.

### Frontend

- Alias `@` vers `frontend/src`.
- URL de l'API : `REACT_APP_BACKEND_URL`, **figee au build**. Changer de domaine
  impose un rebuild, pas seulement un redeploiement.
- `frontend/src/lib/api.js` expose `API_BASE` : c'est le point d'entree a
  privilegier (29 fichiers le contournent encore, voir l'audit section 5.3).
- Le service worker (`frontend/public/service-worker.js`) est ecrit a la main :
  incrementer `CACHE_VERSION` a chaque changement de strategie.

### Commits

Format `type(scope): sujet` - `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
Exemple : `fix(cart): make seat decrement atomic`.

---

## 6. Environnements et commandes

```bash
# Backend en developpement (repli JSON local si MongoDB absent)
cd backend && uvicorn main:app --reload --port 8001

# Frontend
cd frontend && npm start

# Tests autonomes (sans serveur)
pytest backend/tests/test_waafipay.py -v

# Tests d'integration (necessitent un serveur et les donnees de demo)
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 pytest backend/tests/ -v
```

Variables d'environnement : voir `backend/env.production.example`,
`frontend/env.production.example` et `deploy/gcp/env.production.example`.

### Deploiement

- Google Cloud Run : `DEPLOY-GCP.md` et `deploy/gcp/deploy-cloudrun.sh`
- DigitalOcean : `DEPLOY.md` et `scripts/deploy-digitalocean.sh`

Ne jamais executer ces scripts sans demande explicite.

---

## 7. Points de vigilance connus

Detail et preuves dans [`docs/AUDIT.md`](docs/AUDIT.md).

1. **Anti-double-vente non garanti** : le stock est lu puis reecrit
   (`backend/routes/cart.py`), sans operation atomique ni contrainte d'unicite.
   Deux achats simultanes peuvent survendre.
2. **QR non signe** : le contenu est `DBILLET-<uuid>`. La validite exige un
   appel serveur, donc **aucun controle hors ligne possible**.
3. **Le scan ne decode pas les QR** : la camera est affichee, mais la
   validation passe par une saisie manuelle (`ScannerPage.js`,
   `StaffScannerPage.js`).
4. **Aucun stockage hors ligne** : pas d'IndexedDB, les billets disparaissent
   sans reseau.
5. ~~**Icones PWA**~~ : **corrige.** Le manifest utilise desormais quatre vrais
   PNG (`icon-192`, `icon-512`, `icon-maskable-192`, `icon-maskable-512`), le
   contenu de l'icone maskable a ete recentre dans la zone sure de 80 %.
   Reste ouvert : `dbillet-logo.png` est toujours un JPEG renomme `.png`, sert
   d'`og:image` et de visuel de repli. Sans impact PWA, mais a assainir un jour.
6. **Aucun i18n** : textes en dur, aucune preparation RTL.
7. ~~**Pas de code splitting**~~ : **corrige.** Les espaces admin, organisateur
   et scanner sont en `React.lazy`, regroupes par `webpackChunkName` en trois
   chunks (`admin` 22,4 ko, `organizer` 25 ko, `scanner` 6,8 ko) plutot qu'en
   une vingtaine de petits fichiers : sur 3G la latence coute plus que les
   octets. `main.js` passe de 235,6 a **178,9 ko**. Les pages publiques restent
   en import statique, car react-snap les pre-rend.
   Un chunk differe n'est demande que si la route est atteinte : sur `/admin`,
   `ProtectedRoute` redirige avant, donc un visiteur non autorise ne telecharge
   rien.
8. **818 ko d'images mortes** dans `frontend/public/images/` (`dbilleh-*`).
9. ~~**Pas de compression sur le chemin Cloud Run**~~ : **corrige.**
   `backend/compression.py` ajoute un gzip selectif (types compressibles
   uniquement, images et PDF laisses intacts). Mesure sur le conteneur :
   `main.js` 915 ko -> 236 ko, performance Lighthouse mobile **65/100 avant**
   contre **79-83/100 apres**. Le middleware est enregistre **en premier**
   dans `main.py`, donc le plus interne : place en externe, il voit les
   reponses deja transformees en flux par les `BaseHTTPMiddleware` et son
   `minimum_size` ne s'applique plus.
10. **Erreur d'hydratation React #418 sur toutes les routes** : react-snap
   pre-rend le HTML au build, puis le client recupere ses donnees et rend
   autre chose. Verifie le 29/09 sur les builds **avant et apres** le
   decoupage : identique, donc preexistant et sans lien avec lui. Sans effet
   visible (React re-rend), mais cela annule le benefice du pre-rendu sur la
   partie dynamique. A traiter en alignant l'etat initial du client sur les
   donnees de `public/prerender-data/`.
11. **Tests d'integration instables** : ils enchainent les connexions et
   declenchent le limiteur de debit applicatif (429). Echecs preexistants, sans
   rapport avec les modifications recentes.

---

## 8. Decisions en attente

1. **MongoDB ou PostgreSQL** ? La mission evoque Cloud SQL PostgreSQL ; le
   projet tourne sur MongoDB. Recommandation : rester sur MongoDB (Atlas GCP).
2. **Conteneur unique Cloud Run ou Firebase Hosting + Cloud Run** ?
   Recommandation : garder le conteneur unique, deja valide.
3. **Module bus** : dans le perimetre ou non ?
4. **Role `controleur`** : renommer le module `staff` existant, ou l'enrichir
   sous son nom actuel ?

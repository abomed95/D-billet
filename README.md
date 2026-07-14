# D-Billet - Plateforme de Billetterie Djibouti

Application web moderne de billetterie pour Djibouti, couvrant les evenements, le train et le ferry.

## Stack Technique

- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python 3.11)
- **Base de donnees**: MongoDB
- **Authentification**: JWT + Google OAuth 2.0 + OTP simule

## Structure du Projet

```
/app/
├── backend/
│   ├── main.py              # Point d'entree FastAPI
│   ├── config.py            # Configuration (DB, JWT, constantes)
│   ├── server.py            # Wrapper pour uvicorn
│   ├── models/              # Modeles Pydantic
│   │   ├── auth.py          # Utilisateurs, tokens
│   │   ├── events.py        # Evenements, types de billets
│   │   ├── tickets.py       # Panier, checkout
│   │   ├── transport.py     # Train, Ferry
│   │   ├── staff.py         # Personnel evenement/transport
│   │   └── admin.py         # Temoignages, actualites
│   ├── routes/              # Routers FastAPI
│   │   ├── auth.py          # /api/auth/*
│   │   ├── events.py        # /api/events/*, /api/promo-codes/*
│   │   ├── cart.py          # /api/cart/*, /api/checkout
│   │   ├── tickets.py       # /api/tickets/*, /api/scanner/*
│   │   ├── transport.py     # /api/train/*, /api/ferry/*
│   │   ├── staff.py         # /api/staff/*, /api/organizer/staff/*
│   │   ├── organizer.py     # /api/organizer/*
│   │   └── admin.py         # /api/admin/*
│   ├── services/            # Logique metier
│   │   ├── auth.py          # Authentification, JWT
│   │   └── pdf.py           # Generation PDF billets
│   └── tests/               # Tests pytest
└── frontend/
    ├── public/
    │   ├── manifest.json    # PWA config
    │   └── images/          # Logos et icones
    └── src/
        ├── App.js           # Routes principales
        ├── context/         # AuthContext, CartContext, StaffAuthContext
        ├── components/      # Composants reutilisables
        ├── layouts/         # MainLayout, OrganizerLayout, AdminLayout
        └── pages/           # Pages par role
            ├── admin/       # Dashboard Admin
            ├── organizer/   # Dashboard Organisateur
            ├── staff/       # Interface Staff
            └── ...          # Pages publiques
```

## Roles Utilisateurs

| Role | Acces |
|------|-------|
| **Client** | Acheter billets, voir mes billets |
| **Organisateur** | Creer evenements, gerer staff, voir ventes |
| **Admin** | Gestion complete plateforme |
| **Staff** | Scanner billets aux entrees |

## Planning Ferry (Djibouti-Obock)

| Jour | Service | Horaires |
|------|---------|----------|
| Lundi | Ferme | - |
| Mardi | Ferme | - |
| Mercredi | Ferme | - |
| **Jeudi** | **Obock** | **Aller 09:00 / Retour 14:00** |
| Vendredi | Ferme | - |
| **Samedi** | **Obock** | **Aller 08:00 / Retour 13:00** |
| Dimanche | Ferme | - |

## Demarrage Local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Frontend
cd frontend
yarn install
yarn start
```

## Variables d'Environnement

**Backend** (`/app/backend/.env`):
- `MONGO_URL`: URL de connexion MongoDB
- `DB_NAME`: Nom de la base de donnees
- `JWT_SECRET`: Cle secrete pour les tokens JWT
- `FRONTEND_URL`: URL publique du frontend
- `GOOGLE_CLIENT_ID`: Client ID Google OAuth
- `GOOGLE_CLIENT_SECRET`: Secret Google OAuth

**Frontend** (`/app/frontend/.env`):
- `REACT_APP_BACKEND_URL`: URL de l'API backend

## Credentials de Test (DEV UNIQUEMENT)

Ces comptes sont crees automatiquement uniquement quand `APP_ENV` vaut
`development`, `dev`, `local` ou `test`. En production (`APP_ENV=production`),
le seed est **completement desactive** quel que soit `AUTO_SEED_DEMO_DATA`.

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@dbillet.dj | admin123 |
| Organisateur | organizer@dbillet.dj | organizer123 |
| Client (phone-login) | +25377123456 | aucun (sans OTP) |

> Ne deploie jamais ces credentials en production. Cree le compte admin
> initial manuellement (Mongo Compass ou seed local sur une base de staging).

## API Endpoints Principaux

- `POST /api/auth/login` - Connexion
- `GET /api/events` - Liste evenements
- `GET /api/ferry/schedule` - Planning hebdomadaire ferry
- `GET /api/ferry/trips?date=YYYY-MM-DD` - Trajets disponibles
- `POST /api/ferry/book` - Reserver ferry
- `GET /api/admin/stats` - Stats plateforme (admin)

## Deploiement

Pour le deploiement production, voir [deploy/digitalocean/README.md](deploy/digitalocean/README.md).

Points cles avant deploy:

1. Generer `JWT_SECRET` avec `openssl rand -hex 64` (l'app refuse de demarrer en prod sans).
2. Verifier `AUTO_SEED_DEMO_DATA=false` et `ALLOW_PUBLIC_SEED_ROUTE=false` (forces a `false` en `APP_ENV=production`).
3. `npm run build` strip automatiquement les `console.log` et `debugger`.
4. La configuration Nginx fournie inclut HSTS, CSP, X-Frame-Options et rate-limiting (10 req/min sur les routes auth).
5. Documentation OpenAPI (`/api/docs`, `/api/redoc`) est masquee en production.

## Notes

- Paiements **SIMULES** (Waafi, D-Money, CAC Bank) - integrations PSP reelles a venir.
- Application PWA installable sur mobile (service-worker network-first pour les routes, jamais de cache sur `/api`).
- Google OAuth: si `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` manquent, le bouton Google reste desactive.

## Securite

- JWT avec secret fail-fast en production.
- Rate-limiting double couche (Nginx + application).
- Headers de securite: HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy.
- CORS restreint (methodes et headers whitelistes en production).
- Service systemd hardene (NoNewPrivileges, ProtectSystem, PrivateTmp).
- Indexes MongoDB crees au demarrage.

---

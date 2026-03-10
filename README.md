# D-Billet - Plateforme de Billetterie Djibouti

Application web moderne de billetterie pour Djibouti, couvrant les evenements, le train et le ferry.

## Stack Technique

- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python 3.11)
- **Base de donnees**: MongoDB
- **Authentification**: JWT + OTP (simule)

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

**Frontend** (`/app/frontend/.env`):
- `REACT_APP_BACKEND_URL`: URL de l'API backend

## Credentials de Test

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@dbillet.dj | admin123 |
| Organisateur | organizer@dbillet.dj | organizer123 |
| Client (OTP) | +25377123456 | Code dans logs |

## API Endpoints Principaux

- `POST /api/auth/login` - Connexion
- `GET /api/events` - Liste evenements
- `GET /api/ferry/schedule` - Planning hebdomadaire ferry
- `GET /api/ferry/trips?date=YYYY-MM-DD` - Trajets disponibles
- `POST /api/ferry/book` - Reserver ferry
- `GET /api/admin/stats` - Stats plateforme (admin)

## Notes

- Paiements **SIMULES** (Waafi, D-Money, CAC Bank)
- OTP SMS **SIMULE** (code dans reponse API)
- Application PWA installable sur mobile

---

Developpe avec Emergent AI

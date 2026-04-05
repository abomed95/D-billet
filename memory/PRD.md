# D-Billet - Plateforme de Billetterie Djibouti

## Probleme Original
Developper une application web moderne et responsive appelee "D-Billet", une plateforme de billetterie centralisee pour Djibouti avec gestion complete pour les administrateurs, organisateurs et transport.

## Stack Technique
- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI + PWA
- **Backend**: FastAPI (Python) - Architecture modulaire
- **Base de donnees**: MongoDB avec index optimises
- **Authentification**: JWT + Google OAuth (Emergent Auth) + Login par telephone
- **Documentation**: Swagger/OpenAPI auto-generee

---

## Mise a Jour (5 Avril 2026)

### Nouvelles Fonctionnalites
1. **Dashboard Organisateur Transport (Ferry/Train)**
   - Stats temps reel (passagers, vehicules, revenus)
   - Gestion des prix vehicules
   - Parametres de tarification (prix passager, age gratuit enfants, capacites)
   - Vue des voyages a venir
   - Calcul automatique commission 10%

2. **Fichiers de Configuration**
   - `/app/backend/.env.example` - Variables backend
   - `/app/frontend/.env.example` - Variables frontend
   - Index MongoDB optimises pour performances

3. **Documentation API Swagger**
   - Disponible sur `/api/docs`
   - Documentation complete avec descriptions
   - Tags par categorie (Auth, Events, Transport, etc.)

---

## Architecture Backend

```
/app/backend/
├── main.py                  # Point d'entree FastAPI avec OpenAPI
├── config.py                # Configuration DB, JWT, constantes
├── server.py                # Wrapper uvicorn
├── .env.example             # Template variables d'environnement
├── requirements.txt         # Dependances Python
├── models/                  # Modeles Pydantic
│   ├── auth.py, events.py, tickets.py, transport.py, staff.py, admin.py
├── routes/                  # Routers FastAPI
│   ├── auth.py              # /api/auth/*
│   ├── events.py            # /api/events/*
│   ├── cart.py              # /api/cart/*
│   ├── tickets.py           # /api/tickets/*
│   ├── transport.py         # /api/train/*, /api/ferry/*
│   ├── transport_organizer.py # /api/transport-organizer/*
│   ├── staff.py             # /api/staff/*
│   ├── organizer.py         # /api/organizer/*
│   └── admin.py             # /api/admin/*
└── services/                # Logique metier
    ├── auth.py              # JWT, hashing, auth dependencies
    └── pdf.py               # Generation PDF billets
```

---

## Index MongoDB

Collections indexees pour performances optimales:
- **users**: id (unique), email, phone, role
- **events**: id (unique), organizer_id, date, category
- **tickets**: id (unique), user_id, event_id, type, status, event_date, created_at
- **ferry_vehicles**: id (unique), date, destination, status
- **staff_accounts**: id (unique), username (unique), organizer_id
- **user_sessions**: session_token (unique), expires_at
- **settings**: type (unique)

---

## Planning Ferry

| Jour | Destination | Depart | Retour |
|------|-------------|--------|--------|
| Mardi | Tadjoura | 08:00 | 12:00 |
| Jeudi | Tadjoura | 13:00 | 15:00 |
| Jeudi | Obock | 09:00 | 14:00 |
| Vendredi | Tadjoura | 08:00 | 13:00 |
| Samedi | Tadjoura | 08:00 | 12:00 |
| Samedi | Obock | 08:00 | 13:00 |

**Tarifs**: 1100 FDJ/adulte, enfants <10 ans gratuit

---

## API Endpoints Principaux

### Authentication
- `POST /api/auth/login` - Connexion email
- `POST /api/auth/phone-login` - Connexion telephone
- `POST /api/auth/guest-session` - Session invitee
- `POST /api/auth/google/session` - OAuth Google

### Transport Organizer
- `GET /api/transport-organizer/ferry/dashboard` - Dashboard ferry
- `PUT /api/transport-organizer/ferry/vehicle-prices` - Maj prix vehicules
- `PUT /api/transport-organizer/ferry/settings` - Maj parametres
- `GET /api/transport-organizer/train/dashboard` - Dashboard train

### Documentation
- `GET /api/docs` - Swagger UI
- `GET /api/redoc` - ReDoc
- `GET /api/openapi.json` - Schema OpenAPI

---

## Credentials

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@dbillet.dj | admin123 |
| Organisateur | organizer@dbillet.dj | organizer123 |
| Ferry Org | ferry@dbillet.dj | ferry123 |
| Train Org | train@dbillet.dj | train123 |

---

## Backlog

### P1 (A faire)
- [ ] Tests pytest backend (couverture 80%+)
- [ ] Tests frontend Jest
- [ ] Integration paiements reels
- [ ] Notifications SMS reelles

### P2 (Planifie)
- [ ] Rate limiting middleware
- [ ] Redis caching
- [ ] GitHub Actions CI/CD
- [ ] Multi-langue (FR/SO/AR)

### P3 (Futur)
- [ ] Application mobile native
- [ ] Systeme fidelite

---

## Contact
- **Telephone**: +253 77 69 48 12
- **Email**: contact@d-billet.com

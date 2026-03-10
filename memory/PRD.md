# D-Billet - Plateforme de Billetterie Djibouti

## Probleme Original
Developper une application web moderne et responsive appelee "D-Billet" (Ticket Djibouti), une plateforme de billetterie centralisee pour Djibouti avec gestion complete pour les administrateurs et organisateurs.

## Personas Utilisateurs
- **Clients**: Achetent des billets pour evenements et transport
- **Organisateurs**: Creent evenements, gerent ventes et retraits
- **Administrateur**: Controle total de la plateforme (evenements, utilisateurs, finances, transport)
- **Staff**: Personnel de securite pour scanner les billets

## Stack Technique
- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI + PWA
- **Backend**: FastAPI (Python) - Architecture modulaire
- **Base de donnees**: MongoDB
- **Authentification**: JWT (email/mot de passe) + OTP simule

---

## Architecture Backend Refactorisee (10 Mars 2026)

Le backend a ete refactorise d'un seul fichier monolithique (`server.py` 3600+ lignes) vers une structure modulaire professionnelle:

```
/app/backend/
├── main.py              # Point d'entree FastAPI avec tous les routers
├── config.py            # Configuration (DB, JWT, constantes)
├── server.py            # Wrapper pour uvicorn
├── models/              # Modeles Pydantic
│   ├── auth.py          # UserRegister, UserLogin, TokenResponse
│   ├── events.py        # EventCreate, TicketType, PromoCode
│   ├── tickets.py       # CartItemAdd, CheckoutRequest
│   ├── transport.py     # TrainBooking, FerryBooking
│   ├── staff.py         # StaffCreate, ScanRequest
│   └── admin.py         # Testimonial, News
├── routes/              # Routers FastAPI
│   ├── auth.py          # /api/auth/* (login, register, OTP)
│   ├── events.py        # /api/events/*, /api/promo-codes/*
│   ├── cart.py          # /api/cart/*, /api/checkout
│   ├── tickets.py       # /api/tickets/*, /api/scanner/*
│   ├── transport.py     # /api/train/*, /api/ferry/*
│   ├── staff.py         # /api/staff/*, /api/organizer/staff/*
│   ├── organizer.py     # /api/organizer/*
│   └── admin.py         # /api/admin/*
└── services/            # Logique metier
    ├── auth.py          # JWT, password hashing, auth deps
    └── pdf.py           # Generation PDF billets
```

---

## Planning Ferry Mis a Jour (10 Mars 2026)

**Route**: Djibouti - Obock uniquement

| Jour | Service | Destination | Aller | Retour |
|------|---------|-------------|-------|--------|
| Lundi | Ferme | - | - | - |
| Mardi | Ferme | - | - | - |
| Mercredi | Ferme | - | - | - |
| **Jeudi** | **Oui** | **Obock** | **09:00** | **14:00** |
| Vendredi | Ferme | - | - | - |
| **Samedi** | **Oui** | **Obock** | **08:00** | **13:00** |
| Dimanche | Ferme | - | - | - |

**Prix**: 700 DJF par personne

---

## Ce qui a ete implemente

### 10 Mars 2026
- [x] **Refactoring Backend Complet**: Migration de server.py vers architecture modulaire
- [x] **Mise a jour Planning Ferry**: Djibouti/Obock Jeudi 9h/14h, Samedi 8h/13h
- [x] **README.md** mis a jour avec la nouvelle architecture
- [x] Tests valides: 83% backend, 100% frontend

### Sessions Precedentes
- [x] Dashboard Admin avec KPIs et alertes
- [x] Gestion evenements (approuver/bloquer/a la une)
- [x] Gestion utilisateurs avec commission personnalisee
- [x] Module Staff (securite) avec scanner de billets
- [x] Dashboard temps reel pour organisateurs
- [x] PWA avec theme premium or (D-BILLEH)
- [x] Reservation Train et Ferry
- [x] Billets PDF avec QR Code
- [x] Partage WhatsApp

---

## API Endpoints Principaux

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/otp/send` - Envoyer OTP
- `POST /api/auth/otp/verify` - Verifier OTP
- `GET /api/auth/me` - Profil utilisateur

### Evenements
- `GET /api/events` - Liste evenements
- `POST /api/events` - Creer evenement (organisateur)
- `GET /api/events/{id}` - Detail evenement

### Transport
- `GET /api/ferry/schedule` - Planning hebdomadaire ferry
- `GET /api/ferry/trips?date=YYYY-MM-DD` - Trajets disponibles
- `POST /api/ferry/book` - Reserver ferry
- `GET /api/train/trips?date=YYYY-MM-DD` - Trajets train
- `POST /api/train/book` - Reserver train

### Admin
- `GET /api/admin/stats` - Statistiques plateforme
- `GET /api/admin/events` - Tous les evenements
- `PUT /api/admin/transport/ferry/schedule` - Modifier planning ferry

---

## Backlog Prioritise

### P1 (Haute priorite)
- [ ] Integration reelle Waafi/D-Money (si APIs disponibles)
- [ ] Notifications email/SMS reelles
- [ ] Export Excel (en plus de CSV)

### P2 (Moyenne priorite)
- [ ] Multi-langue (francais/somali/arabe)
- [ ] Historique complet des actions admin (audit log)
- [ ] Dashboard analytics avance

### P3 (Basse priorite)
- [ ] Application mobile native
- [ ] Systeme de fidelite/points

---

## Credentials de Test

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@dbillet.dj | admin123 |
| Organisateur | organizer@dbillet.dj | organizer123 |
| Client (OTP) | +25377123456 | Code dans logs |

---

## Notes Techniques

- **Paiements**: SIMULES (Waafi, D-Money, CAC Bank)
- **OTP SMS**: SIMULE (code retourne dans API)
- **PWA**: Installable sur mobile avec theme or
- **Hot Reload**: Active pour frontend et backend

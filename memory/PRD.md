# D-Billet - Plateforme de Billetterie Djibouti

## Probleme Original
Developper une application web moderne et responsive appelee "D-Billet", une plateforme de billetterie centralisee pour Djibouti avec gestion complete pour les administrateurs, organisateurs et transport.

## Stack Technique
- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI + PWA
- **Backend**: FastAPI (Python) - Architecture modulaire
- **Base de donnees**: MongoDB
- **Authentification**: JWT + Google OAuth (Emergent Auth) + Login par telephone (sans OTP)

---

## Mise a Jour Majeure (5 Avril 2026)

### Nouvelles Fonctionnalites
- **Authentification Simplifiee**: Login par telephone sans OTP + Google OAuth
- **Guest Checkout**: Achat de billets sans inscription obligatoire
- **Planning Ferry Complet**: Tadjoura ET Obock sur plusieurs jours
- **Prix Ferry**: 1100 FDJ/adulte, enfants <10 ans gratuits
- **Reservation Vehicules**: Types de vehicules configurables pour le ferry
- **Footer Unifie**: Meme footer pour tous les ecrans
- **Contact**: +253 77 69 48 12 | contact@d-billet.com

### Planning Ferry Hebdomadaire
| Jour | Destination | Depart | Retour |
|------|-------------|--------|--------|
| Lundi | Ferme | - | - |
| **Mardi** | **Tadjoura** | **08:00** | **12:00** |
| Mercredi | Ferme | - | - |
| **Jeudi** | **Tadjoura** | **13:00** | **15:00** |
|  | **Obock** | **09:00** | **14:00** |
| **Vendredi** | **Tadjoura** | **08:00** | **13:00** |
| **Samedi** | **Tadjoura** | **08:00** | **12:00** |
|  | **Obock** | **08:00** | **13:00** |
| Dimanche | Ferme | - | - |

### Tarifs Ferry
- **Adulte**: 1100 FDJ
- **Enfant <10 ans**: Gratuit (accompagne d'un adulte)
- **Vehicules**: Prix configurables par l'organisateur

---

## Architecture Backend Modulaire

```
/app/backend/
├── main.py              # Point d'entree FastAPI
├── config.py            # Configuration DB, JWT, constantes
├── server.py            # Wrapper pour uvicorn
├── models/              # Modeles Pydantic
│   ├── auth.py          # UserRegister, UserLogin, TokenResponse
│   ├── events.py        # EventCreate, TicketType, PromoCode
│   ├── tickets.py       # CartItemAdd, CheckoutRequest
│   ├── transport.py     # TrainBooking, FerryBooking
│   ├── staff.py         # StaffCreate, ScanRequest
│   └── admin.py         # Testimonial, News
├── routes/              # Routers FastAPI
│   ├── auth.py          # /api/auth/* (login, register, phone-login, google)
│   ├── events.py        # /api/events/*, /api/promo-codes/*
│   ├── cart.py          # /api/cart/*, /api/checkout
│   ├── tickets.py       # /api/tickets/*, /api/scanner/*
│   ├── transport.py     # /api/train/*, /api/ferry/*
│   ├── staff.py         # /api/staff/*, /api/organizer/staff/*
│   ├── organizer.py     # /api/organizer/*
│   └── admin.py         # /api/admin/*
└── services/            # Logique metier
    ├── auth.py          # JWT, password hashing
    └── pdf.py           # Generation PDF billets
```

---

## Fonctionnalites Implementees

### Authentification
- [x] Login par email/mot de passe
- [x] Login par telephone (sans OTP)
- [x] Google OAuth via Emergent Auth
- [x] Guest checkout pour achats rapides
- [x] JWT avec expiration 30 jours

### Ferry
- [x] Planning hebdomadaire complet
- [x] Routes multiples par jour (Tadjoura + Obock)
- [x] Tarification: 1100 FDJ adulte, gratuit enfants <10 ans
- [x] Reservation vehicules (types configurables)
- [x] Affichage capacite restante
- [x] Notification places restantes

### Train
- [x] Regles jours pairs/impairs
- [x] Reservation passagers
- [x] Billets PDF avec QR code

### Evenements
- [x] CRUD evenements
- [x] Types de billets multiples
- [x] Codes promo
- [x] Gestion stock

### Staff
- [x] Module securite pour organisateurs
- [x] Scanner QR code mobile
- [x] Dashboard temps reel

### Admin
- [x] Dashboard KPIs
- [x] Gestion utilisateurs
- [x] Gestion transport
- [x] Parametres plateforme

---

## API Endpoints Principaux

### Authentification
- `POST /api/auth/login` - Connexion email
- `POST /api/auth/phone-login` - Connexion telephone (sans OTP)
- `POST /api/auth/guest-session` - Session invitee
- `POST /api/auth/google/session` - OAuth Google
- `GET /api/auth/me` - Profil utilisateur

### Ferry
- `GET /api/ferry/schedule` - Planning hebdomadaire
- `GET /api/ferry/trips?date=YYYY-MM-DD` - Trajets disponibles
- `POST /api/ferry/book` - Reserver ferry + vehicules
- `GET /api/ferry/vehicle-types` - Types de vehicules

### Train
- `GET /api/train/trips?date=YYYY-MM-DD` - Trajets disponibles
- `POST /api/train/book` - Reserver train

---

## Backlog Prioritise

### P1 (Haute priorite)
- [ ] Integration paiements reels (Waafi, D-Money, CAC Bank)
- [ ] Notifications SMS reelles
- [ ] Dashboard organisateur ferry/train

### P2 (Moyenne priorite)
- [ ] Multi-langue (francais/somali/arabe)
- [ ] Export Excel guestlist
- [ ] Historique audit admin

### P3 (Basse priorite)
- [ ] Application mobile native
- [ ] Systeme fidelite/points

---

## Credentials de Test

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@dbillet.dj | admin123 |
| Organisateur | organizer@dbillet.dj | organizer123 |
| Ferry Org | ferry@dbillet.dj | ferry123 |
| Train Org | train@dbillet.dj | train123 |
| Test Phone | +25377123456 | (phone login) |

---

## Notes Techniques

- **Paiements**: SIMULES (Waafi, D-Money, CAC Bank)
- **OTP SMS**: SUPPRIME - Login direct par telephone
- **Google OAuth**: Via Emergent Auth
- **PWA**: Installable sur mobile avec theme or

---

## Contact
- **Telephone**: +253 77 69 48 12
- **Email**: contact@d-billet.com
- **Adresse**: Djibouti-Ville, Republique de Djibouti

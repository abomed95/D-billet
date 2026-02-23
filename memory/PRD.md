# D-Billet - Plateforme de Billetterie Djibouti

## Problème Original
Développer une application web moderne et responsive appelée "D-Billet", une plateforme de billetterie centralisée pour Djibouti. L'application permet aux utilisateurs d'acheter des billets pour divers événements et services de transport et de recevoir un billet numérique avec QR code.

## Personas Utilisateurs
- **Utilisateurs finaux**: Résidents de Djibouti souhaitant acheter des billets pour événements et transport
- **Administrateurs**: Gestionnaires de la plateforme pour créer des événements et valider des billets
- **Organisateurs**: Créent leurs propres événements, gèrent les codes promo, voient leur dashboard

## Stack Technique
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Authentification**: JWT (email/mot de passe) + OTP simulé (téléphone)

## Catégories d'Événements
- Cinéma
- Ferry (transport)
- Football
- Train (transport)
- Concerts
- Conférences

## Méthodes de Paiement (SIMULÉES)
- Waafi (avec logo)
- D-Money (avec logo)
- CAC Bank (avec logo)

---

## Ce qui a été implémenté

### Février 2025

#### MVP Complet
- [x] Thème sombre moderne avec design glass-morphism
- [x] Authentification JWT (email/mot de passe)
- [x] Authentification OTP simulée (téléphone)
- [x] CRUD événements (admin/organisateur)
- [x] Rôles: Admin, Organisateur, User
- [x] Système de réservation Train avec logique jour pair/impair
- [x] Système de réservation Ferry avec horaires fixes
- [x] Génération de QR codes pour billets
- [x] Téléchargement PDF des billets (redesigné style Ethio-Djibouti Railway)
- [x] Dashboard admin avec statistiques et commission 8%
- [x] Dashboard organisateur avec ventes en temps réel
- [x] Scanner de billets pour validation
- [x] Codes promo pour organisateurs

### 16 Février 2026 - Dernière mise à jour
- [x] **Logos de paiement intégrés** - Waafi, D-Money, CAC Bank sur toutes les pages de paiement
- [x] **PDF ticket redesigné** - Style similaire à Ethio-Djibouti Railway avec:
  - Header vert avec logo D-BILLET
  - Zone de contenu blanche avec détails du billet
  - QR Code centré avec instruction "Scan to verify"
  - Section Payment Reference en vert clair
- [x] **Fonctionnalités Train/Ferry confirmées fonctionnelles**

#### Pages Frontend
- HomePage avec sections Transport (Train/Ferry) et Catégories
- EventDetailPage avec types de billets multiples
- TrainBookingPage avec logos de paiement
- FerryBookingPage avec logos de paiement
- AuthPage (email/password + OTP téléphone)
- CartPage
- CheckoutPage avec logos de paiement
- MyTicketsPage
- TicketViewPage avec bouton WhatsApp
- ScannerPage (app séparée pour le personnel)
- TermsPage
- Admin: Dashboard, Events, Scanner, Organizers
- Organizer: Dashboard, Events, PromoCodes

#### Logique Métier Train & Ferry

##### Train (Djibouti - Éthiopie)
- [x] Jours pairs: Départs de Nagad (vers Holl-Holl, Ali-Sabieh, Dire-Dawa)
- [x] Jours impairs: Départs d'Ali-Sabieh (vers Holl-Holl, Nagad)
- [x] 1er du mois: Jour férié - pas de service
- [x] Prix: 400 DJF (Nagad↔Holl-Holl), 800 DJF (Nagad↔Ali-Sabieh), 3200 DJF (vers Dire-Dawa)
- [x] Requiert: Passeport/CNI

##### Ferry
- [x] Mardi, Jeudi, Vendredi, Samedi: Djibouti ↔ Tadjoura
- [x] Dimanche, Mercredi: Djibouti ↔ Obock
- [x] Lundi: Pas de service
- [x] Prix: 700 DJF par trajet
- [x] Horaires: Aller 8h00, Retour 12h00

#### API Endpoints Clés
- POST /api/auth/register, /api/auth/login, /api/auth/otp/send, /api/auth/otp/verify
- GET/POST/PUT/DELETE /api/events
- GET /api/train/trips, POST /api/train/book
- GET /api/ferry/trips, POST /api/ferry/book
- GET/POST/DELETE /api/cart, POST /api/checkout
- GET /api/tickets, GET /api/tickets/{id}/view, GET /api/tickets/{id}/pdf
- POST /api/scanner/validate
- GET /api/organizer/stats, /api/organizer/events
- GET/POST/DELETE /api/promo-codes
- GET /api/admin/stats, /api/admin/organizers

---

## Backlog Prioritisé

### P0 (Urgent) - COMPLÉTÉ
- [x] Ajouter logos D-Money, Waafi et CAC Bank dans la section paiement
- [x] Redesigner le PDF ticket selon l'exemple fourni

### P1 (Haute priorité)
- [ ] Intégration réelle Waafi/D-Money (si APIs disponibles)
- [ ] Notifications SMS réelles pour OTP et confirmation

### P2 (Moyenne priorité)
- [ ] Email de confirmation de réservation
- [ ] Système de tracking des codes promo (ventes par influenceur)

### P3 (Basse priorité)
- [ ] Historique des transactions admin
- [ ] Multi-langue (français/somali/arabe)

---

## Credentials de Test
- **Admin**: admin@dbillet.dj / admin123
- **Organisateur**: organizer@dbillet.dj / organizer123
- **User (OTP)**: +25377123456 (OTP retourné dans la réponse API)

## Notes
- Les paiements sont **SIMULÉS** (pas d'intégration réelle)
- Les OTP SMS sont **SIMULÉS** (code retourné dans la réponse API)
- Base de données: MongoDB (test_database)
- Logos stockés dans: /app/frontend/public/images/

## Architecture des fichiers
```
/app/
├── backend/
│   ├── server.py (API principale)
│   └── tests/
└── frontend/
    ├── public/images/ (logos paiement)
    └── src/
        ├── pages/ (toutes les pages)
        ├── layouts/ (MainLayout, AdminLayout, OrganizerLayout)
        ├── context/ (AuthContext, CartContext)
        └── components/ui/ (Shadcn)
```

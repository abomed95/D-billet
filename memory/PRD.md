# D-Billet - Plateforme de Billetterie Djibouti

## Problème Original
Développer une application web moderne et responsive appelée "D-Billet", une plateforme de billetterie centralisée pour Djibouti. L'application permet aux utilisateurs d'acheter des billets pour divers événements et services de transport et de recevoir un billet numérique avec QR code.

## Personas Utilisateurs
- **Utilisateurs finaux**: Résidents de Djibouti souhaitant acheter des billets pour événements et transport
- **Administrateurs**: Gestionnaires de la plateforme pour créer des événements et valider des billets
- **Organisateurs**: Créent leurs propres événements, gèrent les codes promo, voient leur dashboard, gèrent leurs finances

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
- [x] Scanner de billets pour validation
- [x] Codes promo pour organisateurs

### 16 Février 2026 - Mise à jour précédente
- [x] **Logos de paiement intégrés** - Waafi, D-Money, CAC Bank sur toutes les pages de paiement
- [x] **PDF ticket redesigné** - Style similaire à Ethio-Djibouti Railway

### 27 Février 2026 - Dernière mise à jour (Dashboard Organisateur Amélioré)
- [x] **Dashboard Organisateur amélioré** avec :
  - KPIs clairs : Billets Vendus, Chiffre d'Affaires, Billets Restants, Solde Net
  - Graphique des ventes en courbe SVG (7/30 derniers jours)
  - Progression des ventes par événement
- [x] **Page Participants (Guestlist)** avec :
  - Liste complète des acheteurs
  - Barre de recherche (nom, email, téléphone)
  - Filtre par événement
  - Export CSV
  - Indicateur de statut (Valide/Utilisé)
- [x] **Page Finances & Retraits** avec :
  - KPIs financiers : Revenus Totaux, Commission 8%, Déjà Retiré, Solde Disponible
  - Historique des retraits
  - Modal de demande de retrait (D-Money, Waafi, Virement Bancaire)
  - Validation montant minimum (1000 DJF)
- [x] **Navigation sidebar mise à jour** avec 5 entrées : Dashboard, Événements, Participants, Codes Promo, Finances

#### Pages Frontend Organisateur
- /organizer - Dashboard avec KPIs et graphique
- /organizer/events - Gestion des événements
- /organizer/participants - Liste des participants (Guestlist)
- /organizer/promo-codes - Codes promo
- /organizer/finances - Finances et retraits

#### Nouveaux Endpoints API
- GET /api/organizer/sales-chart?days=7|30 - Données graphique ventes
- GET /api/organizer/participants - Liste participants
- GET /api/organizer/participants?search=... - Recherche participants
- GET /api/organizer/participants/export - Export CSV
- GET /api/organizer/finances - Résumé financier
- POST /api/organizer/withdrawals - Demande de retrait
- GET /api/organizer/withdrawals - Historique retraits

---

## Backlog Prioritisé

### P0 (Urgent) - COMPLÉTÉ
- [x] Ajouter logos D-Money, Waafi et CAC Bank dans la section paiement
- [x] Redesigner le PDF ticket selon l'exemple fourni
- [x] Dashboard Organisateur amélioré avec graphique des ventes
- [x] Page Participants avec export CSV
- [x] Page Finances avec demandes de retrait

### P1 (Haute priorité)
- [ ] Intégration réelle Waafi/D-Money (si APIs disponibles)
- [ ] Notifications SMS réelles pour OTP et confirmation
- [ ] Validation des retraits par l'admin

### P2 (Moyenne priorité)
- [ ] Email de confirmation de réservation
- [ ] Système de tracking des codes promo (ventes par influenceur)
- [ ] Export Excel en plus du CSV

### P3 (Basse priorité)
- [ ] Historique des transactions admin
- [ ] Multi-langue (français/somali/arabe)
- [ ] Mode brouillon pour événements

---

## Credentials de Test
- **Admin**: admin@dbillet.dj / admin123
- **Organisateur**: organizer@dbillet.dj / organizer123
- **User (OTP)**: +25377123456 (OTP retourné dans la réponse API)

## Notes
- Les paiements sont **SIMULÉS** (pas d'intégration réelle)
- Les OTP SMS sont **SIMULÉS** (code retourné dans la réponse API)
- Les retraits sont **SIMULÉS** (statut reste 'pending')
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
        ├── pages/
        │   ├── organizer/
        │   │   ├── OrganizerDashboard.js (KPIs + Graphique)
        │   │   ├── OrganizerEvents.js
        │   │   ├── OrganizerParticipants.js (NEW - Guestlist)
        │   │   ├── OrganizerPromoCodes.js
        │   │   └── OrganizerFinances.js (NEW - Retraits)
        │   └── ...
        ├── layouts/
        │   ├── MainLayout.js
        │   ├── AdminLayout.js
        │   └── OrganizerLayout.js (mis à jour)
        ├── context/ (AuthContext, CartContext)
        └── components/ui/ (Shadcn)
```

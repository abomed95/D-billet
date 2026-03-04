# D-Billet - Plateforme de Billetterie Djibouti

## Problème Original
Développer une application web moderne et responsive appelée "D-Billet" (Ticket Djibouti), une plateforme de billetterie centralisée pour Djibouti avec gestion complète pour les administrateurs et organisateurs.

## Personas Utilisateurs
- **Clients**: Achètent des billets pour événements et transport
- **Organisateurs**: Créent événements, gèrent ventes et retraits
- **Administrateur**: Contrôle total de la plateforme (événements, utilisateurs, finances, transport)

## Stack Technique
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Authentification**: JWT (email/mot de passe) + OTP simulé

---

## Ce qui a été implémenté

### 27 Février 2026 - Dashboard Admin Complet

#### Vue d'ensemble (Dashboard Admin)
- [x] **KPIs**: CA global, Revenus plateforme (commission 8%), Utilisateurs inscrits, Événements actifs
- [x] **Alertes Urgentes**: Événements en attente de validation, Demandes de retrait, Litiges/Remboursements
- [x] **Actions rapides** vers toutes les sections

#### Gestion des Événements
- [x] Liste de TOUS les événements créés
- [x] **Approuver/Bloquer** un événement
- [x] **Mettre "À la une"** sur la page d'accueil
- [x] Filtres par statut (Approuvés, En attente, Bloqués, À la une)
- [x] Affichage des revenus et billets vendus par événement

#### Gestion des Utilisateurs
- [x] Liste **Organisateurs** : création compte, historique, contact direct
- [x] Liste **Clients** : historique des achats
- [x] **Commission personnalisée** par organisateur (négociation grands comptes)
- [x] Filtres par rôle (Tous, Organisateurs, Clients)
- [x] Recherche par nom, email, téléphone

#### Finances & Comptabilité
- [x] **Historique des transactions** (tous les paiements Waafi/D-Money/CAC Bank)
- [x] Filtres par méthode de paiement et période
- [x] **Export CSV** des transactions
- [x] Totaux par méthode de paiement

#### Gestion des Payouts (Retraits)
- [x] Liste des demandes de retrait
- [x] **Valider** un paiement (confirmer le virement effectué)
- [x] **Rejeter** une demande avec raison
- [x] Notes admin sur chaque traitement
- [x] Stats: En attente, Complétés, Rejetés

#### Configuration (Paramètres)
- [x] **Commission globale** modifiable (défaut 8%)
- [x] **Retrait minimum** modifiable (défaut 1000 DJF)
- [x] **Catégories d'événements** : Ajouter/Supprimer (Concerts, Cinéma, Football, Théâtre...)
- [x] **Conditions Générales de Vente** (éditeur texte)
- [x] **Mentions Légales** (éditeur texte)
- [x] **Bannière d'annonce** (texte + activation)

#### Transport Train & Ferry (Exclusif Admin)
- [x] **Train** : Activation service, Heure de départ, Tarifs par trajet
- [x] **Ferry** : Activation service, Horaires aller/retour, Planning hebdomadaire
- [x] Affichage des règles de circulation (jours pairs/impairs pour train)
- [x] Prix modifiables par trajet
- [x] **NEW (4 Mars 2026)**: Gestion complète du planning hebdomadaire Ferry
  - [x] Toggle actif/inactif par jour
  - [x] Sélecteur destination (Tadjoura/Obock) par jour
  - [x] Heures de départ et retour personnalisables par jour
  - [x] Sauvegarde avec confirmation toast
- [x] **NEW (4 Mars 2026)**: Aperçu visuel du planning Ferry côté client
  - [x] API publique `GET /api/ferry/schedule`
  - [x] Affichage dynamique des 7 jours sur la page de réservation
  - [x] Horaires dynamiques utilisés dans `/api/ferry/trips`

---

### Fonctionnalités Existantes (sessions précédentes)

#### Dashboard Organisateur
- [x] KPIs : Billets vendus, CA, Billets restants, Solde net
- [x] Graphique des ventes en courbe (7/30 jours)
- [x] Liste des participants avec export CSV
- [x] Page Finances & Retraits

#### Fonctionnalités Client
- [x] Authentification (email + OTP téléphone simulé)
- [x] Réservation événements avec types de billets multiples
- [x] Réservation Train et Ferry
- [x] Panier et Checkout avec logos Waafi/D-Money/CAC Bank
- [x] Billets PDF redesignés avec QR Code
- [x] Partage WhatsApp

---

## API Endpoints Admin

### Dashboard
- `GET /api/admin/stats` - KPIs de la plateforme
- `GET /api/admin/alerts` - Alertes urgentes

### Événements
- `GET /api/admin/events` - Liste tous les événements
- `PUT /api/admin/events/{id}/status?status=approved|blocked|pending` - Modifier statut
- `PUT /api/admin/events/{id}/featured?featured=true|false` - À la une

### Utilisateurs
- `GET /api/admin/users` - Liste utilisateurs (filtres: role, search)
- `GET /api/admin/users/{id}` - Détail utilisateur avec historique
- `PUT /api/admin/users/{id}/commission?commission_rate=X` - Commission personnalisée

### Transactions
- `GET /api/admin/transactions` - Historique paiements (filtres: payment_method, days)

### Payouts
- `GET /api/admin/payouts` - Demandes de retrait (filtre: status)
- `PUT /api/admin/payouts/{id}/status?status=completed|rejected` - Valider/Rejeter

### Configuration
- `GET /api/admin/settings` - Paramètres plateforme
- `PUT /api/admin/settings` - Modifier (commission_rate, min_withdrawal, terms, banner)
- `POST /api/admin/settings/categories` - Ajouter catégorie
- `DELETE /api/admin/settings/categories/{id}` - Supprimer catégorie

### Transport
- `GET /api/admin/transport/settings` - Paramètres Train & Ferry
- `PUT /api/admin/transport/train` - Modifier Train (active, departure_time)
- `PUT /api/admin/transport/ferry` - Modifier Ferry (active, departure_time, return_time)
- `GET /api/admin/transport/ferry/schedule` - Planning hebdomadaire Ferry (7 jours) [Admin]
- `PUT /api/admin/transport/ferry/schedule` - Modifier planning hebdomadaire [Admin]
- `GET /api/ferry/schedule` - Planning hebdomadaire Ferry (7 jours) [Public]
- `GET /api/ferry/trips?date=YYYY-MM-DD` - Trajets disponibles pour une date [Public, dynamique]

---

## Pages Frontend Admin

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard avec KPIs et alertes |
| `/admin/events` | Gestion événements (approuver, bloquer, à la une) |
| `/admin/users` | Gestion utilisateurs (organisateurs, clients) |
| `/admin/transactions` | Historique des transactions |
| `/admin/payouts` | Validation des retraits |
| `/admin/settings` | Configuration plateforme |
| `/admin/transport` | Paramètres Train & Ferry |
| `/admin/scanner` | Scanner de billets |

---

## Backlog Prioritisé

### P0 (Urgent) - COMPLÉTÉ ✅
- [x] Dashboard Admin avec alertes urgentes
- [x] Gestion événements (approuver/bloquer/à la une)
- [x] Gestion utilisateurs avec commission personnalisée
- [x] Finances & Transactions
- [x] Validation des Payouts
- [x] Configuration plateforme
- [x] Paramètres Transport exclusifs admin
- [x] **Gestion planning hebdomadaire Ferry** (jours, destinations, horaires)

### P1 (Haute priorité)
- [ ] Intégration réelle Waafi/D-Money (si APIs disponibles)
- [ ] Notifications email/SMS réelles
- [ ] Export Excel (en plus de CSV)

### P2 (Moyenne priorité)
- [ ] Multi-langue (français/somali/arabe)
- [ ] Historique complet des actions admin (audit log)
- [ ] Dashboard analytics avancé

---

## Credentials de Test
- **Admin**: admin@dbillet.dj / admin123
- **Organisateur**: organizer@dbillet.dj / organizer123
- **User (OTP)**: +25377123456

## Notes
- Paiements **SIMULÉS** (Waafi, D-Money, CAC Bank)
- OTP SMS **SIMULÉ** (code retourné dans API)
- Validation des payouts **SIMULÉE** (pas de virement réel)

## Architecture des fichiers
```
/app/
├── backend/
│   └── server.py (2500+ lignes - API complète)
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/
        │   │   ├── AdminDashboard.js (KPIs + alertes)
        │   │   ├── AdminEvents.js (approuver, bloquer, à la une)
        │   │   ├── AdminUsers.js (commission personnalisée)
        │   │   ├── AdminTransactions.js (historique)
        │   │   ├── AdminPayouts.js (valider/rejeter)
        │   │   ├── AdminSettings.js (config)
        │   │   └── AdminTransport.js (train/ferry)
        │   └── organizer/ (dashboard organisateur)
        └── layouts/
            └── AdminLayout.js (navigation complète)
```

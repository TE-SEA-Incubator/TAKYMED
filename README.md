<p align="center">
  <img src="mobile/assets/images/takymed.png" alt="TAKYMED Logo" width="200" />
</p>

# 🏥 TAKYMED

**TAKYMED** est une application full-stack (Web, Mobile, Backend) conçue pour la gestion complète des pharmacies, ordonnances, rappels de prises de médicaments, et la recherche de médicaments. 
Elle offre une plateforme multi-rôles adaptée aux patients, aux professionnels de santé, et aux gestionnaires de pharmacies.

---

## 🎯 Fonctionnalités principales

- **👤 Gestion d'ordonnances intelligente** : Création d'ordonnances avec **plusieurs médicaments**, configuration des doses et durées.
- **⏰ Automatisation des rappels** : 
  - Calcul automatique des heures de prise (ex: 2x/jour = +12h, 3x/jour = +8h).
  - **Mode Manuel (Personnalisation)** : Possibilité de définir chaque heure précisément si besoin.
  - Notifications via **Push (Mobile)**, **WhatsApp**, **SMS**, et **Appels téléphoniques**.
- **📊 Système d'abonnement avancé** : 
  - Offres **Standard**, **Professionnel** et **Commercial**.
  - Gestion des demandes d'upgrade avec **motif obligatoire** et validation par l'administrateur.
- **💊 Catalogue de médicaments dynamique** : Recherche instantanée et consultation détaillée des produits (stocks, interactions, précautions).
- **🏪 Recherche de pharmacies optimisée** : 
  - Localisation des pharmacies de garde et des officines ayant le médicament recherché **en stock**.
  - Intégration Google Maps et tri par distance (formule Haversine).
- **🔐 Authentification sécurisée** : Connexion via numéro de téléphone + PIN. Procédure de **récupération de PIN par SMS**.
- **📱 Interfaces Multiplateformes** : 
  - **Web** (Dashboard complet pour les professionnels et pharmaciens).
  - **Mobile** (Application compagnon pour patients et commerciaux).

---

## 🛠️ Stack Technologique

### 💻 Frontend Web (React)
- **React 18** avec **TypeScript**.
- **Vite** comme outil de build.
- **TailwindCSS** & **shadcn/ui** pour le design.

### 📱 Frontend Mobile (Flutter)
- **Flutter 3.x** pour Android & iOS.
- **Provider** pour la gestion d'état.
- Animations fluides via `flutter_animate`.

### ⚙️ Backend (Node.js)
- **Express.js** en **TypeScript**.
- **SQLite** avec `better-sqlite3`.
- Gestion automatisée des tâches (Cron) pour les rappels.

---

## 📋 Prérequis

- **Node.js** >= 18.x
- **Flutter SDK**
- **SQLite3**

---

## 🚀 Installation et démarrage

### 1. Cloner le repository
```bash
git clone https://github.com/Archlord12345/TAKYMED.git
cd TAKYMED
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Lancer en développement
```bash
npm run dev
```

### 4. Lancer l'application Mobile
```bash
cd mobile
flutter pub get
flutter run
```

---

## 🌐 Déploiement

L'application utilise PM2 pour le maintien en ligne sur serveur Linux.
Des scripts automatisés sont disponibles :
- `./scripts/push.sh` : Envoie les modifications et reconstruit le projet sur le serveur distant.

---

## 🔐 Comptes de test

| Type | Identifiant | PIN | Rôle |
|------|-------------|-----|------|
| **Standard** | `+237 600000001` | `1234` | Patient |
| **Professionnel** | `+237 612345678` | `1234` | Médecin / Pharmacien |
| **Commercial** | `+237 655555555` | `1234` | Agent commercial |
| **Administrateur** | *Env config* | *...* | Admin système |

---

**TAKYMED** - *Votre santé entre de bonnes mains.*
Dernière mise à jour: Juin 2026

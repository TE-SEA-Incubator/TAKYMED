<p align="center">
  <img src="mobile/assets/images/takymed.png" alt="TAKYMED Logo" width="200" />
</p>

# 🏥 TAKYMED

**TAKYMED** est une application full-stack (Web, Mobile, Backend) conçue pour la gestion complète des pharmacies, ordonnances, rappels de prises de médicaments, et la recherche de médicaments. 
Elle offre une plateforme multi-rôles adaptée aux patients, aux professionnels de santé, et aux gestionnaires de pharmacies.

---

## 🎯 Fonctionnalités principales

- **👤 Gestion d'ordonnances intelligente** : Création d'ordonnances avec **plusieurs médicaments**, configuration des doses, fréquences (1x/jour, 2x/jour, au besoin, etc.) et durées de traitement.
- **⏰ Rappels de prises (Notifications Multi-Canaux)** : Planification des prises avec alertes intelligentes. Supporte les notifications via **Push (Mobile)**, **WhatsApp**, **SMS**, et **Appels téléphoniques**.
- **️ Calendrier & Suivi interactif** : Visualisation des historiques de prises, filtrage par patient (pour les médecins et commerciaux), et suivi de l'observance.
- **💊 Catalogue de médicaments dynamique** : Recherche instantanée et consultation détaillée des produits (doses, effets, précautions, catégories d'âge).
- **🏪 Administration de pharmacies** : Intégration de cartes interactives (Google Maps) et numéros de garde. Les patients peuvent facilement localiser et contacter les pharmacies ouvertes.
- **🔐 Authentification multi-rôles & Profils complets** : Connexion via numéro de téléphone + PIN. Gestion des profils utilisateurs incluant désormais des champs avancés comme l'adresse e-mail. Rôles supportés : Patients, Professionnels, Pharmaciens, Commerciaux et Administrateurs.
- **📱 Interfaces Multiplateformes** : 
  - **Web** (Dashboard complet pour les professionnels et pharmaciens).
  - **Mobile** (Application compagnon optimisée pour les patients et commerciaux).

---

## 🛠️ Stack Technologique

### 💻 Frontend Web (React)
- **React 18** avec **TypeScript** pour un typage strict et sécurisé.
- **Vite** comme outil de build ultra-rapide.
- **TailwindCSS** & **shadcn/ui** pour des interfaces modernes et responsive.
- **React Router 6** pour le routage côté client.

### 📱 Frontend Mobile (Flutter)
- **Flutter** pour les applications natives iOS et Android.
- **Provider** pour la gestion de l'état.
- Intégration API via requêtes asynchrones standard.

### ⚙️ Backend (Node.js)
- **Express.js** en **TypeScript** fournissant l'API REST globale.
- **SQLite** avec `better-sqlite3` pour une base de données embarquée rapide, sans configuration lourde.
- Synchronisation complète des types entre frontend Web et Backend via `shared/api.ts`.

---

## 📋 Prérequis

Pour exécuter ce projet localement :
- **Node.js** >= 18.x
- **npm** >= 9.x
- **Flutter SDK** (pour compiler ou lancer l'application mobile)

---

## 🚀 Installation et démarrage

### 1. Cloner le repository

```bash
git clone https://github.com/Archlord12345/TAKYMED.git
cd TAKYMED
```

### 2. Installer les dépendances (Web & Backend)

```bash
npm install
```

### 3. Lancer en développement (Web & Backend)

```bash
npm run dev
```
> L'application Web sera accessible sur `http://localhost:5173`.
> L'API REST écoutera sur `http://localhost:3000`.

### 4. Lancer l'application Mobile (Flutter)

Dans un nouveau terminal, placez-vous dans le répertoire mobile et lancez :
```bash
cd mobile
flutter pub get
flutter run
```

---

## 📖 Scripts npm disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancement local en mode watch (Frontend + Backend simultanément). |
| `npm run typecheck` | Vérification stricte TypeScript sur l'ensemble du code. |
| `npm test` | Exécution de la suite de tests unitaires et d'intégration (Vitest). |
| `npm run build` | Génération des bundles optimisés pour la production (Client + Serveur). |
| `npm run build:full` | **Build complet et sécurisé** (Exécute d'abord le typecheck et les tests avant de build). ⭐ |
| `npm start` | Démarrage du serveur compilé pour la production. |

---

## 🌐 Déploiement serveur

L'application est conçue pour fonctionner comme un serveur **Node.js unique** servant à la fois l'API et la SPA React.

1. Installez les dépendances propres à la production :
   ```bash
   npm ci
   ```
2. Compilez le projet via le script complet :
   ```bash
   npm run build:full
   ```
3. Lancez le service :
   ```bash
   npm start
   ```

*Des scripts automatisés (`scripts/deploy.sh`, `scripts/push.sh`) sont également disponibles pour automatiser les mises à jour sur votre VPS.*

---

## 🔐 Comptes de test (Auto-détection)

Le système de login détermine automatiquement votre rôle en fonction de votre numéro de téléphone.

| Type | Identifiant (Téléphone) | PIN | Rôle |
|------|--------------------------|-----|------|
| **Standard** | `+237 600000001` | `1234` | Patient (Tableau de bord patient, rappels persos) |
| **Professionnel** | `+237 612345678` | `1234` | Médecin (Création d'ordonnances pour d'autres) |
| **Pharmacien** | `+237 699999999` | `1234` | Gestionnaire de stock et d'officine |
| **Administrateur** | *Configurable via env* | *Idem* | Gestion complète de la plateforme |

---

## 📁 Structure du projet

```
TAKYMED/
├── client/              # Code source Frontend Web (React + TS)
├── server/              # Code source API Backend (Express + TS)
├── shared/              # Modèles et Types partagés (api.ts)
├── mobile/              # Code source Application Native (Flutter)
├── data/                # Fichiers d'import (CSV, etc.)
├── scripts/             # Scripts Bash d'automatisation et de déploiement
├── dist/                # Fichiers compilés (généré au build)
└── package.json
```

---

## 🤝 Contribution

1. **Fork** le repository.
2. Créez votre branche de fonctionnalité : `git checkout -b feature/ma-nouvelle-fonctionnalite`
3. Validez vos changements : `git commit -m 'Ajout d'une fonctionnalité'`
4. Poussez sur la branche : `git push origin feature/ma-nouvelle-fonctionnalite`
5. Ouvrez une **Pull Request**.

---

**TAKYMED** - *Votre santé entre de bonnes mains.*
Dernière mise à jour: Juin 2026

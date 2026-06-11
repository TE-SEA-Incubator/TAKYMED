<p align="center">
  <img src="mobile/assets/images/takymed.png" alt="TAKYMED Logo" width="200" />
</p>

# 🏥 TAKYMED - Écosystème de Santé Intelligente

**TAKYMED** est une plateforme intégrée (Full-Stack) visant à révolutionner l'observance thérapeutique et l'accès aux médicaments au Cameroun. Le projet orchestre une synergie entre patients, professionnels de santé, pharmaciens et agents commerciaux via une infrastructure robuste et évolutive.

---

## 🎯 Vision et Objectifs
Le système TAKYMED repose sur trois piliers fondamentaux :
1.  **Observance Thérapeutique** : Lutter contre l'oubli de médicaments grâce à un moteur de rappels automatisé et multi-canal.
2.  **Démocratisation de l'accès** : Localiser en temps réel les pharmacies disposant du stock exact requis via une recherche géospatiale.
3.  **Gestion Commerciale B2B2C** : Permettre aux agents commerciaux de suivre leur portefeuille de patients et de faciliter la digitalisation des prescriptions.

---

## 🏗️ Architecture du Projet

Le projet est conçu en trois couches distinctes pour assurer performance, sécurité et maintenabilité :

### 1. Couche Frontend (Multi-plateforme)
- **Web SPA (Single Page Application)** : Développée en **React 18** + **TypeScript**. Offre un tableau de bord complet aux professionnels.
- **Mobile (Native)** : Développée en **Flutter**. Offre une expérience fluide aux patients (notifications, recherche) et aux commerciaux (suivi des clients).

### 2. Couche Backend (Node.js API)
- **Serveur REST** : Basé sur **Express.js** en TypeScript. Centralise la logique métier.
- **Base de données** : **SQLite** (via `better-sqlite3`), optimisée pour des requêtes rapides et une gestion de fichiers locale.
- **Moteur de Tâches** : Système de *Cron Worker* personnalisé (géré par PM2) pour le traitement asynchrone des rappels.

### 3. Couche Infrastructure (Le Pont Web)
Pour garantir la compatibilité sur les serveurs mutualisés (où l'accès direct aux ports Node.js est souvent limité), nous utilisons un **Proxy Hybride** :
- **`public/.htaccess`** : Gère les réécritures d'URL pour que les routes React soient servies correctement par le serveur web (Apache), tout en redirigeant les requêtes `/api` vers le proxy.
- **`public/api_proxy.php`** : Agit comme une passerelle sécurisée. Le Frontend Web envoie ses requêtes à ce fichier PHP, qui les relaie vers le port Node.js interne. Cela permet de centraliser les CORS, d'ajouter des couches de sécurité supplémentaires et de masquer l'infrastructure backend.

---

## 🚀 Fonctionnalités Clés

### Automatisation des Rappels
Le système ne se contente pas de déclencher des alertes. Il calcule dynamiquement les prises :
- **Logique auto** : Saisie d'une fréquence (ex: 3 fois/jour) + heure de début = génération automatique du calendrier complet.
- **Flexibilité** : Mode manuel ("Personnalisation") pour définir des heures spécifiques hors du standard.
- **Robustesse** : Le moteur de scan vérifie quotidiennement les rappels manqués (panne, serveur éteint) et les rattrape.

### Recherche & Disponibilité
- **Tri Géospatial** : Calcul de distance réelle via formule Haversine pour localiser les pharmacies à proximité.
- **Stock Intégré** : La recherche filtre dynamiquement les pharmacies qui possèdent le médicament en stock.

### Gestion d'Abonnement
- **Workflow Admin** : Passage entre les formules (Standard, Pro, Commercial) avec soumission de motif et validation par l'administrateur.

---

## 📋 Prérequis
- **Node.js** >= 18.x
- **Flutter SDK**
- **SQLite3**
- **PM2** (pour la gestion du processus serveur)

---

## 🛠️ Installation et Démarrage

### Backend & Web
```bash
npm install
npm run dev # Développement
npm run build:full # Production
npm start # Lancement via PM2
```

### Mobile
```bash
cd mobile
flutter pub get
flutter run
```

---

## 🔐 Configuration des rôles (Auto-détection)
| Type | Identifiant (Téléphone) | PIN |
|------|--------------------------|-----|
| **Patient** | `+237 600000001` | `1234` |
| **Médecin/Pharma**| `+237 612345678` | `1234` |
| **Commercial** | `+237 655555555` | `1234` |

---

## 🤝 Contribution
Le développement suit une architecture de **modèles partagés** (`shared/api.ts`) pour garantir la cohérence des données entre le client et le serveur. Toute nouvelle fonctionnalité doit être typée et testée.

**TAKYMED** - *La technologie au service de la santé.*
Dernière mise à jour : Juin 2026

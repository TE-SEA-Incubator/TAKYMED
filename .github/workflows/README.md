# GitHub Actions — TAKYMED

Dépôt : [TE-SEA-Incubator/TAKYMED](https://github.com/TE-SEA-Incubator/TAKYMED.git)

| Workflow | Fichier | Rôle |
|----------|---------|------|
| **Build Android Release** | `build-android.yml` | APK + AAB **même version** (push `mobile/**`) |
| **Build AAB Release** | `build-aab.yml` | AAB Play Store uniquement (manuel) |
| **Build APK Release** | `build-apk.yml` | APK uniquement (manuel, legacy) |
| **Déploiement serveur** | — | **Uniquement en local** via `./scripts/push.sh` |

---

## 1. Configuration du dépôt GitHub

### Accès et remote

```bash
git remote set-url origin https://github.com/TE-SEA-Incubator/TAKYMED.git
git remote -v
```

Le compte GitHub utilisé doit avoir les droits **Write** sur l’organisation `TE-SEA-Incubator`.

### Activer GitHub Actions

1. GitHub → dépôt **TAKYMED**
2. **Settings → Actions → General**
3. **Allow all actions and reusable workflows**
4. Enregistrer

### Branche principale

La branche suivie est **`master`** (ou `main`). Les workflows APK se déclenchent sur push vers cette branche.

---

## 2. Secrets GitHub

**Aucun secret n’est requis** pour le workflow APK actuel.

Les secrets `ENV_FILE` et `SSH_PRIVATE_KEY` ne servent **plus** sur GitHub : ils restent dans votre fichier **`.env` local** pour `./scripts/push.sh`.

> Ne commitez jamais le fichier `.env`.

---

## 3. Déploiement serveur (local uniquement)

Le script `scripts/push.sh` **n’est plus exécuté par GitHub Actions**.

### Prérequis locaux

1. Copier le modèle : `cp .env.example .env`
2. Remplir `.env` (serveur, clés API, etc.)
3. Accès SSH au serveur (mot de passe dans `SERVER_PASS` ou clé SSH locale)

### Déployer

```bash
cd ~/Documents/CODES/TAKYMED/TAKYMED
./scripts/push.sh
```

Le script :
- rsync le code vers le serveur (`DEST_DIR`)
- copie le `.env` local sur le serveur
- build Node.js distant + redémarrage PM2

### Clés importantes dans `.env`

| Clé | Usage |
|-----|--------|
| `SERVER_IP` | IP / hostname SSH |
| `SERVER_USER` | Utilisateur SSH (ex. `root`) |
| `SERVER_PASS` | Mot de passe SSH (optionnel si clé SSH) |
| `DEST_DIR` | Dossier distant (ex. `/home/TAKYMED`) |
| `PORT` | Port API (ex. `3500`) |
| `DOMAIN` | Domaine (ex. `dev.takymed.com`) |
| `GEMINI_API_KEY` | Recherche IA médicaments |

---

## 4. Builds Android (APK / AAB)

### Version automatique (source unique)

Fichier : `mobile/pubspec.yaml` → `version: X.Y.Z+N`

| Champ | Usage |
|-------|--------|
| `X.Y.Z` | versionName (affichée utilisateur, GitHub, écran Paramètres) |
| `N` | versionCode Android (Play Store, interne — non affiché) |

Script : `scripts/bump-mobile-version.mjs` — incrémente patch **et** build (+1) à chaque bump.

Lecture : `scripts/read-mobile-version.mjs --display` → `1.0.3` (GitHub Artifacts, résumés CI).  
Le suffixe `+N` reste interne (versionCode Play Store).

### Scripts npm locaux

| Commande | Effet |
|----------|--------|
| `npm run mobile:bump` | Incrémente la version dans `pubspec.yaml` |
| `npm run apk` | Bump + APK → `takymed.apk` |
| `npm run aab` | Bump + AAB → `takymed.aab` |
| `npm run mobile:release` | **Un seul bump** + APK + AAB (versions synchronisées) |

```bash
# Play Store uniquement
npm run aab

# APK + AAB même version (recommandé avant publication)
npm run mobile:release
```

### Workflow principal : `build-android.yml`

**Déclencheurs** : push sur `master` / `main` si `mobile/**` modifié, ou manuel.

**Artifacts** (même numéro de version affichée) :
- `takymed-apk-X.Y.Z.zip` → `takymed.apk`
- `takymed-aab-X.Y.Z.zip` → `takymed.aab` (Google Play Console)

### Workflow AAB seul : `build-aab.yml`

- Manuel : **Actions → Build AAB Release (Play Store) → Run workflow**
- Équivalent à `npm run aab` (bump + build)

### Workflow APK seul : `build-apk.yml`

- Manuel uniquement (legacy)
- Équivalent à `npm run apk`

### Google Play Console

1. Télécharger `takymed.aab` depuis les Artifacts GitHub (ou `npm run aab` / `mobile:release` en local)
2. Play Console → votre app → **Production** (ou test interne)
3. **Créer une version** → importer l'AAB

> **Signature** : le build release utilise encore la clé debug (`build.gradle.kts`). Pour la production Play Store, configurez un keystore release (variables `ANDROID_KEYSTORE_*` ou `key.properties`).

---

## 5. Ancienne section APK (référence)

### Récupérer l’APK

1. GitHub → **Actions**
2. Run **Build Android Release** (statut vert)
3. Artifacts → `takymed-apk-X.Y.Z.zip`

---

## 6. Pousser le code sur GitHub

```bash
git add .
git commit -m "votre message"
git fetch origin
git pull origin master    # synchroniser avec le distant
git push origin master
```

En cas de `403 Permission denied` : demander l’accès Write à un admin de `TE-SEA-Incubator`, ou utiliser un PAT / SSH.

---

## 7. Checklist

```
□ Remote origin → TE-SEA-Incubator/TAKYMED
□ Actions activées sur le dépôt
□ .env local rempli (pour push.sh uniquement)
□ git push origin master
□ Déploiement : ./scripts/push.sh en local
□ Android : Actions → Build Android Release → Artifacts (APK + AAB)
□ Play Store : importer takymed.aab depuis Artifacts
```

---

## 8. Dépannage

### Push refusé (403)
→ Droits Write manquants sur le dépôt ou mauvais compte GitHub.

### `./scripts/push.sh` échoue
→ Vérifier `SERVER_IP`, SSH, et `curl http://DOMAIN:PORT/api/ping` après deploy.

### Build APK échoue
→ Consulter les logs dans l’onglet Actions ; tester `flutter doctor -v` en local.

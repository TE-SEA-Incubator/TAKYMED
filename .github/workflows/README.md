# GitHub Actions — TAKYMED

Deux workflows séparés pour le dépôt [TE-SEA-Incubator/TAKYMED](https://github.com/TE-SEA-Incubator/TAKYMED.git) :

| Workflow | Fichier | Rôle |
|----------|---------|------|
| **Deploy (push.sh)** | `deploy.yml` | Déploie le serveur web/API via `scripts/push.sh` |
| **Build APK Release** | `build-apk.yml` | Build l’APK Android (`npm run apk`) et la met en artifact |

---

## 1. Configuration GitHub (obligatoire)

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → Secrets**

### Secret principal : `ENV_FILE`

**Un seul secret** contient **tout** le contenu de votre fichier `.env` (ligne par ligne).

1. Ouvrez votre `.env` local (ou copiez depuis `.env.example`)
2. Remplissez toutes les valeurs (serveur, clés API, etc.)
3. Copiez **l’intégralité** du fichier
4. GitHub → **New repository secret** → nom : `ENV_FILE` → collez le contenu

Exemple minimal :

```env
SERVER_IP=82.165.150.150
SERVER_USER=root
SERVER_PASS=votre_mot_de_passe_ssh
DEST_DIR=/home/TAKYMED
PORT=3500
DOMAIN=dev.takymed.com
PING_MESSAGE="TAKYMED API is running"
DB_PATH=./bd.sqlite
NODE_ENV=production
GEMINI_API_KEY=votre_cle_gemini
```

> **Important :** utilisez un **Secret** (pas une Variable). Les Variables GitHub sont visibles en clair dans l’interface ; le `.env` contient des mots de passe et clés API.

Le workflow écrit ce contenu dans `.env` avant le déploiement, puis `push.sh` le copie sur le serveur.

### Secret SSH (recommandé en plus de ENV_FILE)

| Nom | Obligatoire | Description |
|-----|-------------|-------------|
| `SSH_PRIVATE_KEY` | Recommandé | Clé privée SSH (`-----BEGIN ... KEY-----`) |

Authentification SSH :
- **Recommandé :** `SSH_PRIVATE_KEY` + `SERVER_IP` / `SERVER_USER` dans `ENV_FILE`
- **Alternative :** `SERVER_PASS` dans `ENV_FILE` (sans clé SSH)

---

## 2. Préparer le serveur (une seule fois)

### Générer une clé SSH pour GitHub Actions

```bash
ssh-keygen -t ed25519 -C "github-actions-takymed" -f ~/.ssh/takymed-gha -N ""
ssh-copy-id -i ~/.ssh/takymed-gha.pub root@82.165.150.150
cat ~/.ssh/takymed-gha   # → secret SSH_PRIVATE_KEY
```

Le serveur doit avoir Node.js 20+ et PM2. Le `.env` est **déployé automatiquement** à chaque run via le secret `ENV_FILE`.

---

## 3. Workflow Deploy (`deploy.yml`)

**Déclencheurs :**
- Push sur `main` ou `master`
- Lancement manuel : **Actions → Deploy (push.sh) → Run workflow**

**Ce qu’il fait :**
1. Reconstruit `.env` depuis le secret `ENV_FILE`
2. Connexion SSH au serveur
3. `scripts/push.sh` : rsync code, copie `.env`, build distant, PM2, health check

**Clés lues depuis `ENV_FILE` :**

| Clé `.env` | Usage |
|------------|--------|
| `SERVER_IP` | IP / hostname SSH |
| `SERVER_USER` | Utilisateur SSH |
| `SERVER_PASS` | Mot de passe SSH (si pas de clé) |
| `DEST_DIR` | Dossier distant (`/home/TAKYMED`) |
| `PORT` | Port API Node |
| `DOMAIN` | Domaine (logs + health check) |
| `GEMINI_API_KEY`, etc. | Config application sur le serveur |

---

## 4. Workflow Build APK (`build-apk.yml`)

**Déclencheurs :**
- Push sur `main` / `master` si fichiers `mobile/**` modifiés
- Lancement manuel : **Actions → Build APK Release → Run workflow**

**Ce qu’il fait :**
1. Installe Node.js, Java 17, Flutter stable
2. Lance `npm run apk` (incrémente la version + build release)
3. Publie `takymed.apk` en **artifact** téléchargeable

### Récupérer l’APK

1. GitHub → **Actions**
2. Run **Build APK Release** (verte)
3. **Artifacts** → `takymed-apk-X.Y.Z+N.zip` → `takymed.apk`

### Version automatique (patch)

Version de départ : **`1.0.0+1`**

Chaque build (`npm run apk` ou CI) incrémente le **patch** :

| Build | Version affichée | Build Android |
|-------|------------------|---------------|
| 1 | `1.0.0+1` | 1 |
| 2 | `1.0.1+2` | 2 |
| 3 | `1.0.2+3` | 3 |
| … | `1.0.3+4` | … |

> La version bumpée en CI n’est pas commitée automatiquement. Pour la persister : `npm run apk` en local puis commitez `mobile/pubspec.yaml`.

---

## 5. Checklist rapide

```
□ Secret ENV_FILE = contenu complet du .env
□ Secret SSH_PRIVATE_KEY (recommandé)
□ Clé publique SSH sur le serveur
□ Push sur master → Deploy vert
□ mobile/ modifié → Build APK + artifact
```

---

## 6. Déclenchement manuel

| Action | Chemin GitHub |
|--------|---------------|
| Déployer | Actions → **Deploy (push.sh)** → Run workflow |
| Builder APK | Actions → **Build APK Release** → Run workflow |

---

## 7. Dépannage

### `ENV_FILE manquant`
→ Ajoutez le secret dans **Settings → Secrets → Actions**

### SSH / Deploy
- Vérifier `SERVER_IP` et `SERVER_USER` dans `ENV_FILE`
- Tester : `ssh -i ~/.ssh/takymed-gha root@IP`

### Health check échoue
- `PORT=3500` dans `ENV_FILE`
- `curl http://DOMAIN:3500/api/ping`
- Logs : `pm2 logs takymed`

### Build APK échoue
- Logs Flutter dans Actions
- `flutter doctor -v` en local

### Déploiement manuel de secours

```bash
./scripts/push.sh   # lit votre .env local
```

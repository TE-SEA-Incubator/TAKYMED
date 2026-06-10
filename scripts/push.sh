#!/bin/bash

# Configuration (Loads from .env)
if [ -f .env ]; then
    # Load .env variables without leaking everything to xargs
    export $(grep -v '^#' .env | sed 's/\r$//' | xargs)
fi

# Fallback values if not in .env
REMOTE_USER=${SERVER_USER:-"root"}
REMOTE_HOST=${SERVER_IP:-"localhost"}
REMOTE_DIR=${DEST_DIR:-"/home/TAKYMED"}
SOURCE_DIR="$(pwd)"
PORT=${PORT:-3500}
PASS=${SERVER_PASS:-""}

# SSH Control socket for persistent connection
CONTROL_SOCKET="/tmp/ssh-takymed-push-$USER"

# SSH/RSYNC configurations with ControlMaster for single auth
SSH_OPT="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=auto -o ControlPath=$CONTROL_SOCKET -o ControlPersist=60"

if [ -n "$PASS" ]; then
    export SSHPASS="$PASS"
    SSH_CMD="sshpass -e ssh $SSH_OPT"
    RSYNC_SSH="sshpass -e ssh $SSH_OPT"
else
    SSH_CMD="ssh $SSH_OPT"
    RSYNC_SSH="ssh $SSH_OPT"
fi

echo "📤 Pushing updates to $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR (preserving DB, uploads, and WhatsApp config)..."

# Start SSH control master (single auth for entire session)
echo "� Establishing SSH connection..."
$SSH_CMD -f $REMOTE_USER@$REMOTE_HOST "exit" 2>/dev/null || true

# Cleanup function
cleanup() {
    echo "🧹 Closing SSH connection..."
    ssh -o ControlPath=$CONTROL_SOCKET -O exit $REMOTE_USER@$REMOTE_HOST 2>/dev/null || true
    rm -f "$CONTROL_SOCKET"
}
trap cleanup EXIT

# 1. Ensure remote directory structure
echo "🛠️ Preparing remote directory..."
$SSH_CMD $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/public/uploads && chown -R $REMOTE_USER:$REMOTE_USER $REMOTE_DIR" || { echo "❌ Failed to prepare remote directory."; exit 1; }

# 2. Sync code (without dist, will build on server)
echo "📦 Syncing files..."
rsync -av -e "$RSYNC_SSH" --progress "$SOURCE_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/" \
    --exclude 'mobile' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude '.vscode' \
    --exclude '.gemini' \
    --exclude 'bd.sqlite*' \
    --exclude '.env' \
    --exclude '/data/auth_info_baileys/***' \
    --exclude 'data/auth_info_baileys/***' \
    --exclude '/data/wa_backups/***' \
    --exclude 'data/wa_backups/***' \
    --exclude 'public/uploads/*' || { echo "❌ File synchronization failed."; exit 1; }

# 2.5 Sync .env (local ou généré par GitHub Actions via secret ENV_FILE)
if [ -f "$SOURCE_DIR/.env" ]; then
    echo "🔐 Syncing .env to remote..."
    rsync -av -e "$RSYNC_SSH" "$SOURCE_DIR/.env" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env" \
        || { echo "❌ .env synchronization failed."; exit 1; }
    $SSH_CMD $REMOTE_USER@$REMOTE_HOST "chmod 600 $REMOTE_DIR/.env" || true
fi

# 2.6 Sync SQL Data and Import
if [ -f "$SOURCE_DIR/pharmacies_cameroun.sql" ]; then
    echo "🗄️ Syncing and importing pharmacy data..."
    rsync -av -e "$RSYNC_SSH" "$SOURCE_DIR/pharmacies_cameroun.sql" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/pharmacies_cameroun.sql"

    $SSH_CMD $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && sqlite3 bd.sqlite < pharmacies_cameroun.sql" \
        || { echo "❌ Database import failed."; exit 1; }
fi

# 2.7 Sync SSL Certificates
if [ -d "$SOURCE_DIR/server/cert" ]; then
    echo "🔐 Syncing SSL certificates..."
    rsync -av -e "$RSYNC_SSH" "$SOURCE_DIR/server/cert/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server/cert/" \
        || { echo "❌ Certificate synchronization failed."; exit 1; }
    $SSH_CMD $REMOTE_USER@$REMOTE_HOST "chmod 600 $REMOTE_DIR/server/cert/*.key" || true
fi

# 3. Build on Remote

echo "⚙️ Building on remote server..."

$SSH_CMD $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && \
    NODE_VER=\$(node -v | cut -d. -f1 | sed 's/v//') && \
    if [ \"\$NODE_VER\" -lt 20 ]; then \
        echo \"⚠️ Node.js version too old (\$NODE_VER). Updating to Node 22...\" && \
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; \
    fi && \
    if ! command -v pm2 &> /dev/null; then \
        echo \"📦 Installing PM2 globally...\" && \
        npm install -g pm2; \
    fi && \
    npm install && npm run build" || { echo "❌ Remote build failed."; exit 1; }

# 4. Restart the application with PM2
echo "🔄 Restarting application with PM2..."
$SSH_CMD $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && \
    pm2 stop takymed-backend 2>/dev/null || true && \
    pm2 delete takymed-backend 2>/dev/null || true && \
    pm2 restart takymed --update-env || (PORT=$PORT pm2 start dist/server/node-build.mjs --name takymed) && \
    pm2 save" || { echo "❌ Failed to restart application with PM2."; exit 1; }

# 5. Health Check
echo "🔍 Performing health check..."
MAX_RETRIES=5
RETRY_COUNT=0
HEALTH_PASSED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Wait for server to start... (Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 5
    RESPONSE=$(curl -s http://$REMOTE_HOST:$PORT/api/ping || echo "")
    if [[ "$RESPONSE" == *"message"* ]]; then
        echo "✅ Health check passed! Application is responding with data."
        HEALTH_PASSED=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$HEALTH_PASSED" = false ]; then
    echo "⚠️  Health check failed after $MAX_RETRIES attempts."
    exit 1
fi

echo "🚀 Push complete. Application is running on http://${DOMAIN:-$REMOTE_HOST}:$PORT"

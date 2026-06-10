#!/bin/bash
# Script pour exporter tout le contenu de la base de données SQLite du serveur
# Utilisation : ./scripts/bd.sh

REMOTE_USER="root"
REMOTE_HOST="82.165.150.150"
REMOTE_DB_PATH="/home/TAKYMED/bd.sqlite"
LOCAL_EXPORT_PATH="./bd_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "📥 Exporting database from $REMOTE_HOST..."

ssh $REMOTE_USER@$REMOTE_HOST "sqlite3 $REMOTE_DB_PATH .dump" > "$LOCAL_EXPORT_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Database exported successfully to: $LOCAL_EXPORT_PATH"
else
    echo "❌ Failed to export database."
    exit 1
fi

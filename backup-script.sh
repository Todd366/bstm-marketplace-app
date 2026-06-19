#!/bin/bash

# BSTM Database Backup Script
# Run daily via cron: 0 2 * * * /path/to/backup-script.sh

# Configuration
SUPABASE_PROJECT_ID="YOUR_PROJECT_ID"
SUPABASE_DB_PASSWORD="YOUR_DB_PASSWORD"
BACKUP_DIR="/var/backups/bstm"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="bstm_backup_${DATE}.sql"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Dump database
echo "Starting backup at $(date)"
pg_dump "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres" > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Delete backups older than 30 days
find $BACKUP_DIR -name "bstm_backup_*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" s3://bstm-backups/

echo "Backup completed: ${BACKUP_FILE}.gz"

# Send notification
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  -d text="✅ BSTM database backup completed: ${BACKUP_FILE}.gz"

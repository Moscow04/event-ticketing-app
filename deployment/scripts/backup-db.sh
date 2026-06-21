#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Database Backup Script - run via cron
# Example cron: 0 3 * * * /opt/eventtix/deployment/scripts/backup-db.sh
# ============================================================

BACKUP_DIR="/opt/eventtix/backups"
RETENTION_DAYS=30
DB_NAME="event_ticketing"
DB_USER="postgres"
DB_PASSWORD="${DB_PASSWORD:-}"

mkdir -p "${BACKUP_DIR}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

export PGPASSWORD="${DB_PASSWORD}"

pg_dump -h localhost -U "${DB_USER}" "${DB_NAME}" | gzip > "${FILENAME}"

# Keep only last 30 days
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup saved: ${FILENAME} ($(du -h "${FILENAME}" | cut -f1))"

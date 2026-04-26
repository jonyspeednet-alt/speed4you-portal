#!/bin/bash

# Database backup script for ISP Entertainment Portal
# This script creates a compressed PostgreSQL backup

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DB_NAME="${DB_NAME:-isp_entertainment}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "Error: pg_dump is not installed or not in PATH"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Create the backup
echo "Starting database backup..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_DIR/backup_$DATE.dump"
echo ""

pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f "$BACKUP_DIR/backup_$DATE.dump"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backup completed successfully!"
    echo "📁 Backup file: $BACKUP_DIR/backup_$DATE.dump"
    
    # Show backup file size
    if command -v du &> /dev/null; then
        SIZE=$(du -h "$BACKUP_DIR/backup_$DATE.dump" | cut -f1)
        echo "📊 Backup size: $SIZE"
    fi
    
    echo ""
    echo "To restore this backup, use:"
    echo "pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c --if-exists $BACKUP_DIR/backup_$DATE.dump"
else
    echo ""
    echo "❌ Backup failed!"
    echo "Please check the database connection and credentials"
    exit 1
fi
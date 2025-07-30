#!/bin/bash

# CouchDB Backup Script
# This script creates a backup of the CouchDB database

set -e

# Configuration
COUCHDB_URL="${COUCHDB_URL:-http://localhost:5984}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="couchdb_backup_${TIMESTAMP}.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    local deps=("curl" "jq" "tar")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "$dep is required but not installed"
            exit 1
        fi
    done
}

# Check CouchDB connection
check_couchdb_connection() {
    log "Checking CouchDB connection..."
    if ! curl -s -f -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/_up" > /dev/null; then
        error "Cannot connect to CouchDB at ${COUCHDB_URL}"
        exit 1
    fi
    log "CouchDB connection successful"
}

# Get list of databases
get_databases() {
    log "Getting list of databases..."
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/_all_dbs" | jq -r '.[]' | grep -v '^_'
}

# Backup a single database
backup_database() {
    local db_name="$1"
    local backup_path="$2"
    
    log "Backing up database: ${db_name}"
    
    # Create database directory
    mkdir -p "${backup_path}/${db_name}"
    
    # Get database info
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/${db_name}" > "${backup_path}/${db_name}/db_info.json"
    
    # Get all documents
    local all_docs_url="${COUCHDB_URL}/${db_name}/_all_docs?include_docs=true&attachments=true"
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${all_docs_url}" > "${backup_path}/${db_name}/all_docs.json"
    
    # Get design documents separately
    local design_docs_url="${COUCHDB_URL}/${db_name}/_all_docs?startkey=\"_design/\"&endkey=\"_design0\"&include_docs=true"
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${design_docs_url}" > "${backup_path}/${db_name}/design_docs.json"
    
    log "Database ${db_name} backed up successfully"
}

# Main backup function
main() {
    log "Starting CouchDB backup process..."
    
    # Check dependencies
    check_dependencies
    
    # Check CouchDB connection
    check_couchdb_connection
    
    # Create backup directory
    mkdir -p "${BACKUP_DIR}"
    local temp_backup_dir="${BACKUP_DIR}/temp_${TIMESTAMP}"
    mkdir -p "${temp_backup_dir}"
    
    # Get databases and backup each one
    local databases
    databases=$(get_databases)
    
    if [ -z "$databases" ]; then
        warn "No user databases found to backup"
    else
        for db in $databases; do
            backup_database "$db" "$temp_backup_dir"
        done
    fi
    
    # Create metadata file
    cat > "${temp_backup_dir}/backup_metadata.json" << EOF
{
    "timestamp": "${TIMESTAMP}",
    "couchdb_url": "${COUCHDB_URL}",
    "backup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "databases": $(echo "$databases" | jq -R -s -c 'split("\n") | map(select(length > 0))')
}
EOF
    
    # Create compressed archive
    log "Creating compressed backup archive..."
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_FILE}" -C "temp_${TIMESTAMP}" .
    
    # Clean up temporary directory
    rm -rf "temp_${TIMESTAMP}"
    
    # Get backup file size
    local backup_size
    backup_size=$(du -h "${BACKUP_FILE}" | cut -f1)
    
    log "Backup completed successfully!"
    log "Backup file: ${BACKUP_DIR}/${BACKUP_FILE}"
    log "Backup size: ${backup_size}"
    
    # Optional: Remove old backups (keep last 7 days)
    if [ "${CLEANUP_OLD_BACKUPS:-true}" = "true" ]; then
        log "Cleaning up old backups (keeping last 7 days)..."
        find "${BACKUP_DIR}" -name "couchdb_backup_*.tar.gz" -type f -mtime +7 -delete
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "CouchDB Backup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Environment variables:"
        echo "  COUCHDB_URL      CouchDB URL (default: http://localhost:5984)"
        echo "  COUCHDB_USER     CouchDB username (default: admin)"
        echo "  COUCHDB_PASSWORD CouchDB password (required)"
        echo "  BACKUP_DIR       Backup directory (default: ./backups)"
        echo "  CLEANUP_OLD_BACKUPS  Clean up old backups (default: true)"
        echo ""
        echo "Example:"
        echo "  COUCHDB_PASSWORD=mypassword $0"
        exit 0
        ;;
    *)
        if [ -z "$COUCHDB_PASSWORD" ]; then
            error "COUCHDB_PASSWORD environment variable is required"
            exit 1
        fi
        main
        ;;
esac
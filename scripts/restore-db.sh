#!/bin/bash

# CouchDB Restore Script
# This script restores a CouchDB database from a backup

set -e

# Configuration
COUCHDB_URL="${COUCHDB_URL:-http://localhost:5984}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD}"
BACKUP_FILE="${1}"

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

# Show usage
show_usage() {
    echo "CouchDB Restore Script"
    echo ""
    echo "Usage: $0 <backup_file.tar.gz> [options]"
    echo ""
    echo "Options:"
    echo "  --force          Force restore even if databases exist"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  COUCHDB_URL      CouchDB URL (default: http://localhost:5984)"
    echo "  COUCHDB_USER     CouchDB username (default: admin)"
    echo "  COUCHDB_PASSWORD CouchDB password (required)"
    echo ""
    echo "Example:"
    echo "  COUCHDB_PASSWORD=mypassword $0 ./backups/couchdb_backup_20240101_120000.tar.gz"
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

# Extract backup file
extract_backup() {
    local backup_file="$1"
    local extract_dir="$2"
    
    log "Extracting backup file: ${backup_file}"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: ${backup_file}"
        exit 1
    fi
    
    mkdir -p "$extract_dir"
    tar -xzf "$backup_file" -C "$extract_dir"
    
    log "Backup extracted to: ${extract_dir}"
}

# Check if database exists
database_exists() {
    local db_name="$1"
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/${db_name}" > /dev/null 2>&1
}

# Create database
create_database() {
    local db_name="$1"
    
    log "Creating database: ${db_name}"
    
    local response
    response=$(curl -s -X PUT -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/${db_name}")
    
    if echo "$response" | jq -e '.ok' > /dev/null; then
        log "Database ${db_name} created successfully"
    else
        error "Failed to create database ${db_name}: ${response}"
        return 1
    fi
}

# Delete database
delete_database() {
    local db_name="$1"
    
    warn "Deleting existing database: ${db_name}"
    
    local response
    response=$(curl -s -X DELETE -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/${db_name}")
    
    if echo "$response" | jq -e '.ok' > /dev/null; then
        log "Database ${db_name} deleted successfully"
    else
        error "Failed to delete database ${db_name}: ${response}"
        return 1
    fi
}

# Restore database documents
restore_database_documents() {
    local db_name="$1"
    local backup_dir="$2"
    
    log "Restoring documents for database: ${db_name}"
    
    local all_docs_file="${backup_dir}/${db_name}/all_docs.json"
    
    if [ ! -f "$all_docs_file" ]; then
        warn "No documents file found for database: ${db_name}"
        return 0
    fi
    
    # Extract documents and prepare for bulk insert
    local docs_json
    docs_json=$(jq '.rows | map(.doc | select(._id | startswith("_design/") | not))' "$all_docs_file")
    
    if [ "$docs_json" = "[]" ]; then
        log "No regular documents to restore for database: ${db_name}"
    else
        # Create bulk docs payload
        local bulk_payload
        bulk_payload=$(echo "$docs_json" | jq '{docs: .}')
        
        # Post bulk documents
        local response
        response=$(curl -s -X POST -H "Content-Type: application/json" \
            -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
            -d "$bulk_payload" \
            "${COUCHDB_URL}/${db_name}/_bulk_docs")
        
        # Check for errors
        local errors
        errors=$(echo "$response" | jq '[.[] | select(.error)]')
        
        if [ "$errors" != "[]" ]; then
            warn "Some documents failed to restore: ${errors}"
        else
            log "Regular documents restored successfully for database: ${db_name}"
        fi
    fi
    
    # Restore design documents separately
    local design_docs_file="${backup_dir}/${db_name}/design_docs.json"
    
    if [ -f "$design_docs_file" ]; then
        local design_docs
        design_docs=$(jq '.rows | map(.doc)' "$design_docs_file")
        
        if [ "$design_docs" != "[]" ]; then
            local design_bulk_payload
            design_bulk_payload=$(echo "$design_docs" | jq '{docs: .}')
            
            local design_response
            design_response=$(curl -s -X POST -H "Content-Type: application/json" \
                -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
                -d "$design_bulk_payload" \
                "${COUCHDB_URL}/${db_name}/_bulk_docs")
            
            local design_errors
            design_errors=$(echo "$design_response" | jq '[.[] | select(.error)]')
            
            if [ "$design_errors" != "[]" ]; then
                warn "Some design documents failed to restore: ${design_errors}"
            else
                log "Design documents restored successfully for database: ${db_name}"
            fi
        fi
    fi
}

# Restore a single database
restore_database() {
    local db_name="$1"
    local backup_dir="$2"
    local force="$3"
    
    log "Restoring database: ${db_name}"
    
    # Check if database exists
    if database_exists "$db_name"; then
        if [ "$force" = "true" ]; then
            delete_database "$db_name"
            create_database "$db_name"
        else
            error "Database ${db_name} already exists. Use --force to overwrite."
            return 1
        fi
    else
        create_database "$db_name"
    fi
    
    # Restore documents
    restore_database_documents "$db_name" "$backup_dir"
    
    log "Database ${db_name} restored successfully"
}

# Main restore function
main() {
    local backup_file="$1"
    local force="$2"
    
    if [ -z "$backup_file" ]; then
        error "Backup file is required"
        show_usage
        exit 1
    fi
    
    log "Starting CouchDB restore process..."
    
    # Check dependencies
    check_dependencies
    
    # Check CouchDB connection
    check_couchdb_connection
    
    # Create temporary directory for extraction
    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT
    
    # Extract backup
    extract_backup "$backup_file" "$temp_dir"
    
    # Read backup metadata
    local metadata_file="${temp_dir}/backup_metadata.json"
    if [ -f "$metadata_file" ]; then
        log "Backup metadata:"
        jq . "$metadata_file"
        
        # Get list of databases from metadata
        local databases
        databases=$(jq -r '.databases[]' "$metadata_file")
        
        # Restore each database
        for db in $databases; do
            restore_database "$db" "$temp_dir" "$force"
        done
    else
        warn "No backup metadata found, attempting to restore all found databases..."
        
        # Find all database directories
        for db_dir in "$temp_dir"/*; do
            if [ -d "$db_dir" ]; then
                local db_name
                db_name=$(basename "$db_dir")
                restore_database "$db_name" "$temp_dir" "$force"
            fi
        done
    fi
    
    log "Restore completed successfully!"
}

# Parse command line arguments
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        -*)
            error "Unknown option $1"
            show_usage
            exit 1
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                error "Multiple backup files specified"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Check required parameters
if [ -z "$COUCHDB_PASSWORD" ]; then
    error "COUCHDB_PASSWORD environment variable is required"
    exit 1
fi

if [ -z "$BACKUP_FILE" ]; then
    error "Backup file is required"
    show_usage
    exit 1
fi

# Run main function
main "$BACKUP_FILE" "$FORCE"
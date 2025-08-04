#!/bin/bash
# scripts/create-backup.sh - Automated backup system

set -e

# Configuration
BACKUP_ROOT="backups"
MAX_BACKUPS=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S'): $1"
}

create_system_backup() {
    local backup_type="${1:-scheduled}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_ROOT/system/$timestamp"
    
    log "${BLUE}📦 Creating system backup: $backup_dir${NC}"
    mkdir -p "$backup_dir"
    
    # Backup code (excluding build artifacts and dependencies)
    log "💾 Backing up source code..."
    tar --exclude='node_modules' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='.turbo' \
        --exclude='coverage' \
        --exclude='playwright-report' \
        --exclude='test-results' \
        --exclude='.swc' \
        --exclude='tmp' \
        --exclude='logs' \
        --exclude='incidents' \
        --exclude='backups' \
        -czf "$backup_dir/code.tar.gz" \
        apps/ packages/ backend/ scripts/ shared/ services/ \
        *.json *.yml *.yaml *.md *.js *.ts Dockerfile* .env* .git* 2>/dev/null || {
        log "${YELLOW}⚠️ Some files could not be backed up, continuing...${NC}"
    }
    
    # Backup configuration files
    log "⚙️ Backing up configuration..."
    cp .env "$backup_dir/" 2>/dev/null || log "No .env file found"
    cp .env.example "$backup_dir/" 2>/dev/null || true
    cp .env.production.example "$backup_dir/" 2>/dev/null || true
    cp docker-compose.yml "$backup_dir/" 2>/dev/null || true
    cp docker-compose.*.yml "$backup_dir/" 2>/dev/null || true
    cp -r .kiro "$backup_dir/" 2>/dev/null || log "No .kiro directory found"
    
    # Backup database
    log "🗄️ Backing up database..."
    if docker compose ps postgres | grep -q "Up"; then
        if docker compose exec postgres pg_dump -U app app > "$backup_dir/database.sql" 2>/dev/null; then
            log "${GREEN}✅ Database backup completed${NC}"
        else
            log "${YELLOW}⚠️ Database backup failed, continuing...${NC}"
            echo "-- Database backup failed at $(date)" > "$backup_dir/database.sql"
        fi
    else
        log "${YELLOW}⚠️ PostgreSQL not running, skipping database backup${NC}"
        echo "-- PostgreSQL not running during backup" > "$backup_dir/database.sql"
    fi
    
    # Backup media files
    log "🖼️ Backing up media files..."
    if docker compose ps media | grep -q "Up"; then
        if docker compose exec media tar -czf - /data/media 2>/dev/null > "$backup_dir/media.tar.gz"; then
            log "${GREEN}✅ Media files backup completed${NC}"
        else
            log "${YELLOW}⚠️ Media files backup failed or no files found${NC}"
            touch "$backup_dir/media.tar.gz"
        fi
    else
        log "${YELLOW}⚠️ Media service not running, skipping media backup${NC}"
        touch "$backup_dir/media.tar.gz"
    fi
    
    # Backup Docker images (optional, for critical deployments)
    if [ "$backup_type" = "pre-deployment" ] || [ "$backup_type" = "critical" ]; then
        log "🐳 Backing up Docker images..."
        mkdir -p "$backup_dir/images"
        
        # Get list of custom images
        images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "saas-platform|saas_platform" || true)
        
        if [ -n "$images" ]; then
            echo "$images" > "$backup_dir/images/image-list.txt"
            
            # Save images (this can be large, so only for critical backups)
            while IFS= read -r image; do
                if [ -n "$image" ]; then
                    image_file=$(echo "$image" | tr '/:' '_')
                    log "💾 Saving image: $image"
                    docker save "$image" | gzip > "$backup_dir/images/${image_file}.tar.gz" 2>/dev/null || {
                        log "${YELLOW}⚠️ Failed to save image: $image${NC}"
                    }
                fi
            done <<< "$images"
        fi
    fi
    
    # Create backup manifest
    log "📋 Creating backup manifest..."
    cat > "$backup_dir/manifest.json" << EOF
{
  "timestamp": "$timestamp",
  "type": "$backup_type",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "git_status": "$(git status --porcelain 2>/dev/null | wc -l) uncommitted changes",
  "docker_images": $(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "saas-platform|saas_platform" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "services_status": $(docker compose ps --format json 2>/dev/null | jq -s . 2>/dev/null || echo '[]'),
  "system_info": {
    "hostname": "$(hostname)",
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "docker_version": "$(docker --version 2>/dev/null || echo 'unknown')",
    "compose_version": "$(docker compose version --short 2>/dev/null || echo 'unknown')"
  },
  "backup_size": {
    "code": "$(du -sh "$backup_dir/code.tar.gz" 2>/dev/null | cut -f1 || echo 'unknown')",
    "database": "$(du -sh "$backup_dir/database.sql" 2>/dev/null | cut -f1 || echo 'unknown')",
    "media": "$(du -sh "$backup_dir/media.tar.gz" 2>/dev/null | cut -f1 || echo 'unknown')",
    "total": "$(du -sh "$backup_dir" 2>/dev/null | cut -f1 || echo 'unknown')"
  }
}
EOF
    
    # Verify backup integrity
    log "🔍 Verifying backup integrity..."
    local verification_passed=true
    
    # Check if critical files exist
    if [ ! -f "$backup_dir/code.tar.gz" ]; then
        log "${RED}❌ Code backup missing${NC}"
        verification_passed=false
    fi
    
    if [ ! -f "$backup_dir/database.sql" ]; then
        log "${RED}❌ Database backup missing${NC}"
        verification_passed=false
    fi
    
    if [ ! -f "$backup_dir/manifest.json" ]; then
        log "${RED}❌ Manifest missing${NC}"
        verification_passed=false
    fi
    
    # Test archive integrity
    if ! tar -tzf "$backup_dir/code.tar.gz" >/dev/null 2>&1; then
        log "${RED}❌ Code archive is corrupted${NC}"
        verification_passed=false
    fi
    
    if [ "$verification_passed" = true ]; then
        log "${GREEN}✅ Backup verification passed${NC}"
    else
        log "${RED}❌ Backup verification failed${NC}"
        return 1
    fi
    
    # Update last known good backup if this is a successful deployment
    if [ "$backup_type" = "pre-deployment" ] || [ "$backup_type" = "success" ]; then
        # Check if system is healthy before marking as last known good
        if scripts/health-check.sh >/dev/null 2>&1; then
            log "🔄 Updating last known good backup..."
            rm -rf "$BACKUP_ROOT/system/last-known-good"
            cp -r "$backup_dir" "$BACKUP_ROOT/system/last-known-good"
            log "${GREEN}✅ Updated last known good backup${NC}"
        else
            log "${YELLOW}⚠️ System not healthy, not updating last known good backup${NC}"
        fi
    fi
    
    # Update configuration backup for quick rollbacks
    if [ "$backup_type" = "config" ] || [ "$backup_type" = "pre-deployment" ]; then
        log "🔄 Updating configuration backup..."
        rm -rf "$BACKUP_ROOT/config/last-known-good"
        mkdir -p "$BACKUP_ROOT/config/last-known-good"
        cp .env "$BACKUP_ROOT/config/last-known-good/" 2>/dev/null || true
        cp docker-compose.yml "$BACKUP_ROOT/config/last-known-good/" 2>/dev/null || true
        cp -r .kiro "$BACKUP_ROOT/config/last-known-good/" 2>/dev/null || true
        log "${GREEN}✅ Updated configuration backup${NC}"
    fi
    
    log "${GREEN}✅ System backup completed: $backup_dir${NC}"
    
    # Cleanup old backups (keep last MAX_BACKUPS)
    cleanup_old_backups
    
    # Return backup directory for external use
    echo "$backup_dir"
}

cleanup_old_backups() {
    log "🧹 Cleaning up old backups..."
    
    # Clean up system backups
    if [ -d "$BACKUP_ROOT/system" ]; then
        local old_backups=$(ls -1t "$BACKUP_ROOT/system/" | grep -E '^[0-9]{8}_[0-9]{6}$' | tail -n +$((MAX_BACKUPS + 1)))
        
        if [ -n "$old_backups" ]; then
            echo "$old_backups" | while read -r backup; do
                log "🗑️ Removing old backup: $backup"
                rm -rf "$BACKUP_ROOT/system/$backup"
            done
        fi
    fi
    
    # Clean up config backups (keep last 20)
    if [ -d "$BACKUP_ROOT/config" ]; then
        local old_config_backups=$(ls -1t "$BACKUP_ROOT/config/" | grep -E '^[0-9]{8}_[0-9]{6}$' | tail -n +21)
        
        if [ -n "$old_config_backups" ]; then
            echo "$old_config_backups" | while read -r backup; do
                log "🗑️ Removing old config backup: $backup"
                rm -rf "$BACKUP_ROOT/config/$backup"
            done
        fi
    fi
}

restore_from_backup() {
    local backup_path="$1"
    
    if [ -z "$backup_path" ]; then
        log "${RED}❌ No backup path specified${NC}"
        return 1
    fi
    
    if [ ! -d "$backup_path" ]; then
        log "${RED}❌ Backup directory not found: $backup_path${NC}"
        return 1
    fi
    
    log "${BLUE}📦 Restoring from backup: $backup_path${NC}"
    
    # Verify backup integrity before restore
    if [ ! -f "$backup_path/manifest.json" ]; then
        log "${RED}❌ Backup manifest missing, cannot verify integrity${NC}"
        return 1
    fi
    
    # Stop services
    log "🛑 Stopping services..."
    docker compose down --timeout 30
    
    # Restore code
    if [ -f "$backup_path/code.tar.gz" ]; then
        log "💾 Restoring code..."
        tar -xzf "$backup_path/code.tar.gz" -C . || {
            log "${RED}❌ Failed to restore code${NC}"
            return 1
        }
    fi
    
    # Restore configuration
    if [ -f "$backup_path/.env" ]; then
        cp "$backup_path/.env" .
        log "⚙️ Configuration restored"
    fi
    
    # Restore database
    if [ -f "$backup_path/database.sql" ]; then
        log "🗄️ Restoring database..."
        docker compose up -d postgres
        sleep 15
        
        docker compose exec -T postgres psql -U app app < "$backup_path/database.sql" >/dev/null 2>&1 || {
            log "${YELLOW}⚠️ Database restore had issues, continuing...${NC}"
        }
    fi
    
    # Restore media files
    if [ -f "$backup_path/media.tar.gz" ]; then
        log "🖼️ Restoring media files..."
        docker compose up -d media
        sleep 10
        docker compose exec -i media tar -xzf - -C /data < "$backup_path/media.tar.gz" 2>/dev/null || {
            log "${YELLOW}⚠️ Media restore had issues, continuing...${NC}"
        }
    fi
    
    # Rebuild and start services
    log "🔨 Rebuilding services..."
    docker compose build --no-cache
    docker compose up -d
    
    log "${GREEN}✅ Restore completed${NC}"
}

list_backups() {
    log "📋 Available backups:"
    
    if [ -d "$BACKUP_ROOT/system" ]; then
        echo ""
        echo "System Backups:"
        ls -la "$BACKUP_ROOT/system/" | grep -E '^d.*[0-9]{8}_[0-9]{6}$' | while read -r line; do
            backup_name=$(echo "$line" | awk '{print $NF}')
            if [ -f "$BACKUP_ROOT/system/$backup_name/manifest.json" ]; then
                backup_type=$(jq -r '.type' "$BACKUP_ROOT/system/$backup_name/manifest.json" 2>/dev/null || echo "unknown")
                backup_size=$(jq -r '.backup_size.total' "$BACKUP_ROOT/system/$backup_name/manifest.json" 2>/dev/null || echo "unknown")
                echo "  $backup_name ($backup_type, $backup_size)"
            else
                echo "  $backup_name (no manifest)"
            fi
        done
        
        if [ -d "$BACKUP_ROOT/system/last-known-good" ]; then
            echo "  last-known-good (latest verified backup)"
        fi
    fi
    
    if [ -d "$BACKUP_ROOT/config" ]; then
        echo ""
        echo "Configuration Backups:"
        ls -la "$BACKUP_ROOT/config/" | grep -E '^d.*[0-9]{8}_[0-9]{6}$' | tail -5 | while read -r line; do
            backup_name=$(echo "$line" | awk '{print $NF}')
            echo "  $backup_name"
        done
        
        if [ -d "$BACKUP_ROOT/config/last-known-good" ]; then
            echo "  last-known-good (latest config backup)"
        fi
    fi
}

# Schedule automatic backups
schedule_backups() {
    log "${BLUE}⏰ Starting scheduled backup service...${NC}"
    
    while true; do
        log "🔄 Running scheduled backup..."
        create_system_backup "scheduled"
        
        # Sleep for 1 hour (3600 seconds)
        sleep 3600
    done
}

# Main execution
main() {
    case "${1:-create}" in
        "create")
            create_system_backup "${2:-manual}"
            ;;
        "restore")
            restore_from_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "schedule")
            schedule_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            cat << EOF
Usage: $0 <command> [options]

Commands:
  create [type]     - Create a new backup (default: manual)
                      Types: manual, scheduled, pre-deployment, critical, config, success
  restore <path>    - Restore from backup directory
  list              - List available backups
  schedule          - Start scheduled backup service (runs every hour)
  cleanup           - Clean up old backups

Examples:
  $0 create pre-deployment    # Create pre-deployment backup
  $0 restore backups/system/20240101_120000
  $0 list                     # Show all available backups
  $0 schedule                 # Start automatic backup service

EOF
            exit 1
            ;;
    esac
}

# Execute main function if script is run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
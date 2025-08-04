#!/bin/bash
# scripts/rollback.sh - Main rollback orchestrator

set -e

# Configuration
ROLLBACK_LOG="logs/rollback.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure logs directory exists
mkdir -p logs

log_message() {
    local message="$1"
    echo -e "$(date '+%Y-%m-%d %H:%M:%S'): $message" | tee -a "$ROLLBACK_LOG"
}

create_incident_report() {
    local trigger="$1"
    local incident_id="INC-$(date +%Y%m%d_%H%M%S)"
    local incident_dir="incidents/$incident_id"
    
    mkdir -p "$incident_dir"
    
    log_message "📊 Creating incident report: $incident_id"
    
    # Collect diagnostic information
    {
        echo "=== INCIDENT REPORT ==="
        echo "Incident ID: $incident_id"
        echo "Timestamp: $(date -Iseconds)"
        echo "Trigger: $trigger"
        echo "Git Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
        echo "Git Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
        echo ""
        echo "=== CONTAINER STATUS ==="
        docker compose ps 2>/dev/null || echo "Failed to get container status"
        echo ""
        echo "=== RESOURCE USAGE ==="
        docker stats --no-stream 2>/dev/null || echo "Failed to get resource usage"
        echo ""
        echo "=== RECENT LOGS ==="
        docker compose logs --tail=50 2>/dev/null || echo "Failed to get logs"
    } > "$incident_dir/incident-report.txt"
    
    # Save individual log files
    docker compose logs --tail=100 > "$incident_dir/service-logs.txt" 2>/dev/null || true
    docker compose ps > "$incident_dir/container-status.txt" 2>/dev/null || true
    docker stats --no-stream > "$incident_dir/resource-usage.txt" 2>/dev/null || true
    
    # Save configuration
    cp .env "$incident_dir/" 2>/dev/null || echo "No .env file found"
    cp docker-compose.yml "$incident_dir/" 2>/dev/null || true
    
    echo "$incident_id"
}

determine_rollback_level() {
    log_message "🔍 Determining appropriate rollback level..."
    
    # Check if Docker Compose configuration is valid
    if docker compose config >/dev/null 2>&1; then
        log_message "✅ Docker Compose configuration is valid"
        
        # Check if containers are running
        running_containers=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l)
        total_services=$(docker compose config --services 2>/dev/null | wc -l)
        
        if [ "$running_containers" -eq "$total_services" ]; then
            # All containers running but unhealthy - likely image issue
            log_message "🔍 All containers running but unhealthy - suggesting image rollback"
            echo "images"
        elif [ "$running_containers" -gt 0 ]; then
            # Some containers running - mixed state, try image rollback
            log_message "🔍 Some containers running - suggesting image rollback"
            echo "images"
        else
            # No containers running - likely code issue
            log_message "🔍 No containers running - suggesting code rollback"
            echo "code"
        fi
    else
        log_message "❌ Docker Compose configuration invalid - suggesting configuration rollback"
        echo "config"
    fi
}

rollback_configuration() {
    log_message "${BLUE}🔄 Starting configuration rollback...${NC}"
    
    # Backup current configuration
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="backups/config/$timestamp"
    mkdir -p "$backup_dir"
    
    cp .env "$backup_dir/" 2>/dev/null || echo "No .env file to backup"
    cp docker-compose.yml "$backup_dir/" 2>/dev/null || true
    cp -r .kiro "$backup_dir/" 2>/dev/null || echo "No .kiro directory to backup"
    
    # Restore previous configuration
    local last_good_config="backups/config/last-known-good"
    if [ -d "$last_good_config" ]; then
        log_message "📦 Restoring configuration from last known good state"
        
        cp "$last_good_config/.env" . 2>/dev/null || echo "No .env in backup"
        cp "$last_good_config/docker-compose.yml" . 2>/dev/null || true
        cp -r "$last_good_config/.kiro" . 2>/dev/null || echo "No .kiro in backup"
        
        # Restart services with new configuration
        log_message "🔄 Restarting services with restored configuration"
        docker compose down --timeout 30
        docker compose up -d
        
        # Wait for services to be ready
        log_message "⏳ Waiting for services to start..."
        sleep 30
        
        # Verify health
        if "$SCRIPT_DIR/health-check.sh"; then
            log_message "${GREEN}✅ Configuration rollback successful${NC}"
            return 0
        else
            log_message "${RED}❌ Configuration rollback failed${NC}"
            return 1
        fi
    else
        log_message "${RED}❌ No previous configuration backup found${NC}"
        return 1
    fi
}

rollback_images() {
    log_message "${BLUE}🔄 Starting container image rollback...${NC}"
    
    # Get previous version tag
    local current_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    local previous_commit=$(git rev-parse HEAD~1 2>/dev/null || echo "unknown")
    
    log_message "📋 Rolling back from commit $current_commit to $previous_commit"
    
    # Services to rollback
    local services=("website" "cms" "api-gateway")
    
    for service in "${services[@]}"; do
        log_message "🔄 Rolling back $service container image"
        
        # Check if we have a previous image tagged
        local image_name="saas-platform_$service"
        local backup_tag="backup-$(date +%Y%m%d)"
        
        # Tag current image as backup
        if docker image inspect "$image_name:latest" >/dev/null 2>&1; then
            docker tag "$image_name:latest" "$image_name:$backup_tag"
            log_message "📦 Tagged current $service image as backup"
        fi
        
        # Try to find previous image or rebuild
        if docker image inspect "$image_name:previous" >/dev/null 2>&1; then
            docker tag "$image_name:previous" "$image_name:latest"
            log_message "✅ Restored previous $service image"
        else
            log_message "🔨 Rebuilding $service from previous commit"
            # Checkout previous commit temporarily
            local current_branch=$(git branch --show-current 2>/dev/null || echo "main")
            git stash push -m "Pre-rollback stash $(date)" 2>/dev/null || true
            git checkout "$previous_commit" 2>/dev/null || {
                log_message "${RED}❌ Failed to checkout previous commit${NC}"
                return 1
            }
            
            # Rebuild service
            if docker compose build "$service"; then
                log_message "✅ Successfully rebuilt $service"
            else
                log_message "${RED}❌ Failed to rebuild $service${NC}"
                git checkout "$current_branch" 2>/dev/null || true
                return 1
            fi
            
            # Return to current branch
            git checkout "$current_branch" 2>/dev/null || true
            git stash pop 2>/dev/null || true
        fi
    done
    
    # Restart services with rolled back images
    log_message "🔄 Restarting services with rolled back images"
    docker compose down --timeout 30
    docker compose up -d
    
    # Wait for startup
    log_message "⏳ Waiting for services to start..."
    sleep 60
    
    # Verify rollback success
    if "$SCRIPT_DIR/health-check.sh"; then
        log_message "${GREEN}✅ Container image rollback successful${NC}"
        
        # Tag images as previous for future rollbacks
        for service in "${services[@]}"; do
            docker tag "saas-platform_$service:latest" "saas-platform_$service:previous"
        done
        
        return 0
    else
        log_message "${RED}❌ Container image rollback failed${NC}"
        return 1
    fi
}

rollback_code() {
    local target_commit="$1"
    
    log_message "${BLUE}🔄 Starting code version rollback...${NC}"
    
    # Determine rollback target
    if [ -z "$target_commit" ]; then
        # Find last known good commit (tagged with success marker)
        target_commit=$(git log --oneline --grep="✅\|success" -1 --format="%H" 2>/dev/null)
        if [ -z "$target_commit" ]; then
            # Fallback to previous commit
            target_commit="HEAD~1"
        fi
    fi
    
    log_message "📋 Rolling back to commit: $target_commit"
    
    # Create backup branch
    local backup_branch="backup-$(date +%Y%m%d_%H%M%S)"
    local current_branch=$(git branch --show-current 2>/dev/null || echo "main")
    
    git checkout -b "$backup_branch" 2>/dev/null || {
        log_message "${RED}❌ Failed to create backup branch${NC}"
        return 1
    }
    git checkout "$current_branch" 2>/dev/null || true
    
    # Stash any uncommitted changes
    git stash push -m "Pre-rollback stash $(date)" 2>/dev/null || true
    
    # Rollback to target commit
    if git reset --hard "$target_commit" 2>/dev/null; then
        log_message "✅ Code rolled back to $target_commit"
    else
        log_message "${RED}❌ Failed to rollback code${NC}"
        return 1
    fi
    
    # Rebuild containers with rolled back code
    log_message "🔨 Rebuilding containers with rolled back code..."
    docker compose down --timeout 30
    
    if docker compose build --no-cache; then
        log_message "✅ Containers rebuilt successfully"
    else
        log_message "${RED}❌ Failed to rebuild containers${NC}"
        # Restore original state
        git checkout "$backup_branch" 2>/dev/null || true
        git checkout "$current_branch" 2>/dev/null || true
        git reset --hard "$backup_branch" 2>/dev/null || true
        return 1
    fi
    
    # Start services
    docker compose up -d
    
    # Wait for startup
    log_message "⏳ Waiting for services to start..."
    sleep 90
    
    # Verify rollback success
    if "$SCRIPT_DIR/health-check.sh"; then
        log_message "${GREEN}✅ Code version rollback successful${NC}"
        
        # Tag as known good
        git tag -a "rollback-success-$(date +%Y%m%d_%H%M%S)" -m "Successful rollback to $target_commit" 2>/dev/null || true
        
        return 0
    else
        log_message "${RED}❌ Code version rollback failed${NC}"
        
        # Restore original state
        git checkout "$backup_branch" 2>/dev/null || true
        git checkout "$current_branch" 2>/dev/null || true
        git reset --hard "$backup_branch" 2>/dev/null || true
        
        return 1
    fi
}

rollback_full_system() {
    log_message "${BLUE}🚨 Starting full system rollback...${NC}"
    
    # Stop all services
    log_message "🛑 Stopping all services..."
    docker compose down -v --timeout 60
    
    # Clean up containers and networks
    docker system prune -f >/dev/null 2>&1 || true
    
    # Restore from last known good backup
    local backup_dir="backups/system/last-known-good"
    
    if [ ! -d "$backup_dir" ]; then
        log_message "${RED}❌ No system backup found, cannot perform full rollback${NC}"
        return 1
    fi
    
    log_message "📦 Restoring from system backup..."
    
    # Restore code
    if [ -f "$backup_dir/code.tar.gz" ]; then
        log_message "💾 Restoring code from backup..."
        tar -xzf "$backup_dir/code.tar.gz" -C . 2>/dev/null || {
            log_message "${RED}❌ Failed to restore code${NC}"
            return 1
        }
    fi
    
    # Restore configuration
    if [ -f "$backup_dir/.env" ]; then
        cp "$backup_dir/.env" .
        log_message "⚙️ Configuration restored"
    fi
    
    if [ -f "$backup_dir/docker-compose.yml" ]; then
        cp "$backup_dir/docker-compose.yml" .
    fi
    
    # Restore database
    log_message "🗄️ Restoring database..."
    docker compose up -d postgres
    sleep 15
    
    if [ -f "$backup_dir/database.sql" ]; then
        if docker compose exec -T postgres psql -U app app < "$backup_dir/database.sql" >/dev/null 2>&1; then
            log_message "✅ Database restored successfully"
        else
            log_message "${YELLOW}⚠️ Database restore had issues, continuing...${NC}"
        fi
    fi
    
    # Restore media files
    if [ -f "$backup_dir/media.tar.gz" ]; then
        log_message "🖼️ Restoring media files..."
        docker compose up -d media
        sleep 10
        docker compose exec -i media tar -xzf - -C /data < "$backup_dir/media.tar.gz" 2>/dev/null || {
            log_message "${YELLOW}⚠️ Media restore had issues, continuing...${NC}"
        }
    fi
    
    # Rebuild and start all services
    log_message "🔨 Rebuilding all services..."
    if docker compose build --no-cache; then
        log_message "✅ All services rebuilt"
    else
        log_message "${RED}❌ Failed to rebuild services${NC}"
        return 1
    fi
    
    docker compose up -d
    
    # Extended wait for full system startup
    log_message "⏳ Waiting for full system startup..."
    sleep 120
    
    # Comprehensive health check
    if "$SCRIPT_DIR/health-check.sh"; then
        log_message "${GREEN}✅ Full system rollback successful${NC}"
        return 0
    else
        log_message "${RED}❌ Full system rollback failed${NC}"
        return 1
    fi
}

send_alert() {
    local message="$1"
    
    # Log alert
    log_message "🚨 ALERT: $message"
    
    # Create alert file for external monitoring
    cat > "/tmp/rollback-alert.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "level": "critical",
  "message": "$message",
  "system": "saas-platform"
}
EOF
    
    # TODO: Implement notification integrations
    # Examples:
    # - Slack webhook
    # - Email notification
    # - PagerDuty integration
    # - Discord webhook
}

main() {
    local trigger="${1:-manual}"
    local level="${2:-auto}"
    local target_commit="$3"
    
    log_message "${BLUE}🚨 Rollback initiated - Trigger: $trigger, Level: $level${NC}"
    
    # Create incident report
    local incident_id=$(create_incident_report "$trigger")
    log_message "📋 Incident ID: $incident_id"
    
    # Determine rollback level if auto
    if [ "$level" = "auto" ]; then
        level=$(determine_rollback_level)
        log_message "🎯 Auto-determined rollback level: $level"
    fi
    
    log_message "📋 Executing rollback level: $level"
    
    # Execute rollback based on level
    case "$level" in
        "config"|"1")
            if rollback_configuration; then
                log_message "${GREEN}✅ Configuration rollback successful${NC}"
                return 0
            fi
            log_message "${YELLOW}⚠️ Configuration rollback failed, escalating to image rollback${NC}"
            ;&  # Fall through to next level
        "images"|"2")
            if rollback_images; then
                log_message "${GREEN}✅ Container image rollback successful${NC}"
                return 0
            fi
            log_message "${YELLOW}⚠️ Image rollback failed, escalating to code rollback${NC}"
            ;&  # Fall through to next level
        "code"|"3")
            if rollback_code "$target_commit"; then
                log_message "${GREEN}✅ Code version rollback successful${NC}"
                return 0
            fi
            log_message "${YELLOW}⚠️ Code rollback failed, escalating to full system rollback${NC}"
            ;&  # Fall through to next level
        "full"|"4")
            if rollback_full_system; then
                log_message "${GREEN}✅ Full system rollback successful${NC}"
                return 0
            else
                log_message "${RED}❌ All rollback levels failed - manual intervention required${NC}"
                send_alert "CRITICAL: All automated rollback procedures failed for incident $incident_id"
                return 1
            fi
            ;;
        *)
            log_message "${RED}❌ Invalid rollback level: $level${NC}"
            return 1
            ;;
    esac
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    cat << EOF
Usage: $0 <trigger> [level] [commit]

Triggers:
  manual      - Manual rollback initiation
  auto        - Automatic rollback (from monitoring)
  build       - Build failure triggered rollback
  health      - Health check failure triggered rollback
  performance - Performance regression triggered rollback

Levels:
  auto        - Automatically determine rollback level (default)
  config/1    - Configuration rollback only
  images/2    - Container image rollback
  code/3      - Code version rollback
  full/4      - Full system rollback

Examples:
  $0 manual config                    # Manual configuration rollback
  $0 auto                            # Auto-determine rollback level
  $0 health code abc123              # Health-triggered code rollback to specific commit
  $0 build full                      # Build failure full system rollback

EOF
    exit 1
fi

# Execute main function
main "$@"
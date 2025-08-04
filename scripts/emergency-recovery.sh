#!/bin/bash
# scripts/emergency-recovery.sh - Emergency recovery procedures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

EMERGENCY_LOG="logs/emergency.log"
mkdir -p logs

log() {
    local message="$1"
    echo -e "$(date '+%Y-%m-%d %H:%M:%S'): $message" | tee -a "$EMERGENCY_LOG"
}

emergency_stop() {
    log "${RED}🚨 EMERGENCY STOP INITIATED${NC}"
    
    # Stop all services immediately with short timeout
    log "🛑 Stopping all Docker Compose services..."
    docker compose down --timeout 10 2>/dev/null || true
    
    # Kill any remaining containers forcefully
    log "💀 Killing any remaining containers..."
    local running_containers=$(docker ps -q 2>/dev/null || true)
    if [ -n "$running_containers" ]; then
        docker kill $running_containers 2>/dev/null || true
    fi
    
    # Clean up networks
    log "🧹 Cleaning up Docker networks..."
    docker network prune -f >/dev/null 2>&1 || true
    
    # Stop any remaining processes on known ports
    log "🔌 Stopping processes on application ports..."
    for port in 3000 3001 8080 15432; do
        local pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            log "🔫 Killing process on port $port (PID: $pid)"
            kill -9 $pid 2>/dev/null || true
        fi
    done
    
    log "${GREEN}🛑 Emergency stop completed${NC}"
    return 0
}

emergency_recovery() {
    log "${RED}🚨 EMERGENCY RECOVERY INITIATED${NC}"
    
    # First, ensure everything is stopped
    emergency_stop
    
    # Clean up Docker system
    log "🧹 Cleaning up Docker system..."
    docker system prune -af --volumes >/dev/null 2>&1 || true
    
    # Check if we have a last known good backup
    local backup_dir="backups/system/last-known-good"
    
    if [ ! -d "$backup_dir" ]; then
        log "${RED}❌ No last known good backup found${NC}"
        log "🔍 Searching for most recent backup..."
        
        # Find most recent backup
        local recent_backup=$(ls -1t backups/system/ 2>/dev/null | grep -E '^[0-9]{8}_[0-9]{6}$' | head -1)
        
        if [ -n "$recent_backup" ]; then
            backup_dir="backups/system/$recent_backup"
            log "📦 Using recent backup: $backup_dir"
        else
            log "${RED}❌ No backups available - manual recovery required${NC}"
            log "🆘 Please restore from external backup or rebuild from source"
            return 1
        fi
    fi
    
    log "📦 Restoring from backup: $backup_dir"
    
    # Restore using backup script
    if scripts/create-backup.sh restore "$backup_dir"; then
        log "${GREEN}✅ Emergency recovery completed successfully${NC}"
        
        # Wait for services to stabilize
        log "⏳ Waiting for services to stabilize..."
        sleep 60
        
        # Verify recovery
        if scripts/health-check.sh; then
            log "${GREEN}✅ System health verified after recovery${NC}"
            return 0
        else
            log "${YELLOW}⚠️ System recovered but health check failed${NC}"
            log "🔍 Manual verification may be required"
            return 1
        fi
    else
        log "${RED}❌ Emergency recovery failed${NC}"
        return 1
    fi
}

force_rebuild() {
    log "${BLUE}🔨 FORCE REBUILD INITIATED${NC}"
    
    # Stop everything
    emergency_stop
    
    # Remove all containers and images
    log "🗑️ Removing all containers and images..."
    docker system prune -af --volumes >/dev/null 2>&1 || true
    
    # Remove all custom images
    local custom_images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "saas-platform|saas_platform" || true)
    if [ -n "$custom_images" ]; then
        echo "$custom_images" | xargs docker rmi -f 2>/dev/null || true
    fi
    
    # Rebuild everything from scratch
    log "🔨 Rebuilding all services from scratch..."
    if docker compose build --no-cache --parallel; then
        log "✅ Rebuild completed"
        
        # Start services
        log "🚀 Starting services..."
        docker compose up -d
        
        # Wait for startup
        log "⏳ Waiting for services to start..."
        sleep 90
        
        # Verify
        if scripts/health-check.sh; then
            log "${GREEN}✅ Force rebuild successful${NC}"
            return 0
        else
            log "${RED}❌ Force rebuild completed but services are unhealthy${NC}"
            return 1
        fi
    else
        log "${RED}❌ Force rebuild failed${NC}"
        return 1
    fi
}

reset_to_git() {
    local target_ref="${1:-HEAD~1}"
    
    log "${BLUE}🔄 RESETTING TO GIT REFERENCE: $target_ref${NC}"
    
    # Create backup of current state
    log "📦 Creating backup of current state..."
    scripts/create-backup.sh "pre-reset" >/dev/null 2>&1 || log "⚠️ Backup failed"
    
    # Stop services
    emergency_stop
    
    # Stash any uncommitted changes
    log "💾 Stashing uncommitted changes..."
    git stash push -m "Emergency reset stash $(date)" 2>/dev/null || true
    
    # Reset to target reference
    log "🔄 Resetting to $target_ref..."
    if git reset --hard "$target_ref"; then
        log "✅ Git reset completed"
        
        # Force rebuild with new code
        force_rebuild
        return $?
    else
        log "${RED}❌ Git reset failed${NC}"
        return 1
    fi
}

show_system_status() {
    log "${BLUE}📊 SYSTEM STATUS REPORT${NC}"
    
    echo ""
    echo "=== Docker Status ==="
    docker version 2>/dev/null || echo "Docker not available"
    echo ""
    
    echo "=== Container Status ==="
    docker compose ps 2>/dev/null || echo "No containers running"
    echo ""
    
    echo "=== System Resources ==="
    echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3"/"$2}' 2>/dev/null || echo 'unknown')"
    echo "Disk: $(df -h / | awk 'NR==2 {print $3"/"$2" ("$5" used)"}' 2>/dev/null || echo 'unknown')"
    echo "Load: $(uptime | awk -F'load average:' '{print $2}' | xargs 2>/dev/null || echo 'unknown')"
    echo ""
    
    echo "=== Network Ports ==="
    for port in 3000 3001 8080 15432; do
        if lsof -i:$port >/dev/null 2>&1; then
            echo "Port $port: IN USE"
        else
            echo "Port $port: FREE"
        fi
    done
    echo ""
    
    echo "=== Recent Logs ==="
    if [ -f "$EMERGENCY_LOG" ]; then
        tail -10 "$EMERGENCY_LOG"
    else
        echo "No emergency logs found"
    fi
    echo ""
    
    echo "=== Available Backups ==="
    if [ -d "backups/system" ]; then
        ls -la backups/system/ | grep -E '^d.*[0-9]{8}_[0-9]{6}$' | tail -5
        if [ -d "backups/system/last-known-good" ]; then
            echo "last-known-good backup available"
        fi
    else
        echo "No backups found"
    fi
}

main() {
    case "${1:-help}" in
        "stop")
            emergency_stop
            ;;
        "recover")
            emergency_recovery
            ;;
        "rebuild")
            force_rebuild
            ;;
        "reset")
            reset_to_git "$2"
            ;;
        "status")
            show_system_status
            ;;
        "help"|*)
            cat << EOF
Emergency Recovery Tool for SaaS Platform

Commands:
  stop              - Emergency stop all services
  recover           - Full emergency recovery from backup
  rebuild           - Force rebuild all containers from scratch
  reset [ref]       - Reset to git reference and rebuild (default: HEAD~1)
  status            - Show system status report

Examples:
  $0 stop                    # Emergency stop
  $0 recover                 # Full recovery
  $0 rebuild                 # Force rebuild
  $0 reset HEAD~2           # Reset to 2 commits ago
  $0 status                 # Show status

Emergency Procedures:
1. For service failures: $0 recover
2. For build issues: $0 rebuild  
3. For code issues: $0 reset
4. For complete failure: $0 stop && $0 recover

Logs: $EMERGENCY_LOG

EOF
            exit 0
            ;;
    esac
}

# Execute main function
main "$@"
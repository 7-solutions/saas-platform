#!/bin/bash
# scripts/continuous-health-monitor.sh - Continuous health monitoring with automatic rollback

set -e

# Configuration from environment variables
MONITOR_INTERVAL=${CHECK_INTERVAL:-30}
FAILURE_THRESHOLD=${FAILURE_THRESHOLD:-3}
ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-true}
PERFORMANCE_CHECK_ENABLED=${PERFORMANCE_CHECK_ENABLED:-true}
ALERT_WEBHOOK=${ALERT_WEBHOOK:-""}

# Internal state
consecutive_failures=0
last_health_status="unknown"
monitor_start_time=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="logs/health-monitor.log"
mkdir -p logs

log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "$timestamp: $message" | tee -a "$LOG_FILE"
}

send_alert() {
    local level="$1"
    local message="$2"
    local details="${3:-}"
    
    log "🚨 ALERT [$level]: $message"
    
    # Create alert payload
    local alert_payload=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "level": "$level",
  "message": "$message",
  "details": "$details",
  "system": "saas-platform",
  "monitor_uptime": "$(($(date +%s) - monitor_start_time))s",
  "consecutive_failures": $consecutive_failures
}
EOF
)
    
    # Save alert to file
    echo "$alert_payload" > "/tmp/health-alert-$(date +%s).json"
    
    # Send webhook if configured
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST \
             -H "Content-Type: application/json" \
             -d "$alert_payload" \
             "$ALERT_WEBHOOK" \
             --max-time 10 \
             --silent \
             --show-error || log "⚠️ Failed to send webhook alert"
    fi
    
    # Log to system log if available
    if command -v logger >/dev/null 2>&1; then
        logger -t "saas-platform-monitor" "[$level] $message"
    fi
}

check_basic_health() {
    local health_result
    
    # Run health check script
    if scripts/health-check.sh >/dev/null 2>&1; then
        health_result="healthy"
    else
        health_result="unhealthy"
    fi
    
    echo "$health_result"
}

check_performance_metrics() {
    if [ "$PERFORMANCE_CHECK_ENABLED" != "true" ]; then
        return 0
    fi
    
    local violations=()
    
    # Check response times (if services are running)
    if docker compose ps website | grep -q "Up"; then
        local response_time
        response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health 2>/dev/null || echo "999")
        
        # Convert to milliseconds and check threshold (1000ms)
        local response_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null || echo "999")
        
        if (( $(echo "$response_ms > 1000" | bc -l 2>/dev/null || echo "1") )); then
            violations+=("Website response time: ${response_ms}ms > 1000ms")
        fi
    fi
    
    # Check container resource usage
    local high_cpu_containers=()
    local high_memory_containers=()
    
    # Get container stats (timeout after 10 seconds)
    local stats_output
    if stats_output=$(timeout 10 docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}" 2>/dev/null); then
        while IFS=$'\t' read -r name cpu_perc mem_perc; do
            # Extract numeric values
            local cpu_num=$(echo "$cpu_perc" | sed 's/%//' | sed 's/[^0-9.]//g')
            local mem_num=$(echo "$mem_perc" | sed 's/%//' | sed 's/[^0-9.]//g')
            
            # Check CPU usage (warn if > 80%)
            if [ -n "$cpu_num" ] && (( $(echo "$cpu_num > 80" | bc -l 2>/dev/null || echo "0") )); then
                high_cpu_containers+=("$name: ${cpu_perc}")
            fi
            
            # Check memory usage (warn if > 90%)
            if [ -n "$mem_num" ] && (( $(echo "$mem_num > 90" | bc -l 2>/dev/null || echo "0") )); then
                high_memory_containers+=("$name: ${mem_perc}")
            fi
        done <<< "$stats_output"
    fi
    
    # Add resource violations
    if [ ${#high_cpu_containers[@]} -gt 0 ]; then
        violations+=("High CPU usage: ${high_cpu_containers[*]}")
    fi
    
    if [ ${#high_memory_containers[@]} -gt 0 ]; then
        violations+=("High memory usage: ${high_memory_containers[*]}")
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        violations+=("Low disk space: ${disk_usage}% used")
    fi
    
    # Return violations
    if [ ${#violations[@]} -gt 0 ]; then
        printf '%s\n' "${violations[@]}"
        return 1
    fi
    
    return 0
}

handle_health_change() {
    local new_status="$1"
    local old_status="$2"
    
    if [ "$new_status" != "$old_status" ]; then
        if [ "$new_status" = "healthy" ]; then
            log "${GREEN}✅ System recovered - all services healthy${NC}"
            send_alert "info" "System recovered" "All services are now healthy after $consecutive_failures consecutive failures"
            consecutive_failures=0
        else
            log "${RED}❌ System became unhealthy${NC}"
            send_alert "warning" "System became unhealthy" "Health check failed"
        fi
    fi
}

handle_failure_threshold() {
    log "${RED}🚨 Failure threshold reached ($consecutive_failures/$FAILURE_THRESHOLD)${NC}"
    
    if [ "$ROLLBACK_ENABLED" = "true" ]; then
        log "${BLUE}🔄 Initiating automatic rollback...${NC}"
        send_alert "critical" "Initiating automatic rollback" "Failure threshold reached: $consecutive_failures consecutive failures"
        
        # Create pre-rollback backup
        log "📦 Creating pre-rollback backup..."
        scripts/create-backup.sh "pre-rollback" >/dev/null 2>&1 || log "⚠️ Pre-rollback backup failed"
        
        # Execute rollback
        if scripts/rollback.sh "auto" "auto"; then
            log "${GREEN}✅ Automatic rollback successful${NC}"
            send_alert "info" "Automatic rollback successful" "System recovered after rollback"
            consecutive_failures=0
        else
            log "${RED}❌ Automatic rollback failed${NC}"
            send_alert "critical" "Automatic rollback failed" "Manual intervention required"
            
            # Disable further automatic rollbacks to prevent loops
            ROLLBACK_ENABLED="false"
            log "🛑 Automatic rollback disabled to prevent loops"
        fi
    else
        log "${YELLOW}⚠️ Automatic rollback is disabled${NC}"
        send_alert "critical" "System unhealthy - rollback disabled" "Manual intervention required"
    fi
}

create_status_report() {
    local health_status="$1"
    local performance_issues="$2"
    
    # Get system information
    local uptime=$(uptime -p 2>/dev/null || echo "unknown")
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    local memory_info=$(free -h | grep '^Mem:' | awk '{print $3"/"$2" ("$3/$2*100"%)"}' 2>/dev/null || echo "unknown")
    
    # Create status report
    cat > "/tmp/health-status-$(date +%s).json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "health_status": "$health_status",
  "consecutive_failures": $consecutive_failures,
  "monitor_uptime": "$(($(date +%s) - monitor_start_time))s",
  "system_info": {
    "uptime": "$uptime",
    "load_average": "$load_avg",
    "memory_usage": "$memory_info",
    "disk_usage": "$(df -h / | awk 'NR==2 {print $5}' 2>/dev/null || echo 'unknown')"
  },
  "docker_info": {
    "running_containers": $(docker ps --format "{{.Names}}" | wc -l 2>/dev/null || echo 0),
    "total_containers": $(docker ps -a --format "{{.Names}}" | wc -l 2>/dev/null || echo 0),
    "images": $(docker images -q | wc -l 2>/dev/null || echo 0)
  },
  "performance_issues": $(echo "$performance_issues" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "configuration": {
    "monitor_interval": $MONITOR_INTERVAL,
    "failure_threshold": $FAILURE_THRESHOLD,
    "rollback_enabled": $ROLLBACK_ENABLED,
    "performance_check_enabled": $PERFORMANCE_CHECK_ENABLED
  }
}
EOF
}

cleanup_old_reports() {
    # Clean up old status reports (keep last 100)
    find /tmp -name "health-status-*.json" -type f -mtime +1 -delete 2>/dev/null || true
    find /tmp -name "health-alert-*.json" -type f -mtime +1 -delete 2>/dev/null || true
    
    # Rotate log file if it gets too large (>10MB)
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        touch "$LOG_FILE"
        log "📋 Log file rotated"
    fi
}

signal_handler() {
    log "${BLUE}🛑 Health monitor shutting down gracefully...${NC}"
    send_alert "info" "Health monitor stopped" "Monitor service was stopped"
    exit 0
}

# Set up signal handlers
trap signal_handler SIGTERM SIGINT

main() {
    log "${BLUE}🏥 Starting continuous health monitor...${NC}"
    log "📋 Configuration: interval=${MONITOR_INTERVAL}s, threshold=${FAILURE_THRESHOLD}, rollback=${ROLLBACK_ENABLED}"
    
    send_alert "info" "Health monitor started" "Monitoring service initialized"
    
    while true; do
        local current_time=$(date '+%Y-%m-%d %H:%M:%S')
        
        # Check basic health
        local health_status
        health_status=$(check_basic_health)
        
        # Check performance metrics
        local performance_issues=""
        if ! performance_issues=$(check_performance_metrics 2>&1); then
            log "${YELLOW}⚠️ Performance issues detected: $performance_issues${NC}"
        fi
        
        # Handle health status
        if [ "$health_status" = "healthy" ]; then
            if [ $consecutive_failures -gt 0 ]; then
                handle_health_change "$health_status" "$last_health_status"
            else
                log "${GREEN}✅ All services healthy${NC}"
            fi
            consecutive_failures=0
        else
            consecutive_failures=$((consecutive_failures + 1))
            log "${RED}❌ Health check failed ($consecutive_failures/$FAILURE_THRESHOLD)${NC}"
            
            handle_health_change "$health_status" "$last_health_status"
            
            # Check if we've reached the failure threshold
            if [ $consecutive_failures -ge $FAILURE_THRESHOLD ]; then
                handle_failure_threshold
            fi
        fi
        
        # Update last known status
        last_health_status="$health_status"
        
        # Create status report
        create_status_report "$health_status" "$performance_issues"
        
        # Periodic cleanup
        if [ $(($(date +%s) % 3600)) -eq 0 ]; then  # Every hour
            cleanup_old_reports
        fi
        
        # Sleep until next check
        sleep $MONITOR_INTERVAL
    done
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat << EOF
Continuous Health Monitor for SaaS Platform

Environment Variables:
  CHECK_INTERVAL              - Monitoring interval in seconds (default: 30)
  FAILURE_THRESHOLD           - Number of failures before rollback (default: 3)
  ROLLBACK_ENABLED           - Enable automatic rollback (default: true)
  PERFORMANCE_CHECK_ENABLED  - Enable performance monitoring (default: true)
  ALERT_WEBHOOK              - Webhook URL for alerts (optional)

Usage:
  $0                    # Start monitoring with default settings
  $0 --help            # Show this help message

Examples:
  CHECK_INTERVAL=60 FAILURE_THRESHOLD=5 $0
  ROLLBACK_ENABLED=false $0
  ALERT_WEBHOOK=https://hooks.slack.com/... $0

The monitor will:
1. Check service health every CHECK_INTERVAL seconds
2. Track consecutive failures
3. Trigger automatic rollback after FAILURE_THRESHOLD failures
4. Monitor performance metrics (response time, CPU, memory, disk)
5. Send alerts via webhook if configured
6. Create detailed status reports

Logs are written to: $LOG_FILE
Status reports: /tmp/health-status-*.json
Alert reports: /tmp/health-alert-*.json

EOF
    exit 0
fi

# Execute main function
main "$@"
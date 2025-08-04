#!/bin/bash
# scripts/health-check.sh - Comprehensive health monitoring

set -e

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S'): $1"
}

check_service_health() {
    local service=$1
    local port=$2
    local endpoint=${3:-"/api/health"}
    
    log "🔍 Checking health of $service..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        # Check if container is running
        if ! docker compose ps $service | grep -q "Up"; then
            log "${YELLOW}⚠️  $service container is not running${NC}"
            return 1
        fi
        
        # Check health endpoint
        if timeout $TIMEOUT docker compose exec $service curl -f -s http://localhost:$port$endpoint >/dev/null 2>&1; then
            log "${GREEN}✅ $service is healthy${NC}"
            return 0
        else
            log "${YELLOW}⚠️  $service health check failed (attempt $i/$MAX_RETRIES)${NC}"
            if [ $i -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    log "${RED}❌ $service is unhealthy after $MAX_RETRIES attempts${NC}"
    return 1
}

check_database_health() {
    log "🔍 Checking database health..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        if docker compose exec postgres pg_isready -U app -d app >/dev/null 2>&1; then
            log "${GREEN}✅ Database is healthy${NC}"
            return 0
        else
            log "${YELLOW}⚠️  Database health check failed (attempt $i/$MAX_RETRIES)${NC}"
            if [ $i -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    log "${RED}❌ Database is unhealthy after $MAX_RETRIES attempts${NC}"
    return 1
}

check_container_resources() {
    log "🔍 Checking container resource usage..."
    
    # Get container stats
    stats=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | tail -n +2)
    
    while IFS=$'\t' read -r name cpu mem_usage mem_perc; do
        # Extract numeric values
        cpu_num=$(echo $cpu | sed 's/%//')
        mem_num=$(echo $mem_perc | sed 's/%//')
        
        # Check CPU usage (warn if > 80%)
        if (( $(echo "$cpu_num > 80" | bc -l) )); then
            log "${YELLOW}⚠️  High CPU usage in $name: $cpu${NC}"
        fi
        
        # Check memory usage (warn if > 90%)
        if (( $(echo "$mem_num > 90" | bc -l) )); then
            log "${YELLOW}⚠️  High memory usage in $name: $mem_perc${NC}"
        fi
    done <<< "$stats"
    
    return 0
}

check_disk_space() {
    log "🔍 Checking disk space..."
    
    # Check available disk space (warn if < 10% free)
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        log "${YELLOW}⚠️  Low disk space: ${disk_usage}% used${NC}"
        return 1
    else
        log "${GREEN}✅ Disk space is adequate: ${disk_usage}% used${NC}"
        return 0
    fi
}

main() {
    log "🏥 Starting comprehensive health check..."
    
    failed_services=()
    
    # Check database first (other services depend on it)
    if ! check_database_health; then
        failed_services+=("postgres")
    fi
    
    # Check application services
    services=(
        "website:3000"
        "cms:3000"
        "api-gateway:8080:/health"
    )
    
    for service_config in "${services[@]}"; do
        IFS=':' read -r service port endpoint <<< "$service_config"
        if [ -z "$endpoint" ]; then
            endpoint="/api/health"
        fi
        
        if ! check_service_health "$service" "$port" "$endpoint"; then
            failed_services+=("$service")
        fi
    done
    
    # Check system resources
    check_container_resources
    check_disk_space
    
    # Summary
    if [ ${#failed_services[@]} -eq 0 ]; then
        log "${GREEN}✅ All services are healthy${NC}"
        
        # Create health status file
        cat > /tmp/health-status.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "healthy",
  "services": {
    "website": "healthy",
    "cms": "healthy",
    "api-gateway": "healthy",
    "postgres": "healthy"
  }
}
EOF
        
        return 0
    else
        log "${RED}🚨 Failed services: ${failed_services[*]}${NC}"
        
        # Create health status file
        cat > /tmp/health-status.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "unhealthy",
  "failed_services": $(printf '%s\n' "${failed_services[@]}" | jq -R . | jq -s .),
  "services": {
    "website": "$([ " ${failed_services[*]} " =~ " website " ] && echo "unhealthy" || echo "healthy")",
    "cms": "$([ " ${failed_services[*]} " =~ " cms " ] && echo "unhealthy" || echo "healthy")",
    "api-gateway": "$([ " ${failed_services[*]} " =~ " api-gateway " ] && echo "unhealthy" || echo "healthy")",
    "postgres": "$([ " ${failed_services[*]} " =~ " postgres " ] && echo "unhealthy" || echo "healthy")"
  }
}
EOF
        
        return 1
    fi
}

# Execute main function if script is run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
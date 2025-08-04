# Docker Rollback and Recovery Procedures

## Overview

This document provides comprehensive procedures for rolling back failed deployments and recovering from system failures in the SaaS Startup Platform. All procedures are designed to work within the Docker containerized environment and ensure minimal downtime.

## Rollback Strategy

### Rollback Triggers

Automatic rollback is triggered by:

1. **Build Failures**: Container build process fails
2. **Health Check Failures**: Services fail health checks for >2 minutes
3. **Performance Regression**: Response times exceed 2x baseline
4. **Critical Errors**: Error rate exceeds 5% for >1 minute
5. **Manual Trigger**: Administrator initiates rollback

### Rollback Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    Rollback Hierarchy                      │
├─────────────────────────────────────────────────────────────┤
│  Level 1: Configuration Rollback    │  Fastest (30s)       │
│  Level 2: Container Image Rollback  │  Fast (2-3 min)      │
│  Level 3: Code Version Rollback     │  Medium (5 min)      │
│  Level 4: Full System Rollback      │  Complete (10 min)   │
└─────────────────────────────────────────────────────────────┘
```

## Health Check System

### Service Health Monitoring

```bash
#!/bin/bash
# scripts/health-check.sh - Comprehensive health monitoring

check_service_health() {
    local service=$1
    local max_retries=3
    local retry_delay=5
    
    for i in $(seq 1 $max_retries); do
        if docker compose exec $service curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            echo "✅ $service is healthy"
            return 0
        else
            echo "⚠️  $service health check failed (attempt $i/$max_retries)"
            sleep $retry_delay
        fi
    done
    
    echo "❌ $service is unhealthy after $max_retries attempts"
    return 1
}

# Check all critical services
services=("website" "cms" "api-gateway" "postgres")
failed_services=()

for service in "${services[@]}"; do
    if ! check_service_health $service; then
        failed_services+=($service)
    fi
done

if [ ${#failed_services[@]} -gt 0 ]; then
    echo "🚨 Failed services: ${failed_services[*]}"
    echo "Initiating rollback procedure..."
    ./scripts/rollback.sh auto
    exit 1
fi

echo "✅ All services are healthy"
```

### Automated Health Monitoring

```yaml
# docker-compose.monitoring.yml
version: "3.9"
services:
  health-monitor:
    build:
      context: .
      dockerfile: monitoring/Dockerfile
    environment:
      - CHECK_INTERVAL=30
      - FAILURE_THRESHOLD=3
      - ROLLBACK_ENABLED=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./scripts:/scripts
    command: ["./scripts/continuous-health-monitor.sh"]
    restart: unless-stopped
```

### Performance Monitoring

```javascript
// scripts/performance-monitor.js
const performanceThresholds = {
  responseTime: 1000,      // 1 second max
  errorRate: 0.05,         // 5% max error rate
  cpuUsage: 0.8,          // 80% max CPU
  memoryUsage: 0.9        // 90% max memory
};

async function checkPerformanceMetrics() {
  const metrics = await collectMetrics();
  
  const violations = [];
  
  if (metrics.avgResponseTime > performanceThresholds.responseTime) {
    violations.push(`Response time: ${metrics.avgResponseTime}ms > ${performanceThresholds.responseTime}ms`);
  }
  
  if (metrics.errorRate > performanceThresholds.errorRate) {
    violations.push(`Error rate: ${metrics.errorRate} > ${performanceThresholds.errorRate}`);
  }
  
  if (violations.length > 0) {
    console.log('🚨 Performance violations detected:', violations);
    await triggerRollback('performance');
  }
}

setInterval(checkPerformanceMetrics, 60000); // Check every minute
```

## Rollback Procedures

### Level 1: Configuration Rollback

**Use Case**: Configuration changes causing issues
**Recovery Time**: ~30 seconds

```bash
#!/bin/bash
# scripts/rollback-config.sh

rollback_configuration() {
    echo "🔄 Starting configuration rollback..."
    
    # Backup current configuration
    timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p backups/config/$timestamp
    cp .env backups/config/$timestamp/
    cp docker-compose.yml backups/config/$timestamp/
    
    # Restore previous configuration
    if [ -f "backups/config/last-known-good/.env" ]; then
        cp backups/config/last-known-good/.env .
        cp backups/config/last-known-good/docker-compose.yml .
        
        echo "✅ Configuration restored from last known good state"
        
        # Restart services with new configuration
        docker compose down
        docker compose up -d
        
        # Wait for services to be ready
        sleep 10
        ./scripts/health-check.sh
        
        if [ $? -eq 0 ]; then
            echo "✅ Configuration rollback successful"
            return 0
        else
            echo "❌ Configuration rollback failed, escalating..."
            return 1
        fi
    else
        echo "❌ No previous configuration found"
        return 1
    fi
}

rollback_configuration
```

### Level 2: Container Image Rollback

**Use Case**: New container images causing failures
**Recovery Time**: ~2-3 minutes

```bash
#!/bin/bash
# scripts/rollback-images.sh

rollback_container_images() {
    echo "🔄 Starting container image rollback..."
    
    # Get previous image tags
    previous_tag=$(git describe --tags --abbrev=0 HEAD~1)
    current_tag=$(git describe --tags --abbrev=0)
    
    echo "Rolling back from $current_tag to $previous_tag"
    
    # Pull previous images
    services=("website" "cms" "api-gateway")
    
    for service in "${services[@]}"; do
        echo "🔄 Rolling back $service to $previous_tag"
        
        # Tag current image as backup
        docker tag saas-platform/$service:$current_tag saas-platform/$service:backup-$current_tag
        
        # Check if previous image exists
        if docker image inspect saas-platform/$service:$previous_tag >/dev/null 2>&1; then
            # Use existing previous image
            docker tag saas-platform/$service:$previous_tag saas-platform/$service:latest
        else
            # Rebuild from previous commit
            git checkout $previous_tag
            docker compose build $service
            git checkout -
        fi
    done
    
    # Restart services with previous images
    docker compose down
    docker compose up -d
    
    # Wait for startup
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    # Verify rollback success
    ./scripts/health-check.sh
    if [ $? -eq 0 ]; then
        echo "✅ Container image rollback successful"
        
        # Update image tags
        for service in "${services[@]}"; do
            docker tag saas-platform/$service:latest saas-platform/$service:$previous_tag
        done
        
        return 0
    else
        echo "❌ Container image rollback failed, escalating..."
        return 1
    fi
}

rollback_container_images
```

### Level 3: Code Version Rollback

**Use Case**: Code changes causing system failures
**Recovery Time**: ~5 minutes

```bash
#!/bin/bash
# scripts/rollback-code.sh

rollback_code_version() {
    echo "🔄 Starting code version rollback..."
    
    # Determine rollback target
    if [ -n "$1" ]; then
        target_commit=$1
    else
        # Find last known good commit
        target_commit=$(git log --oneline --grep="✅" -1 --format="%H")
        if [ -z "$target_commit" ]; then
            # Fallback to previous commit
            target_commit="HEAD~1"
        fi
    fi
    
    echo "Rolling back to commit: $target_commit"
    
    # Create backup branch
    backup_branch="backup-$(date +%Y%m%d_%H%M%S)"
    git checkout -b $backup_branch
    git checkout main
    
    # Stash any uncommitted changes
    git stash push -m "Pre-rollback stash $(date)"
    
    # Rollback to target commit
    git reset --hard $target_commit
    
    # Rebuild containers with rolled back code
    echo "🔨 Rebuilding containers with rolled back code..."
    docker compose down
    docker compose build --no-cache
    
    # Start services
    docker compose up -d
    
    # Wait for startup
    echo "⏳ Waiting for services to start..."
    sleep 60
    
    # Verify rollback success
    ./scripts/health-check.sh
    if [ $? -eq 0 ]; then
        echo "✅ Code version rollback successful"
        
        # Tag as known good
        git tag -a "rollback-success-$(date +%Y%m%d_%H%M%S)" -m "Successful rollback to $target_commit"
        
        return 0
    else
        echo "❌ Code version rollback failed, escalating..."
        
        # Restore original state
        git checkout $backup_branch
        git checkout main
        git reset --hard $backup_branch
        
        return 1
    fi
}

rollback_code_version $1
```

### Level 4: Full System Rollback

**Use Case**: Complete system failure
**Recovery Time**: ~10 minutes

```bash
#!/bin/bash
# scripts/rollback-full-system.sh

rollback_full_system() {
    echo "🚨 Starting full system rollback..."
    
    # Stop all services
    echo "🛑 Stopping all services..."
    docker compose down -v
    
    # Clean up containers and networks
    docker system prune -f
    
    # Restore from last known good backup
    backup_dir="backups/system/last-known-good"
    
    if [ ! -d "$backup_dir" ]; then
        echo "❌ No system backup found, cannot perform full rollback"
        return 1
    fi
    
    echo "📦 Restoring from system backup..."
    
    # Restore code
    if [ -f "$backup_dir/code.tar.gz" ]; then
        tar -xzf "$backup_dir/code.tar.gz" -C .
    fi
    
    # Restore configuration
    if [ -f "$backup_dir/.env" ]; then
        cp "$backup_dir/.env" .
    fi
    
    if [ -f "$backup_dir/docker-compose.yml" ]; then
        cp "$backup_dir/docker-compose.yml" .
    fi
    
    # Restore database
    echo "🗄️ Restoring database..."
    docker compose up -d postgres
    sleep 10
    
    if [ -f "$backup_dir/database.sql" ]; then
        docker compose exec -T postgres psql -U app app < "$backup_dir/database.sql"
    fi
    
    # Restore media files
    if [ -f "$backup_dir/media.tar.gz" ]; then
        docker compose up -d media
        sleep 5
        docker compose exec media tar -xzf - -C /data < "$backup_dir/media.tar.gz"
    fi
    
    # Rebuild and start all services
    echo "🔨 Rebuilding all services..."
    docker compose build --no-cache
    docker compose up -d
    
    # Extended wait for full system startup
    echo "⏳ Waiting for full system startup..."
    sleep 120
    
    # Comprehensive health check
    ./scripts/health-check.sh
    if [ $? -eq 0 ]; then
        echo "✅ Full system rollback successful"
        
        # Create recovery log
        echo "$(date): Full system rollback completed successfully" >> logs/rollback.log
        
        return 0
    else
        echo "❌ Full system rollback failed"
        echo "$(date): Full system rollback failed" >> logs/rollback.log
        
        return 1
    fi
}

rollback_full_system
```

## Automated Rollback System

### Main Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh - Main rollback orchestrator

set -e

ROLLBACK_LOG="logs/rollback.log"
mkdir -p logs

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a $ROLLBACK_LOG
}

rollback_main() {
    local trigger=${1:-"manual"}
    local level=${2:-"auto"}
    
    log_message "🚨 Rollback initiated - Trigger: $trigger, Level: $level"
    
    # Create incident report
    incident_id="INC-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "incidents/$incident_id"
    
    # Collect diagnostic information
    echo "📊 Collecting diagnostic information..."
    docker compose ps > "incidents/$incident_id/container-status.txt"
    docker compose logs --tail=100 > "incidents/$incident_id/service-logs.txt"
    docker stats --no-stream > "incidents/$incident_id/resource-usage.txt"
    
    # Determine rollback level if auto
    if [ "$level" = "auto" ]; then
        level=$(determine_rollback_level)
    fi
    
    log_message "📋 Executing rollback level: $level"
    
    case $level in
        "config"|"1")
            if ./scripts/rollback-config.sh; then
                log_message "✅ Configuration rollback successful"
                return 0
            fi
            ;&  # Fall through to next level
        "images"|"2")
            if ./scripts/rollback-images.sh; then
                log_message "✅ Container image rollback successful"
                return 0
            fi
            ;&  # Fall through to next level
        "code"|"3")
            if ./scripts/rollback-code.sh; then
                log_message "✅ Code version rollback successful"
                return 0
            fi
            ;&  # Fall through to next level
        "full"|"4")
            if ./scripts/rollback-full-system.sh; then
                log_message "✅ Full system rollback successful"
                return 0
            else
                log_message "❌ All rollback levels failed - manual intervention required"
                send_alert "CRITICAL: All automated rollback procedures failed"
                return 1
            fi
            ;;
        *)
            log_message "❌ Invalid rollback level: $level"
            return 1
            ;;
    esac
}

determine_rollback_level() {
    # Check if it's a configuration issue
    if docker compose config >/dev/null 2>&1; then
        echo "config"
        return
    fi
    
    # Check if containers are running but unhealthy
    if [ $(docker compose ps --services --filter "status=running" | wc -l) -gt 0 ]; then
        echo "images"
        return
    fi
    
    # Check if it's a code issue (containers won't start)
    if [ $(docker compose ps --services --filter "status=exited" | wc -l) -gt 0 ]; then
        echo "code"
        return
    fi
    
    # Default to full rollback
    echo "full"
}

send_alert() {
    local message=$1
    
    # Log alert
    log_message "🚨 ALERT: $message"
    
    # Send notification (implement based on your notification system)
    # Examples:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$message\"}" \
    #   $SLACK_WEBHOOK_URL
    
    # echo "$message" | mail -s "System Alert" admin@company.com
}

# Main execution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    rollback_main "$@"
fi
```

### Continuous Monitoring

```bash
#!/bin/bash
# scripts/continuous-health-monitor.sh

MONITOR_INTERVAL=${CHECK_INTERVAL:-30}
FAILURE_THRESHOLD=${FAILURE_THRESHOLD:-3}
ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-true}

consecutive_failures=0

while true; do
    if ./scripts/health-check.sh >/dev/null 2>&1; then
        consecutive_failures=0
        echo "$(date): All services healthy"
    else
        consecutive_failures=$((consecutive_failures + 1))
        echo "$(date): Health check failed ($consecutive_failures/$FAILURE_THRESHOLD)"
        
        if [ $consecutive_failures -ge $FAILURE_THRESHOLD ] && [ "$ROLLBACK_ENABLED" = "true" ]; then
            echo "$(date): Failure threshold reached, initiating rollback"
            ./scripts/rollback.sh auto
            consecutive_failures=0
        fi
    fi
    
    sleep $MONITOR_INTERVAL
done
```

## Backup Procedures

### Automated Backup System

```bash
#!/bin/bash
# scripts/create-backup.sh

create_system_backup() {
    local backup_type=${1:-"scheduled"}
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="backups/system/$timestamp"
    
    echo "📦 Creating system backup: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Backup code (excluding node_modules and build artifacts)
    echo "💾 Backing up code..."
    tar --exclude='node_modules' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='.turbo' \
        -czf "$backup_dir/code.tar.gz" \
        apps/ packages/ backend/ scripts/ *.json *.yml *.md
    
    # Backup configuration
    echo "⚙️ Backing up configuration..."
    cp .env "$backup_dir/" 2>/dev/null || echo "No .env file found"
    cp docker-compose.yml "$backup_dir/"
    cp -r .kiro "$backup_dir/" 2>/dev/null || echo "No .kiro directory found"
    
    # Backup database
    echo "🗄️ Backing up database..."
    if docker compose ps postgres | grep -q "Up"; then
        docker compose exec postgres pg_dump -U app app > "$backup_dir/database.sql"
    else
        echo "⚠️ PostgreSQL not running, skipping database backup"
    fi
    
    # Backup media files
    echo "🖼️ Backing up media files..."
    if docker compose ps media | grep -q "Up"; then
        docker compose exec media tar -czf - /data/media > "$backup_dir/media.tar.gz" 2>/dev/null || echo "No media files found"
    fi
    
    # Create backup manifest
    cat > "$backup_dir/manifest.json" << EOF
{
  "timestamp": "$timestamp",
  "type": "$backup_type",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "docker_images": $(docker images --format "table {{.Repository}}:{{.Tag}}" | grep saas-platform | jq -R . | jq -s .),
  "services_status": $(docker compose ps --format json | jq -s .)
}
EOF
    
    # Update last known good backup if this is a successful deployment
    if [ "$backup_type" = "pre-deployment" ] && ./scripts/health-check.sh >/dev/null 2>&1; then
        rm -rf backups/system/last-known-good
        cp -r "$backup_dir" backups/system/last-known-good
        echo "✅ Updated last known good backup"
    fi
    
    echo "✅ System backup completed: $backup_dir"
    
    # Cleanup old backups (keep last 10)
    ls -1t backups/system/ | grep -E '^[0-9]{8}_[0-9]{6}$' | tail -n +11 | xargs -I {} rm -rf "backups/system/{}"
}

# Schedule automatic backups
if [ "$1" = "schedule" ]; then
    while true; do
        create_system_backup "scheduled"
        sleep 3600  # Backup every hour
    done
else
    create_system_backup "$1"
fi
```

### Pre-Deployment Backup

```bash
#!/bin/bash
# scripts/pre-deployment-backup.sh

echo "🔄 Creating pre-deployment backup..."

# Ensure system is healthy before backup
if ! ./scripts/health-check.sh; then
    echo "⚠️ System is not healthy, backup may be incomplete"
fi

# Create backup
./scripts/create-backup.sh "pre-deployment"

# Verify backup integrity
backup_dir=$(ls -1t backups/system/ | grep -E '^[0-9]{8}_[0-9]{6}$' | head -1)
if [ -f "backups/system/$backup_dir/manifest.json" ]; then
    echo "✅ Pre-deployment backup verified: $backup_dir"
else
    echo "❌ Pre-deployment backup failed"
    exit 1
fi
```

## Recovery Procedures

### Database Recovery

```bash
#!/bin/bash
# scripts/recover-database.sh

recover_database() {
    local backup_file=${1:-"backups/system/last-known-good/database.sql"}
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Database backup file not found: $backup_file"
        return 1
    fi
    
    echo "🗄️ Recovering database from: $backup_file"
    
    # Stop services that depend on database
    docker compose stop website cms api-gateway
    
    # Restart PostgreSQL
    docker compose restart postgres
    sleep 10
    
    # Drop and recreate database
    docker compose exec postgres psql -U app -c "DROP DATABASE IF EXISTS app;"
    docker compose exec postgres psql -U app -c "CREATE DATABASE app;"
    
    # Restore from backup
    docker compose exec -T postgres psql -U app app < "$backup_file"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database recovery successful"
        
        # Restart dependent services
        docker compose start website cms api-gateway
        sleep 30
        
        # Verify recovery
        ./scripts/health-check.sh
        return $?
    else
        echo "❌ Database recovery failed"
        return 1
    fi
}

recover_database "$1"
```

### Media Files Recovery

```bash
#!/bin/bash
# scripts/recover-media.sh

recover_media() {
    local backup_file=${1:-"backups/system/last-known-good/media.tar.gz"}
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Media backup file not found: $backup_file"
        return 1
    fi
    
    echo "🖼️ Recovering media files from: $backup_file"
    
    # Ensure media service is running
    docker compose up -d media
    sleep 5
    
    # Clear existing media files
    docker compose exec media rm -rf /data/media/*
    
    # Restore from backup
    docker compose exec -i media tar -xzf - -C /data < "$backup_file"
    
    if [ $? -eq 0 ]; then
        echo "✅ Media files recovery successful"
        return 0
    else
        echo "❌ Media files recovery failed"
        return 1
    fi
}

recover_media "$1"
```

## Emergency Procedures

### Emergency Stop

```bash
#!/bin/bash
# scripts/emergency-stop.sh

echo "🚨 EMERGENCY STOP INITIATED"

# Stop all services immediately
docker compose down --timeout 10

# Kill any remaining containers
docker kill $(docker ps -q) 2>/dev/null || true

# Clean up networks
docker network prune -f

echo "🛑 All services stopped"
echo "$(date): Emergency stop executed" >> logs/emergency.log
```

### Emergency Recovery

```bash
#!/bin/bash
# scripts/emergency-recovery.sh

echo "🚨 EMERGENCY RECOVERY INITIATED"

# Clean up everything
docker compose down -v
docker system prune -af

# Restore from last known good backup
if [ -d "backups/system/last-known-good" ]; then
    echo "📦 Restoring from last known good backup..."
    ./scripts/rollback-full-system.sh
else
    echo "❌ No backup available, manual recovery required"
    exit 1
fi

echo "$(date): Emergency recovery completed" >> logs/emergency.log
```

## Monitoring and Alerting

### Integration with Monitoring Systems

```yaml
# monitoring/docker-compose.monitoring.yml
version: "3.9"
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
      
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
```

### Alert Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: rollback_alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          description: "Service has been down for more than 2 minutes"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} which is above threshold"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"
```

## Testing Rollback Procedures

### Rollback Testing Script

```bash
#!/bin/bash
# scripts/test-rollback.sh

test_rollback_procedures() {
    echo "🧪 Testing rollback procedures..."
    
    # Create test backup
    ./scripts/create-backup.sh "test"
    
    # Test configuration rollback
    echo "Testing configuration rollback..."
    cp .env .env.backup
    echo "TEST_VAR=broken" >> .env
    
    if ./scripts/rollback-config.sh; then
        echo "✅ Configuration rollback test passed"
    else
        echo "❌ Configuration rollback test failed"
        cp .env.backup .env
    fi
    
    # Test health check system
    echo "Testing health check system..."
    if ./scripts/health-check.sh; then
        echo "✅ Health check test passed"
    else
        echo "❌ Health check test failed"
    fi
    
    # Cleanup
    rm -f .env.backup
    
    echo "🧪 Rollback testing completed"
}

test_rollback_procedures
```

For more information, see:
- [Docker Development Guide](./DOCKER_DEVELOPMENT_GUIDE.md)
- [Docker Troubleshooting Guide](./DOCKER_TROUBLESHOOTING_GUIDE.md)
- [Docker Testing Guide](./DOCKER_TESTING_GUIDE.md)
#!/bin/bash

# Docker Build with Performance Monitoring
# Wraps docker build/compose commands with performance tracking

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
METRICS_DIR="$PROJECT_ROOT/monitoring/build-metrics"
ENABLE_MONITORING=${ENABLE_BUILD_MONITORING:-true}

# Ensure metrics directory exists
mkdir -p "$METRICS_DIR"

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✅ $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ❌ $1"
}

# Function to check if monitoring is enabled
is_monitoring_enabled() {
    [[ "$ENABLE_MONITORING" == "true" ]]
}

# Function to start performance monitoring
start_monitoring() {
    if ! is_monitoring_enabled; then
        return 0
    fi

    log "Starting build performance monitoring..."
    
    # Start resource monitoring in background
    {
        while true; do
            echo "$(date '+%Y-%m-%d %H:%M:%S'),$(docker system df --format 'table {{.Type}}\t{{.Size}}' | tail -n +2 | tr '\n' ';')" >> "$METRICS_DIR/resource-usage.csv"
            sleep 10
        done
    } &
    
    MONITOR_PID=$!
    echo $MONITOR_PID > "$METRICS_DIR/monitor.pid"
    
    log "Resource monitoring started (PID: $MONITOR_PID)"
}

# Function to stop performance monitoring
stop_monitoring() {
    if ! is_monitoring_enabled; then
        return 0
    fi

    if [[ -f "$METRICS_DIR/monitor.pid" ]]; then
        MONITOR_PID=$(cat "$METRICS_DIR/monitor.pid")
        if kill -0 $MONITOR_PID 2>/dev/null; then
            kill $MONITOR_PID
            log "Resource monitoring stopped"
        fi
        rm -f "$METRICS_DIR/monitor.pid"
    fi
}

# Function to build with cache analysis
build_with_cache_analysis() {
    local service="$1"
    local dockerfile="$2"
    local build_args="$3"
    
    log "Building $service with cache analysis..."
    
    # Prepare build command
    local build_cmd
    if [[ -n "$dockerfile" ]]; then
        build_cmd="docker build -f $dockerfile $build_args -t $service ."
    else
        build_cmd="docker compose build $build_args $service"
    fi
    
    # Enable BuildKit for better cache analysis
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain
    
    # Run build with output capture
    local build_output_file="$METRICS_DIR/build-output-$service-$(date +%s).log"
    local start_time=$(date +%s)
    
    log "Executing: $build_cmd"
    
    if eval "$build_cmd" 2>&1 | tee "$build_output_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Build completed for $service in ${duration}s"
        
        # Analyze cache performance
        analyze_cache_performance "$service" "$build_output_file" "$duration"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_error "Build failed for $service after ${duration}s"
        return 1
    fi
}

# Function to analyze cache performance from build output
analyze_cache_performance() {
    local service="$1"
    local output_file="$2"
    local duration="$3"
    
    if ! is_monitoring_enabled; then
        return 0
    fi
    
    log "Analyzing cache performance for $service..."
    
    # Count cache hits and misses
    local cache_hits=$(grep -c "CACHED" "$output_file" || echo "0")
    local total_steps=$(grep -c "DONE" "$output_file" || echo "1")
    local cache_misses=$((total_steps - cache_hits))
    local hit_rate=0
    
    if [[ $total_steps -gt 0 ]]; then
        hit_rate=$(echo "scale=1; $cache_hits * 100 / $total_steps" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Get image size
    local image_size=$(docker images "$service" --format "{{.Size}}" | head -1 || echo "unknown")
    
    # Create cache report
    local cache_report="$METRICS_DIR/cache-report-$service-$(date +%s).json"
    cat > "$cache_report" << EOF
{
  "service": "$service",
  "timestamp": "$(date -Iseconds)",
  "build_duration": $duration,
  "cache_stats": {
    "hits": $cache_hits,
    "misses": $cache_misses,
    "total_steps": $total_steps,
    "hit_rate": $hit_rate
  },
  "image_size": "$image_size",
  "output_file": "$output_file"
}
EOF
    
    log "Cache analysis: $cache_hits/$total_steps hits (${hit_rate}%) - Image size: $image_size"
    
    # Check for performance issues
    if [[ $(echo "$hit_rate < 30" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        log_warning "Low cache hit rate for $service: ${hit_rate}%"
    fi
    
    if [[ $duration -gt 120 ]]; then
        log_warning "Slow build for $service: ${duration}s (target: <120s)"
    fi
}

# Function to generate build summary
generate_build_summary() {
    if ! is_monitoring_enabled; then
        return 0
    fi
    
    log "Generating build summary..."
    
    local summary_file="$METRICS_DIR/build-summary-$(date +%s).json"
    local total_duration=$(($(date +%s) - BUILD_START_TIME))
    
    # Collect all cache reports from this build session
    local cache_reports=$(find "$METRICS_DIR" -name "cache-report-*-*.json" -newer "$METRICS_DIR/build-start-marker" 2>/dev/null || echo "")
    
    cat > "$summary_file" << EOF
{
  "build_session": {
    "start_time": "$(date -d @$BUILD_START_TIME -Iseconds)",
    "end_time": "$(date -Iseconds)",
    "total_duration": $total_duration
  },
  "services_built": [
EOF
    
    # Add cache reports
    local first=true
    for report in $cache_reports; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$summary_file"
        fi
        cat "$report" >> "$summary_file"
    done
    
    cat >> "$summary_file" << EOF
  ],
  "performance_summary": {
    "total_build_time": $total_duration,
    "target_build_time": 120,
    "meets_target": $(if [[ $total_duration -le 120 ]]; then echo "true"; else echo "false"; fi)
  }
}
EOF
    
    log_success "Build summary saved to: $summary_file"
    
    # Show quick summary
    echo ""
    echo "📊 Build Performance Summary"
    echo "============================"
    echo "Total Duration: ${total_duration}s"
    echo "Target: 120s"
    if [[ $total_duration -le 120 ]]; then
        echo "Status: ✅ Meets performance target"
    else
        echo "Status: ⚠️  Exceeds performance target"
    fi
    
    # Show cache performance for each service
    for report in $cache_reports; do
        if [[ -f "$report" ]]; then
            local service=$(jq -r '.service' "$report" 2>/dev/null || echo "unknown")
            local hit_rate=$(jq -r '.cache_stats.hit_rate' "$report" 2>/dev/null || echo "0")
            local duration=$(jq -r '.build_duration' "$report" 2>/dev/null || echo "0")
            echo "$service: ${duration}s, ${hit_rate}% cache hit rate"
        fi
    done
}

# Function to cleanup old metrics
cleanup_old_metrics() {
    if ! is_monitoring_enabled; then
        return 0
    fi
    
    # Keep only last 50 build outputs and reports
    find "$METRICS_DIR" -name "build-output-*.log" -type f | sort | head -n -50 | xargs rm -f 2>/dev/null || true
    find "$METRICS_DIR" -name "cache-report-*.json" -type f | sort | head -n -50 | xargs rm -f 2>/dev/null || true
    find "$METRICS_DIR" -name "build-summary-*.json" -type f | sort | head -n -20 | xargs rm -f 2>/dev/null || true
    
    # Keep resource usage data for last 7 days
    find "$METRICS_DIR" -name "resource-usage.csv" -mtime +7 -delete 2>/dev/null || true
}

# Main build function
main() {
    local command="$1"
    shift
    
    # Set up build session
    BUILD_START_TIME=$(date +%s)
    touch "$METRICS_DIR/build-start-marker"
    
    # Cleanup old metrics
    cleanup_old_metrics
    
    # Start monitoring
    start_monitoring
    
    # Trap to ensure cleanup on exit
    trap 'stop_monitoring; generate_build_summary' EXIT
    
    case "$command" in
        "compose")
            log "Building with docker compose..."
            if docker compose build "$@"; then
                log_success "Docker compose build completed"
            else
                log_error "Docker compose build failed"
                exit 1
            fi
            ;;
        "service")
            local service="$1"
            local dockerfile="$2"
            local build_args="${@:3}"
            
            if [[ -z "$service" ]]; then
                log_error "Service name required for service build"
                exit 1
            fi
            
            build_with_cache_analysis "$service" "$dockerfile" "$build_args"
            ;;
        "all")
            log "Building all services..."
            local services=("website" "cms")
            local failed_services=()
            
            for service in "${services[@]}"; do
                if ! build_with_cache_analysis "$service"; then
                    failed_services+=("$service")
                fi
            done
            
            if [[ ${#failed_services[@]} -gt 0 ]]; then
                log_error "Build failed for services: ${failed_services[*]}"
                exit 1
            else
                log_success "All services built successfully"
            fi
            ;;
        *)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  compose [args...]     - Build with docker compose"
            echo "  service <name> [dockerfile] [args...]  - Build specific service"
            echo "  all                   - Build all services"
            echo ""
            echo "Environment variables:"
            echo "  ENABLE_BUILD_MONITORING=true|false  - Enable/disable monitoring (default: true)"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v docker &> /dev/null; then
    log_error "Docker is required but not installed"
    exit 1
fi

if is_monitoring_enabled && ! command -v jq &> /dev/null; then
    log_warning "jq is not installed - some monitoring features will be limited"
fi

if is_monitoring_enabled && ! command -v bc &> /dev/null; then
    log_warning "bc is not installed - cache hit rate calculations will be limited"
fi

# Run main function
main "$@"
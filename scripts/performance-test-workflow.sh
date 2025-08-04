#!/bin/bash

# Performance Testing Workflow
# Comprehensive performance testing including build and runtime monitoring

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
METRICS_DIR="$PROJECT_ROOT/monitoring"

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

# Function to check if containers are running
check_containers() {
    log "Checking container status..."
    
    local required_containers=("website" "cms")
    local missing_containers=()
    
    for container in "${required_containers[@]}"; do
        if ! docker compose ps | grep -q "$container.*Up"; then
            missing_containers+=("$container")
        fi
    done
    
    if [[ ${#missing_containers[@]} -gt 0 ]]; then
        log_warning "Missing containers: ${missing_containers[*]}"
        log "Starting containers..."
        docker compose up -d "${missing_containers[@]}"
        
        # Wait for containers to be ready
        sleep 10
    fi
    
    log_success "All required containers are running"
}

# Function to run build performance test
run_build_performance_test() {
    log "Starting build performance test..."
    
    # Clean up any existing containers to get accurate build times
    log "Cleaning up existing containers for accurate build timing..."
    docker compose down --remove-orphans
    
    # Run monitored build
    if "$SCRIPT_DIR/docker-build-monitored.sh" all; then
        log_success "Build performance test completed"
        
        # Run build alerts check
        if node "$SCRIPT_DIR/build-alerts.js" check; then
            log_success "Build performance within acceptable limits"
        else
            log_warning "Build performance alerts detected"
        fi
        
        return 0
    else
        log_error "Build performance test failed"
        return 1
    fi
}

# Function to run runtime performance test
run_runtime_performance_test() {
    log "Starting runtime performance test..."
    
    # Ensure containers are running
    check_containers
    
    # Wait for containers to be fully ready
    log "Waiting for containers to be fully ready..."
    sleep 15
    
    # Run runtime performance monitoring
    if node "$SCRIPT_DIR/runtime-performance-monitor.js" full; then
        log_success "Runtime performance test completed"
        return 0
    else
        log_error "Runtime performance test failed"
        return 1
    fi
}

# Function to run regression test
run_regression_test() {
    log "Starting performance regression test..."
    
    if node "$SCRIPT_DIR/performance-regression-test.js" test; then
        log_success "No critical performance regressions detected"
        return 0
    else
        log_warning "Performance regressions detected"
        return 1
    fi
}

# Function to generate comprehensive report
generate_comprehensive_report() {
    log "Generating comprehensive performance report..."
    
    local report_file="$METRICS_DIR/comprehensive-report-$(date +%s).md"
    
    cat > "$report_file" << EOF
# Comprehensive Performance Report

Generated: $(date)

## Build Performance

EOF
    
    # Add build metrics if available
    if [[ -f "$METRICS_DIR/build-metrics/latest.json" ]]; then
        echo "### Latest Build Metrics" >> "$report_file"
        echo '```json' >> "$report_file"
        cat "$METRICS_DIR/build-metrics/latest.json" >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add runtime metrics if available
    if [[ -f "$METRICS_DIR/runtime-metrics/latest.json" ]]; then
        echo "### Latest Runtime Metrics" >> "$report_file"
        echo '```json' >> "$report_file"
        cat "$METRICS_DIR/runtime-metrics/latest.json" >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add regression test results if available
    if [[ -f "$METRICS_DIR/runtime-metrics/latest-regression.json" ]]; then
        echo "### Regression Test Results" >> "$report_file"
        echo '```json' >> "$report_file"
        cat "$METRICS_DIR/runtime-metrics/latest-regression.json" >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add alerts if available
    if [[ -f "$METRICS_DIR/alerts/latest.json" ]]; then
        echo "### Performance Alerts" >> "$report_file"
        echo '```json' >> "$report_file"
        cat "$METRICS_DIR/alerts/latest.json" >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    log_success "Comprehensive report generated: $report_file"
}

# Function to start metrics exporter
start_metrics_exporter() {
    log "Starting metrics exporter..."
    
    # Check if already running
    if pgrep -f "build-metrics-exporter.js" > /dev/null; then
        log "Metrics exporter already running"
        return 0
    fi
    
    # Start in background
    nohup node "$SCRIPT_DIR/build-metrics-exporter.js" serve > "$METRICS_DIR/exporter.log" 2>&1 &
    local exporter_pid=$!
    
    # Wait a moment and check if it started successfully
    sleep 2
    if kill -0 $exporter_pid 2>/dev/null; then
        log_success "Metrics exporter started (PID: $exporter_pid)"
        echo $exporter_pid > "$METRICS_DIR/exporter.pid"
        return 0
    else
        log_error "Failed to start metrics exporter"
        return 1
    fi
}

# Function to stop metrics exporter
stop_metrics_exporter() {
    if [[ -f "$METRICS_DIR/exporter.pid" ]]; then
        local pid=$(cat "$METRICS_DIR/exporter.pid")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            log "Metrics exporter stopped"
        fi
        rm -f "$METRICS_DIR/exporter.pid"
    fi
}

# Function to show performance summary
show_performance_summary() {
    echo ""
    echo "📊 Performance Test Summary"
    echo "=========================="
    
    # Build performance summary
    if [[ -f "$METRICS_DIR/build-metrics/latest.json" ]]; then
        local build_duration=$(jq -r '.totalDuration // 0' "$METRICS_DIR/build-metrics/latest.json")
        local build_duration_sec=$((build_duration / 1000))
        echo "Build Duration: ${build_duration_sec}s"
        
        # Cache hit rates
        local cache_stats=$(jq -r '.cacheStats // {}' "$METRICS_DIR/build-metrics/latest.json")
        if [[ "$cache_stats" != "{}" ]]; then
            echo "Cache Performance:"
            jq -r '.cacheStats | to_entries[] | "  \(.key): \(.value.hitRate)% hit rate"' "$METRICS_DIR/build-metrics/latest.json"
        fi
    fi
    
    # Runtime performance summary
    if [[ -f "$METRICS_DIR/runtime-metrics/latest.json" ]]; then
        echo ""
        echo "Runtime Performance:"
        
        # Page load times
        local page_tests=$(jq -r '.pageLoadTests // {}' "$METRICS_DIR/runtime-metrics/latest.json")
        if [[ "$page_tests" != "{}" ]]; then
            jq -r '.pageLoadTests | to_entries[] | select(.value.success) | "  \(.key): \(.value.loadTime)ms"' "$METRICS_DIR/runtime-metrics/latest.json"
        fi
        
        # Resource usage
        local resource_summary=$(jq -r '.resourceUsage.summary // {}' "$METRICS_DIR/runtime-metrics/latest.json")
        if [[ "$resource_summary" != "{}" ]]; then
            echo "  Resource Usage:"
            jq -r '.resourceUsage.summary | to_entries[] | "    \(.key): \(.value.cpu.avg | tostring | .[0:4])% CPU, \(.value.memory.avg / 1024 / 1024 | floor)MB RAM"' "$METRICS_DIR/runtime-metrics/latest.json"
        fi
    fi
    
    # Regression summary
    if [[ -f "$METRICS_DIR/runtime-metrics/latest-regression.json" ]]; then
        local regression_count=$(jq -r '.summary.total // 0' "$METRICS_DIR/runtime-metrics/latest-regression.json")
        local critical_count=$(jq -r '.summary.critical // 0' "$METRICS_DIR/runtime-metrics/latest-regression.json")
        
        echo ""
        if [[ $regression_count -eq 0 ]]; then
            echo "Regressions: ✅ None detected"
        else
            echo "Regressions: ⚠️  $regression_count total ($critical_count critical)"
        fi
    fi
}

# Main function
main() {
    local command="$1"
    shift
    
    case "$command" in
        "full")
            log "Starting full performance test workflow..."
            
            local build_success=true
            local runtime_success=true
            local regression_success=true
            
            # Start metrics exporter
            start_metrics_exporter
            
            # Trap to ensure cleanup
            trap 'stop_metrics_exporter' EXIT
            
            # Run build performance test
            if ! run_build_performance_test; then
                build_success=false
            fi
            
            # Run runtime performance test
            if ! run_runtime_performance_test; then
                runtime_success=false
            fi
            
            # Run regression test
            if ! run_regression_test; then
                regression_success=false
            fi
            
            # Generate comprehensive report
            generate_comprehensive_report
            
            # Show summary
            show_performance_summary
            
            # Determine exit code
            if [[ "$build_success" == "true" && "$runtime_success" == "true" && "$regression_success" == "true" ]]; then
                log_success "All performance tests passed"
                exit 0
            else
                log_warning "Some performance tests failed or detected issues"
                exit 1
            fi
            ;;
            
        "build")
            run_build_performance_test
            ;;
            
        "runtime")
            run_runtime_performance_test
            ;;
            
        "regression")
            run_regression_test
            ;;
            
        "report")
            generate_comprehensive_report
            ;;
            
        "summary")
            show_performance_summary
            ;;
            
        "exporter")
            local action="$1"
            case "$action" in
                "start")
                    start_metrics_exporter
                    ;;
                "stop")
                    stop_metrics_exporter
                    ;;
                *)
                    echo "Usage: $0 exporter [start|stop]"
                    exit 1
                    ;;
            esac
            ;;
            
        *)
            echo "Performance Testing Workflow"
            echo ""
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  full                  - Run complete performance test workflow"
            echo "  build                 - Run build performance test only"
            echo "  runtime               - Run runtime performance test only"
            echo "  regression            - Run regression test only"
            echo "  report                - Generate comprehensive report"
            echo "  summary               - Show performance summary"
            echo "  exporter start|stop   - Control metrics exporter"
            echo ""
            echo "Environment variables:"
            echo "  ENABLE_BUILD_MONITORING=true|false  - Enable/disable build monitoring"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v docker &> /dev/null; then
    log_error "Docker is required but not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_warning "jq is not installed - some features will be limited"
fi

# Ensure metrics directories exist
mkdir -p "$METRICS_DIR/build-metrics"
mkdir -p "$METRICS_DIR/runtime-metrics"
mkdir -p "$METRICS_DIR/alerts"

# Run main function
main "$@"
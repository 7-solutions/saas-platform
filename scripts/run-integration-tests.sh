#!/bin/bash

# Comprehensive Integration Test Runner
# Runs all integration and end-to-end tests for the SaaS platform

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
LOG_DIR="$PROJECT_ROOT/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test configuration
export NODE_ENV=test
export API_BASE_URL=http://localhost:8080
export CMS_URL=http://localhost:3001
export TEST_WITH_AUTH=false  # Set to true if auth is configured

# Create log directory
mkdir -p "$LOG_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    local log_file="$LOG_DIR/${test_name}_${TIMESTAMP}.log"
    
    log_info "Running $test_name..."
    
    if eval "$test_command" > "$log_file" 2>&1; then
        log_success "$test_name completed successfully"
        return 0
    else
        log_error "$test_name failed (see $log_file for details)"
        return 1
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check Playwright
    if ! command -v npx &> /dev/null; then
        log_error "npx is not available"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

setup_environment() {
    log_info "Setting up test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Build the project
    log_info "Building the project..."
    pnpm build
    
    # Start services
    log_info "Starting services with Docker Compose..."
    docker compose down --remove-orphans || true
    docker compose up -d --build
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:8080/api/v1/health > /dev/null 2>&1; then
            log_success "Backend service is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Backend service failed to start"
            exit 1
        fi
        
        log_info "Waiting for backend service... (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    # Check frontend services
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "Website service is ready"
    else
        log_warning "Website service may not be ready"
    fi
    
    if curl -f http://localhost:3001 > /dev/null 2>&1; then
        log_success "CMS service is ready"
    else
        log_warning "CMS service may not be ready"
    fi
}

run_api_tests() {
    log_info "Running API endpoint tests..."
    
    cd "$PROJECT_ROOT"
    
    # Make test script executable
    chmod +x tests/integration/api-endpoints.test.js
    
    # Run API tests
    if node tests/integration/api-endpoints.test.js; then
        log_success "API tests completed successfully"
        return 0
    else
        log_error "API tests failed"
        return 1
    fi
}

run_load_tests() {
    log_info "Running load tests..."
    
    cd "$PROJECT_ROOT"
    
    # Make test script executable
    chmod +x tests/load/backend-load-test.js
    
    # Run load tests
    if node tests/load/backend-load-test.js; then
        log_success "Load tests completed successfully"
        return 0
    else
        log_error "Load tests failed"
        return 1
    fi
}

run_container_tests() {
    log_info "Running container orchestration tests..."
    
    cd "$PROJECT_ROOT"
    
    # Make test script executable
    chmod +x tests/integration/container-orchestration.test.js
    
    # Run container tests
    if node tests/integration/container-orchestration.test.js; then
        log_success "Container tests completed successfully"
        return 0
    else
        log_error "Container tests failed"
        return 1
    fi
}

run_security_tests() {
    log_info "Running security validation tests..."
    
    cd "$PROJECT_ROOT"
    
    # Make test script executable
    chmod +x tests/integration/security-validation.test.js
    
    # Run security tests
    if node tests/integration/security-validation.test.js; then
        log_success "Security tests completed successfully"
        return 0
    else
        log_error "Security tests failed"
        return 1
    fi
}

run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    cd "$PROJECT_ROOT"
    
    # Install Playwright browsers if needed
    npx playwright install --with-deps
    
    # Run E2E tests
    if npx playwright test; then
        log_success "E2E tests completed successfully"
        return 0
    else
        log_error "E2E tests failed"
        return 1
    fi
}

run_responsive_tests() {
    log_info "Running responsive design tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run responsive tests specifically
    if npx playwright test tests/e2e/responsive-design.spec.ts; then
        log_success "Responsive design tests completed successfully"
        return 0
    else
        log_error "Responsive design tests failed"
        return 1
    fi
}

cleanup_environment() {
    log_info "Cleaning up test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop services
    docker compose down --remove-orphans
    
    # Clean up test data
    if [ -d "$PROJECT_ROOT/backend/internal/services/uploads" ]; then
        rm -rf "$PROJECT_ROOT/backend/internal/services/uploads/test_*"
    fi
    
    log_success "Environment cleanup completed"
}

generate_report() {
    log_info "Generating test report..."
    
    local report_file="$LOG_DIR/test_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# Integration Test Report

**Date:** $(date)
**Environment:** $NODE_ENV
**API Base URL:** $API_BASE_URL
**CMS URL:** $CMS_URL

## Test Results Summary

EOF
    
    # Add test results to report
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    for log_file in "$LOG_DIR"/*_${TIMESTAMP}.log; do
        if [ -f "$log_file" ]; then
            local test_name=$(basename "$log_file" "_${TIMESTAMP}.log")
            ((total_tests++))
            
            if grep -q "PASSED\|SUCCESS\|✅" "$log_file"; then
                ((passed_tests++))
                echo "- ✅ **$test_name**: PASSED" >> "$report_file"
            else
                ((failed_tests++))
                echo "- ❌ **$test_name**: FAILED" >> "$report_file"
            fi
        fi
    done
    
    cat >> "$report_file" << EOF

## Statistics

- **Total Tests:** $total_tests
- **Passed:** $passed_tests
- **Failed:** $failed_tests
- **Success Rate:** $(( passed_tests * 100 / total_tests ))%

## Log Files

All detailed logs are available in: \`$LOG_DIR\`

EOF
    
    log_success "Test report generated: $report_file"
    
    # Display summary
    echo
    echo "=================================="
    echo "INTEGRATION TEST SUMMARY"
    echo "=================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Success Rate: $(( passed_tests * 100 / total_tests ))%"
    echo "=================================="
    
    return $failed_tests
}

# Main execution
main() {
    log_info "Starting comprehensive integration tests..."
    log_info "Timestamp: $TIMESTAMP"
    log_info "Project root: $PROJECT_ROOT"
    log_info "Log directory: $LOG_DIR"
    
    # Check dependencies
    check_dependencies
    
    # Setup environment
    setup_environment
    
    # Run all tests
    local test_failures=0
    
    # API endpoint tests
    if ! run_test "api_endpoints" "run_api_tests"; then
        ((test_failures++))
    fi
    
    # Load tests
    if ! run_test "load_tests" "run_load_tests"; then
        ((test_failures++))
    fi
    
    # Container orchestration tests
    if ! run_test "container_orchestration" "run_container_tests"; then
        ((test_failures++))
    fi
    
    # Security tests
    if ! run_test "security_validation" "run_security_tests"; then
        ((test_failures++))
    fi
    
    # End-to-end tests
    if ! run_test "e2e_tests" "run_e2e_tests"; then
        ((test_failures++))
    fi
    
    # Responsive design tests
    if ! run_test "responsive_tests" "run_responsive_tests"; then
        ((test_failures++))
    fi
    
    # Cleanup
    cleanup_environment
    
    # Generate report
    local report_failures
    report_failures=$(generate_report)
    
    # Exit with appropriate code
    if [ $test_failures -eq 0 ]; then
        log_success "All integration tests completed successfully!"
        exit 0
    else
        log_error "$test_failures test suite(s) failed"
        exit 1
    fi
}

# Handle script interruption
trap cleanup_environment EXIT

# Parse command line arguments
case "${1:-all}" in
    "api")
        check_dependencies
        setup_environment
        run_api_tests
        cleanup_environment
        ;;
    "load")
        check_dependencies
        setup_environment
        run_load_tests
        cleanup_environment
        ;;
    "container")
        check_dependencies
        run_container_tests
        ;;
    "security")
        check_dependencies
        setup_environment
        run_security_tests
        cleanup_environment
        ;;
    "e2e")
        check_dependencies
        setup_environment
        run_e2e_tests
        cleanup_environment
        ;;
    "responsive")
        check_dependencies
        setup_environment
        run_responsive_tests
        cleanup_environment
        ;;
    "all"|*)
        main
        ;;
esac
#!/bin/bash

# Docker-based E2E Testing Script with Playwright
# This script runs end-to-end tests against containerized applications

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=60
    local attempt=1
    
    print_status "Waiting for ${service_name} to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            print_success "${service_name} is ready"
            return 0
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            print_status "Attempt ${attempt}/${max_attempts}: ${service_name} not ready yet..."
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "${service_name} failed to start within timeout"
    return 1
}

# Function to start application services
start_app_services() {
    print_status "Starting application services for E2E testing..."
    
    # Start backend and database first
    docker-compose -f docker-compose.test.yml up -d couchdb-test backend-test
    
    # Wait for backend to be ready
    wait_for_service "CouchDB" "http://localhost:5985"
    wait_for_service "Backend" "http://localhost:8082/api/v1/health"
    
    # Start frontend applications
    docker-compose -f docker-compose.test.yml up -d website cms
    
    # Wait for frontend services
    wait_for_service "Website" "http://localhost:3000"
    wait_for_service "CMS" "http://localhost:3001"
    
    print_success "All application services are ready"
}

# Function to run E2E tests
run_e2e_tests() {
    local test_pattern=${1:-""}
    local browser=${2:-"chromium"}
    
    print_status "Running E2E tests with Playwright..."
    
    # Set environment variables for tests
    export WEBSITE_URL="http://localhost:3000"
    export CMS_URL="http://localhost:3001"
    export BACKEND_URL="http://localhost:8082"
    export CI=true
    
    # Build E2E test container
    print_status "Building E2E test container..."
    docker-compose -f docker-compose.test.yml build e2e-test
    
    # Run E2E tests
    local test_command="pnpm test:e2e"
    
    if [ ! -z "$test_pattern" ]; then
        test_command="$test_command --grep=\"$test_pattern\""
    fi
    
    test_command="$test_command --project=$browser --reporter=html"
    
    if docker-compose -f docker-compose.test.yml run --rm e2e-test $test_command; then
        print_success "E2E tests passed"
        return 0
    else
        print_error "E2E tests failed"
        return 1
    fi
}

# Function to run specific test suites
run_test_suite() {
    local suite=$1
    local browser=${2:-"chromium"}
    
    print_status "Running ${suite} E2E tests..."
    
    case $suite in
        "website")
            run_e2e_tests "Website E2E Tests" $browser
            ;;
        "cms")
            run_e2e_tests "CMS.*Docker" $browser
            ;;
        "responsive")
            run_e2e_tests "responsive" $browser
            ;;
        "accessibility")
            run_e2e_tests "accessible" $browser
            ;;
        *)
            print_error "Unknown test suite: ${suite}"
            print_status "Available suites: website, cms, responsive, accessibility"
            return 1
            ;;
    esac
}

# Function to run cross-browser tests
run_cross_browser_tests() {
    local browsers=("chromium" "firefox")
    local failed_browsers=()
    
    print_status "Running cross-browser E2E tests..."
    
    for browser in "${browsers[@]}"; do
        print_status "Testing with ${browser}..."
        
        if run_e2e_tests "" $browser; then
            print_success "${browser} tests passed"
        else
            print_error "${browser} tests failed"
            failed_browsers+=($browser)
        fi
    done
    
    if [ ${#failed_browsers[@]} -eq 0 ]; then
        print_success "All cross-browser tests passed"
        return 0
    else
        print_error "Failed browsers: ${failed_browsers[*]}"
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    print_status "Generating E2E test report..."
    
    # Copy test results from container
    local container_id=$(docker-compose -f docker-compose.test.yml ps -q e2e-test 2>/dev/null || echo "")
    
    if [ ! -z "$container_id" ]; then
        mkdir -p test-results/e2e
        docker cp ${container_id}:/app/test-results ./test-results/e2e/ 2>/dev/null || true
        docker cp ${container_id}:/app/playwright-report ./test-results/e2e/ 2>/dev/null || true
        
        print_success "Test report generated in test-results/e2e/"
    fi
}

# Function to cleanup test services
cleanup() {
    print_status "Cleaning up E2E test services..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    print_success "Cleanup completed"
}

# Function to display test summary
display_summary() {
    local result=$1
    
    echo ""
    echo "=========================================="
    echo "         E2E TEST SUMMARY"
    echo "=========================================="
    
    if [ $result -eq 0 ]; then
        print_success "All E2E tests passed! ✅"
        print_status "Test reports available in test-results/e2e/"
    else
        print_error "Some E2E tests failed! ❌"
        print_status "Check test-results/e2e/ for detailed reports"
    fi
    
    echo "=========================================="
    return $result
}

# Main execution
main() {
    print_status "Starting Docker-based E2E testing with Playwright..."
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Check prerequisites
    check_docker
    
    # Start application services
    start_app_services
    
    # Run E2E tests
    local result=0
    if run_e2e_tests; then
        result=0
    else
        result=1
    fi
    
    # Generate test report
    generate_test_report
    
    # Display summary
    display_summary $result
    exit $result
}

# Handle command line arguments
case "${1:-}" in
    "website"|"cms"|"responsive"|"accessibility")
        check_docker
        trap cleanup EXIT
        start_app_services
        run_test_suite "$1" "${2:-chromium}"
        generate_test_report
        ;;
    "cross-browser")
        check_docker
        trap cleanup EXIT
        start_app_services
        run_cross_browser_tests
        generate_test_report
        ;;
    "clean")
        cleanup
        ;;
    "services")
        check_docker
        start_app_services
        print_status "Application services are running for E2E testing."
        print_status "Website: http://localhost:3000"
        print_status "CMS: http://localhost:3001"
        print_status "Backend: http://localhost:8082"
        print_status "Press Ctrl+C to stop services."
        trap cleanup EXIT
        while true; do sleep 1; done
        ;;
    *)
        main
        ;;
esac
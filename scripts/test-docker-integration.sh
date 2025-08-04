#!/bin/bash

# Docker-based Integration Testing Script
# This script runs integration tests against containerized services

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
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for ${service_name} to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            print_success "${service_name} is ready"
            return 0
        fi
        
        print_status "Attempt ${attempt}/${max_attempts}: ${service_name} not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "${service_name} failed to start within timeout"
    return 1
}

# Function to start test services
start_test_services() {
    print_status "Starting test services..."
    
    # Start all test services
    docker-compose -f docker-compose.test.yml up -d couchdb-test backend-test
    
    # Wait for services to be ready
    wait_for_service "CouchDB" "http://localhost:5985"
    wait_for_service "Backend" "http://localhost:8082/api/v1/health"
    
    print_success "All test services are ready"
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Set environment variables for tests
    export BACKEND_URL="http://localhost:8082"
    export COUCHDB_URL="http://localhost:5985"
    export WEBSITE_URL="http://localhost:3000"
    export CMS_URL="http://localhost:3001"
    
    # Run integration tests
    if docker-compose -f docker-compose.test.yml run --rm integration-test; then
        print_success "Integration tests passed"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

# Function to run specific test suite
run_test_suite() {
    local suite=$1
    print_status "Running ${suite} integration tests..."
    
    case $suite in
        "api")
            docker-compose -f docker-compose.test.yml run --rm integration-test pnpm test:integration -- --testPathPattern=api-endpoints
            ;;
        "container")
            docker-compose -f docker-compose.test.yml run --rm integration-test pnpm test:integration -- --testPathPattern=container-orchestration
            ;;
        "security")
            docker-compose -f docker-compose.test.yml run --rm integration-test pnpm test:integration -- --testPathPattern=security-validation
            ;;
        *)
            print_error "Unknown test suite: ${suite}"
            print_status "Available suites: api, container, security"
            return 1
            ;;
    esac
}

# Function to cleanup test services
cleanup() {
    print_status "Cleaning up test services..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    print_success "Cleanup completed"
}

# Function to display test summary
display_summary() {
    local result=$1
    
    echo ""
    echo "=========================================="
    echo "      INTEGRATION TEST SUMMARY"
    echo "=========================================="
    
    if [ $result -eq 0 ]; then
        print_success "All integration tests passed! ✅"
    else
        print_error "Some integration tests failed! ❌"
    fi
    
    echo "=========================================="
    return $result
}

# Main execution
main() {
    print_status "Starting Docker-based integration testing..."
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Check prerequisites
    check_docker
    
    # Start test services
    start_test_services
    
    # Run integration tests
    if run_integration_tests; then
        display_summary 0
        exit 0
    else
        display_summary 1
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "api"|"container"|"security")
        check_docker
        trap cleanup EXIT
        start_test_services
        run_test_suite "$1"
        ;;
    "clean")
        cleanup
        ;;
    "services")
        check_docker
        start_test_services
        print_status "Test services are running. Press Ctrl+C to stop."
        trap cleanup EXIT
        while true; do sleep 1; done
        ;;
    *)
        main
        ;;
esac
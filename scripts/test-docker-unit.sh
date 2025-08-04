#!/bin/bash

# Docker-based Unit Testing Script
# This script runs unit tests for all applications within Docker containers

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

# Function to build test images
build_test_images() {
    print_status "Building test images..."
    
    # Build website test image
    print_status "Building website test image..."
    docker-compose -f docker-compose.test.yml build website-test
    
    # Build CMS test image
    print_status "Building CMS test image..."
    docker-compose -f docker-compose.test.yml build cms-test
    
    print_success "Test images built successfully"
}

# Function to run unit tests for a specific app
run_app_tests() {
    local app_name=$1
    local service_name="${app_name}-test"
    
    print_status "Running unit tests for ${app_name}..."
    
    # Create coverage directory if it doesn't exist
    mkdir -p coverage/${app_name}
    
    # Run tests with proper error handling
    if docker-compose -f docker-compose.test.yml run --rm ${service_name}; then
        print_success "${app_name} tests passed"
        
        # Copy coverage reports from container
        container_id=$(docker-compose -f docker-compose.test.yml ps -q ${service_name} 2>/dev/null || echo "")
        if [ ! -z "$container_id" ]; then
            docker cp ${container_id}:/app/apps/${app_name}/coverage ./coverage/${app_name}/ 2>/dev/null || true
        fi
        
        return 0
    else
        print_error "${app_name} tests failed"
        return 1
    fi
}

# Function to run TypeScript compilation tests
run_typescript_tests() {
    print_status "Running TypeScript compilation tests..."
    
    # Test website TypeScript compilation
    print_status "Checking website TypeScript compilation..."
    if docker-compose -f docker-compose.test.yml run --rm website-test pnpm --filter @saas-platform/website type-check; then
        print_success "Website TypeScript compilation passed"
    else
        print_error "Website TypeScript compilation failed"
        return 1
    fi
    
    # Test CMS TypeScript compilation
    print_status "Checking CMS TypeScript compilation..."
    if docker-compose -f docker-compose.test.yml run --rm cms-test pnpm --filter @saas-platform/cms type-check; then
        print_success "CMS TypeScript compilation passed"
    else
        print_error "CMS TypeScript compilation failed"
        return 1
    fi
    
    print_success "All TypeScript compilation tests passed"
}

# Function to generate combined coverage report
generate_coverage_report() {
    print_status "Generating combined coverage report..."
    
    # Create combined coverage directory
    mkdir -p coverage/combined
    
    # Copy individual coverage reports
    if [ -d "coverage/website" ]; then
        cp -r coverage/website/* coverage/combined/ 2>/dev/null || true
    fi
    
    if [ -d "coverage/cms" ]; then
        cp -r coverage/cms/* coverage/combined/ 2>/dev/null || true
    fi
    
    print_success "Coverage reports generated in coverage/ directory"
}

# Function to cleanup Docker resources
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    print_success "Cleanup completed"
}

# Function to display test summary
display_summary() {
    local website_result=$1
    local cms_result=$2
    local typescript_result=$3
    
    echo ""
    echo "=========================================="
    echo "           TEST SUMMARY"
    echo "=========================================="
    
    if [ $website_result -eq 0 ]; then
        print_success "Website Unit Tests: PASSED"
    else
        print_error "Website Unit Tests: FAILED"
    fi
    
    if [ $cms_result -eq 0 ]; then
        print_success "CMS Unit Tests: PASSED"
    else
        print_error "CMS Unit Tests: FAILED"
    fi
    
    if [ $typescript_result -eq 0 ]; then
        print_success "TypeScript Compilation: PASSED"
    else
        print_error "TypeScript Compilation: FAILED"
    fi
    
    echo "=========================================="
    
    # Overall result
    if [ $website_result -eq 0 ] && [ $cms_result -eq 0 ] && [ $typescript_result -eq 0 ]; then
        print_success "All tests passed! ✅"
        return 0
    else
        print_error "Some tests failed! ❌"
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting Docker-based unit testing..."
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Check prerequisites
    check_docker
    
    # Build test images
    build_test_images
    
    # Initialize result variables
    website_result=1
    cms_result=1
    typescript_result=1
    
    # Run tests
    run_app_tests "website" && website_result=0 || website_result=1
    run_app_tests "cms" && cms_result=0 || cms_result=1
    run_typescript_tests && typescript_result=0 || typescript_result=1
    
    # Generate coverage reports
    generate_coverage_report
    
    # Display summary
    display_summary $website_result $cms_result $typescript_result
    
    # Return overall result
    if [ $website_result -eq 0 ] && [ $cms_result -eq 0 ] && [ $typescript_result -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "website")
        check_docker
        build_test_images
        run_app_tests "website"
        ;;
    "cms")
        check_docker
        build_test_images
        run_app_tests "cms"
        ;;
    "typescript")
        check_docker
        build_test_images
        run_typescript_tests
        ;;
    "clean")
        cleanup
        ;;
    *)
        main
        ;;
esac
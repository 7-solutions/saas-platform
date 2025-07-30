#!/bin/bash

# Production Deployment Script
# This script deploys the SaaS platform to production

set -e

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Show usage
show_usage() {
    echo "Production Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --no-backup      Skip database backup before deployment"
    echo "  --force          Force deployment without confirmation"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_BEFORE_DEPLOY  Create backup before deploy (default: true)"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  $0 --no-backup --force"
}

# Check if required files exist
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Production compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        error "Production environment file not found: $ENV_FILE"
        error "Please copy .env.production.example to .env.production and configure it"
        exit 1
    fi
    
    # Check if SSL certificates exist
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        error "SSL certificates not found in nginx/ssl/"
        error "Please add cert.pem and key.pem to nginx/ssl/ directory"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check if docker compose is installed
    if ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    log "Loading environment variables..."
    
    if [ -f "$ENV_FILE" ]; then
        set -a  # automatically export all variables
        source "$ENV_FILE"
        set +a
        log "Environment variables loaded from $ENV_FILE"
    else
        warn "Environment file $ENV_FILE not found, using defaults"
    fi
}

# Create backup before deployment
create_backup() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        log "Creating database backup before deployment..."
        
        if [ -f "scripts/backup-db.sh" ]; then
            ./scripts/backup-db.sh
            log "Backup completed"
        else
            warn "Backup script not found, skipping backup"
        fi
    else
        info "Skipping backup (disabled)"
    fi
}

# Build images
build_images() {
    log "Building production images..."
    
    docker compose -f "$COMPOSE_FILE" build --no-cache
    
    log "Images built successfully"
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    # Stop existing services
    log "Stopping existing services..."
    docker compose -f "$COMPOSE_FILE" down || true
    
    # Start services
    log "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    log "Services deployed successfully"
}

# Wait for services to be healthy
wait_for_health() {
    log "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        info "Health check attempt $attempt/$max_attempts"
        
        # Check CouchDB
        if curl -s -f "http://localhost:5984/_up" > /dev/null 2>&1; then
            log "CouchDB is healthy"
        else
            warn "CouchDB is not healthy yet"
            sleep 10
            ((attempt++))
            continue
        fi
        
        # Check Backend
        if curl -s -f "http://localhost:8080/health" > /dev/null 2>&1; then
            log "Backend is healthy"
        else
            warn "Backend is not healthy yet"
            sleep 10
            ((attempt++))
            continue
        fi
        
        # Check Website
        if curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
            log "Website is healthy"
        else
            warn "Website is not healthy yet"
            sleep 10
            ((attempt++))
            continue
        fi
        
        # Check CMS
        if curl -s -f "http://localhost:3001/api/health" > /dev/null 2>&1; then
            log "CMS is healthy"
        else
            warn "CMS is not healthy yet"
            sleep 10
            ((attempt++))
            continue
        fi
        
        log "All services are healthy!"
        return 0
    done
    
    error "Services failed to become healthy within timeout"
    return 1
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log "Service URLs:"
    echo "  Website: https://${DOMAIN:-yourdomain.com}"
    echo "  CMS: https://${CMS_DOMAIN:-cms.yourdomain.com}"
    echo "  API: https://${API_DOMAIN:-api.yourdomain.com}"
    echo ""
    
    log "Health Check URLs:"
    echo "  Backend: http://localhost:8080/health"
    echo "  Website: http://localhost:3000/api/health"
    echo "  CMS: http://localhost:3001/api/health"
    echo "  CouchDB: http://localhost:5984/_up"
}

# Rollback deployment
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Stop current deployment
    docker compose -f "$COMPOSE_FILE" down
    
    # TODO: Implement rollback to previous version
    warn "Rollback functionality not implemented yet"
    warn "Please manually restore from backup if needed"
}

# Main deployment function
main() {
    local skip_backup=false
    local force_deploy=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-backup)
                skip_backup=true
                shift
                ;;
            --force)
                force_deploy=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    if [ "$skip_backup" = "true" ]; then
        BACKUP_BEFORE_DEPLOY=false
    fi
    
    log "Starting production deployment..."
    
    # Check prerequisites
    check_prerequisites
    
    # Load environment
    load_environment
    
    # Confirmation prompt
    if [ "$force_deploy" != "true" ]; then
        echo ""
        warn "This will deploy to production environment!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Create backup
    create_backup
    
    # Build images
    build_images
    
    # Deploy services
    deploy_services
    
    # Wait for health checks
    if wait_for_health; then
        log "Deployment completed successfully!"
        show_status
    else
        rollback
        exit 1
    fi
}

# Handle script termination
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
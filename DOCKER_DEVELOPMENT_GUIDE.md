# Docker Development Guide

## Overview

This guide provides comprehensive instructions for developing the SaaS Startup Platform using a Docker-only workflow. All development, building, and testing operations are performed within Docker containers, eliminating the need for local Node.js, Go, or database installations.

## Architecture

The platform uses a multi-service Docker architecture with optimized containers:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Website App   │  │    CMS App      │  │   Backend API   │
│   (Next.js)     │  │   (Next.js)     │  │     (Go)        │
│   Port: 3000    │  │   Port: 3001    │  │   Port: 8080    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Port: 15432   │
                    └─────────────────┘
```

## Prerequisites

- **Docker**: Version 24.0+ with BuildKit enabled
- **Docker Compose**: Version 2.20+
- **Git**: For version control
- **Text Editor**: VS Code recommended with Docker extension

### System Requirements

- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: 10GB free space for images and volumes
- **CPU**: Multi-core processor recommended for parallel builds

## Quick Start

### 1. Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd saas-startup-platform

# Copy environment configuration
cp .env.example .env

# Build and start all services
pnpm containers:up
```

### 2. Initialize Database

```bash
# Initialize database with schema and seed data
pnpm db:init
```

### 3. Access Applications

- **Website**: http://localhost:3000
- **CMS**: http://localhost:3001  
- **API Gateway**: http://localhost:8080
- **PostgreSQL**: localhost:15432 (user: app, password: app)

## Container Architecture

### Multi-Stage Build Process

Each application uses a 4-stage Docker build:

1. **Base Stage**: Common dependencies (Node.js 22-alpine, pnpm 9.15.0)
2. **Dependencies Stage**: Install packages with BuildKit caching
3. **Builder Stage**: Compile and build applications
4. **Runner Stage**: Minimal production runtime

### Key Optimizations

- **Layer Caching**: Separate dependency and source code layers
- **BuildKit Cache Mounts**: Persistent pnpm store caching
- **Multi-stage Builds**: Minimal production images (40% smaller)
- **Security**: Non-root user execution
- **Performance**: Alpine Linux base images

## Development Workflow

### Starting Development

```bash
# Start all services in development mode
pnpm dev:containers

# Or start individual services
docker compose up website cms postgres -d
```

### Making Code Changes

1. **Edit Source Code**: Changes are automatically synced via volumes
2. **Hot Reload**: Next.js development server provides instant feedback
3. **CSS Changes**: Tailwind CSS recompiles automatically
4. **TypeScript**: Type checking runs in watch mode

### Building Applications

```bash
# Build all applications
pnpm build

# Build specific application
pnpm build --filter=@saas-platform/website

# Build with monitoring
pnpm containers:build:monitored
```

### Running Tests

```bash
# Run all tests in containers
pnpm test:docker

# Run specific test suites
pnpm test:docker:unit        # Unit tests
pnpm test:docker:integration # Integration tests
pnpm test:docker:e2e        # End-to-end tests

# Run tests with coverage
pnpm test:coverage
```

## Container Management

### Service Control

```bash
# Start all services
pnpm containers:up

# Stop all services
pnpm containers:down

# View logs
pnpm containers:logs

# Follow logs for specific service
docker compose logs -f website

# Restart specific service
docker compose restart website
```

### Build Management

```bash
# Rebuild all containers
pnpm containers:build

# Rebuild with parallel processing
pnpm containers:build:parallel

# Clean rebuild (no cache)
docker compose build --no-cache

# Build optimized production images
pnpm containers:build:optimized
```

### Volume and Data Management

```bash
# Clean up containers and volumes
pnpm containers:clean

# Reset database
pnpm db:reset

# Backup database
docker compose exec postgres pg_dump -U app app > backup.sql

# Restore database
docker compose exec -T postgres psql -U app app < backup.sql
```

## Performance Optimization

### Build Performance

The Docker setup includes several optimizations:

- **pnpm Store Caching**: Dependencies cached between builds
- **Layer Optimization**: Minimal layer invalidation
- **Parallel Builds**: Multiple services build concurrently
- **BuildKit Features**: Advanced caching and parallelization

### Expected Performance Metrics

- **Initial Build**: ~3-5 minutes (cold cache)
- **Incremental Build**: ~30-60 seconds (warm cache)
- **Container Startup**: <30 seconds
- **Hot Reload**: <500ms for code changes

### Monitoring Build Performance

```bash
# Monitor build times
pnpm build:monitor

# Check build metrics
pnpm build:metrics:export

# Performance regression testing
pnpm perf:regression
```

## Environment Configuration

### Environment Variables

Key environment variables for Docker development:

```bash
# Database Configuration
DATABASE_URL=postgres://app:app@postgres:5432/app?sslmode=disable

# Next.js Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key

# Development Settings
NODE_ENV=development
LOG_LEVEL=info
NEXT_TELEMETRY_DISABLED=1
```

### Service-Specific Configuration

Each service can be configured via environment variables:

```yaml
# docker-compose.override.yml (optional)
version: "3.9"
services:
  website:
    environment:
      - DEBUG=1
      - NEXT_PUBLIC_DEBUG=true
    volumes:
      - ./apps/website:/app/apps/website
      
  cms:
    environment:
      - NEXTAUTH_DEBUG=true
    volumes:
      - ./apps/cms:/app/apps/cms
```

## Debugging and Development Tools

### Container Debugging

```bash
# Execute shell in running container
docker compose exec website sh

# Run commands in container
docker compose exec website pnpm type-check

# Debug build process
docker compose build --progress=plain website

# Inspect container
docker compose exec website ls -la /app
```

### Log Analysis

```bash
# View all service logs
pnpm containers:logs

# Filter logs by service
docker compose logs website | grep ERROR

# Follow logs with timestamps
docker compose logs -f -t website

# Export logs for analysis
docker compose logs website > website.log
```

### Performance Profiling

```bash
# Monitor container resources
docker stats

# Profile build performance
time docker compose build website

# Memory usage analysis
docker compose exec website cat /proc/meminfo

# Disk usage
docker compose exec website df -h
```

## Package Management

### pnpm in Docker

The setup uses pnpm 9.15.0 with workspace optimization:

```bash
# Install new dependency
docker compose exec website pnpm add lodash

# Install dev dependency
docker compose exec website pnpm add -D @types/lodash

# Update dependencies
docker compose exec website pnpm update

# Check outdated packages
docker compose exec website pnpm outdated
```

### Workspace Management

```bash
# Install dependencies for all workspaces
docker compose exec website pnpm install

# Build all packages
docker compose exec website pnpm build

# Run command in specific workspace
docker compose exec website pnpm --filter=@saas-platform/ui build
```

## Database Operations

### PostgreSQL Management

```bash
# Connect to database
docker compose exec postgres psql -U app app

# Run SQL file
docker compose exec -T postgres psql -U app app < schema.sql

# Create database backup
docker compose exec postgres pg_dump -U app app > backup_$(date +%Y%m%d).sql

# Monitor database performance
docker compose exec postgres psql -U app app -c "SELECT * FROM pg_stat_activity;"
```

### Database Migrations

```bash
# Run migrations
pnpm db:migrate

# List migration status
pnpm db:migrate:list

# Reset database to clean state
pnpm db:reset

# Seed database with test data
pnpm db:seed
```

## Security Considerations

### Container Security

- **Non-root Users**: All containers run as non-root users
- **Minimal Images**: Alpine Linux base images with minimal packages
- **Security Scanning**: Regular vulnerability scans
- **Network Isolation**: Services communicate via internal Docker network

### Development Security

```bash
# Scan for vulnerabilities
docker compose exec website pnpm audit

# Update security patches
docker compose exec website pnpm audit fix

# Check for outdated packages
docker compose exec website pnpm outdated
```

## Integration with IDEs

### VS Code Setup

Recommended VS Code extensions:

- **Docker**: Container management
- **Remote-Containers**: Develop inside containers
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Language support

### Container Development

```json
// .vscode/settings.json
{
  "docker.defaultRegistryPath": "",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "eslint.workingDirectories": ["apps/website", "apps/cms", "packages/ui"]
}
```

## Advanced Usage

### Custom Docker Compose Overrides

Create `docker-compose.override.yml` for local customizations:

```yaml
version: "3.9"
services:
  website:
    volumes:
      - ./apps/website:/app/apps/website
    environment:
      - DEBUG=1
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
```

### Multi-Environment Setup

```bash
# Development environment
docker compose -f docker-compose.yml up

# Production environment
docker compose -f docker-compose.prod.yml up

# Testing environment
docker compose -f docker-compose.test.yml up
```

### Custom Build Targets

```bash
# Build development image
docker build --target builder -t saas-platform/website:dev .

# Build production image
docker build --target runner -t saas-platform/website:prod .
```

## Next Steps

1. **Read Troubleshooting Guide**: See common issues and solutions
2. **Review Testing Documentation**: Understand testing workflows
3. **Check Performance Monitoring**: Set up build and runtime monitoring
4. **Explore Rollback Procedures**: Understand recovery mechanisms

For more detailed information, see:
- [Docker Troubleshooting Guide](./DOCKER_TROUBLESHOOTING_GUIDE.md)
- [Testing in Docker](./DOCKER_TESTING_GUIDE.md)
- [Rollback Procedures](./DOCKER_ROLLBACK_PROCEDURES.md)
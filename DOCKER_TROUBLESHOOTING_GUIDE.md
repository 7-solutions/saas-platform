# Docker Troubleshooting Guide

## Overview

This guide provides solutions to common Docker-related issues encountered during development of the SaaS Startup Platform. Issues are organized by category with step-by-step resolution procedures.

## Quick Diagnostics

### System Health Check

```bash
# Check Docker daemon status
docker info

# Check Docker Compose version
docker compose version

# Check available resources
docker system df

# Check running containers
docker ps -a

# Check container logs
pnpm containers:logs
```

### Service Status Check

```bash
# Check all service health
docker compose ps

# Check specific service health
docker compose exec website curl -f http://localhost:3000/api/health

# Check database connectivity
docker compose exec postgres pg_isready -U app -d app
```

## Container Startup Issues

### Problem: Containers Fail to Start

**Symptoms:**
- Services exit immediately after starting
- "Container exited with code 1" errors
- Services stuck in "starting" state

**Diagnosis:**
```bash
# Check container logs
docker compose logs [service-name]

# Check container exit codes
docker compose ps

# Inspect container configuration
docker compose config
```

**Solutions:**

1. **Port Conflicts:**
```bash
# Check if ports are in use
lsof -i :3000
netstat -tulpn | grep :3000

# Kill processes using ports
sudo kill -9 $(lsof -t -i:3000)

# Or change ports in docker-compose.yml
```

2. **Memory Issues:**
```bash
# Check available memory
free -h

# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory

# Clean up unused containers
docker system prune -a
```

3. **Permission Issues:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Fix Docker socket permissions (Linux)
sudo chmod 666 /var/run/docker.sock
```

### Problem: Next.js Binary Not Found

**Symptoms:**
- "next: command not found" errors
- Build failures in containers
- Missing dependencies

**Solutions:**

1. **Clear pnpm Cache:**
```bash
# Remove node_modules and reinstall
docker compose down
docker compose build --no-cache
docker compose up
```

2. **Fix Package Installation:**
```bash
# Rebuild with verbose output
docker compose build --progress=plain website

# Check pnpm installation
docker compose exec website which pnpm
docker compose exec website pnpm --version
```

3. **Verify Dockerfile:**
```dockerfile
# Ensure pnpm is properly installed
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Verify installation path
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

## CSS and Build Issues

### Problem: CSS Not Loading

**Symptoms:**
- Unstyled pages in browser
- PostCSS compilation errors
- Tailwind classes not applied

**Diagnosis:**
```bash
# Check CSS compilation
docker compose exec website pnpm build

# Check PostCSS configuration
docker compose exec website cat postcss.config.js

# Check Tailwind configuration
docker compose exec website cat tailwind.config.js
```

**Solutions:**

1. **Fix Tailwind Version:**
```bash
# Ensure using stable Tailwind v3.4.17
docker compose exec website pnpm list tailwindcss

# Reinstall if needed
docker compose exec website pnpm remove tailwindcss
docker compose exec website pnpm add tailwindcss@3.4.17
```

2. **Fix PostCSS Configuration:**
```javascript
// postcss.config.js - Correct configuration
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
```

3. **Clear Build Cache:**
```bash
# Clear Next.js cache
docker compose exec website rm -rf .next

# Rebuild containers
docker compose build --no-cache website
```

### Problem: TypeScript Compilation Errors

**Symptoms:**
- Type checking failures
- Build process stops with TS errors
- Missing type definitions

**Solutions:**

1. **Update TypeScript Configuration:**
```bash
# Check TypeScript version
docker compose exec website pnpm list typescript

# Run type checking
docker compose exec website pnpm type-check

# Fix common issues
docker compose exec website pnpm add -D @types/node@22.10.0
```

2. **Clear TypeScript Cache:**
```bash
# Remove TypeScript build info
docker compose exec website rm -f tsconfig.tsbuildinfo

# Clear all build artifacts
docker compose exec website pnpm clean
```

## Database Connection Issues

### Problem: Cannot Connect to PostgreSQL

**Symptoms:**
- "Connection refused" errors
- Database timeout errors
- Services waiting for database

**Diagnosis:**
```bash
# Check PostgreSQL container status
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U app -d app
```

**Solutions:**

1. **Wait for Database Startup:**
```bash
# Check if database is ready
docker compose exec postgres pg_isready -U app -d app

# Restart services that depend on database
docker compose restart website cms
```

2. **Fix Connection String:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgres://app:app@postgres:5432/app?sslmode=disable

# Update environment variables
cp .env.example .env
# Edit .env with correct values
```

3. **Reset Database:**
```bash
# Stop all services
docker compose down

# Remove database volume
docker volume rm saas-startup-platform_postgres_data

# Restart and reinitialize
docker compose up -d postgres
pnpm db:init
```

## Performance Issues

### Problem: Slow Build Times

**Symptoms:**
- Builds taking >5 minutes
- High CPU/memory usage during builds
- Frequent cache misses

**Diagnosis:**
```bash
# Monitor build performance
time docker compose build website

# Check BuildKit cache usage
docker buildx du

# Monitor system resources
docker stats
```

**Solutions:**

1. **Enable BuildKit Caching:**
```bash
# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1

# Use cache mounts in Dockerfile
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

2. **Optimize Layer Caching:**
```dockerfile
# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
COPY apps/website/package.json ./apps/website/
RUN pnpm install --frozen-lockfile

# Copy source code after dependencies
COPY . .
RUN pnpm build
```

3. **Parallel Builds:**
```bash
# Build services in parallel
pnpm containers:build:parallel

# Use multiple CPU cores
docker compose build --parallel
```

### Problem: High Memory Usage

**Symptoms:**
- Out of memory errors
- System slowdown during builds
- Container crashes

**Solutions:**

1. **Increase Docker Memory:**
```bash
# Docker Desktop: Settings > Resources > Memory (8GB+)

# Check current limits
docker system info | grep -i memory
```

2. **Optimize Build Process:**
```bash
# Use multi-stage builds to reduce final image size
# Clean up build artifacts
RUN pnpm build && pnpm prune --prod
```

3. **Monitor Memory Usage:**
```bash
# Check container memory usage
docker stats --no-stream

# Check system memory
free -h
```

## Network and Port Issues

### Problem: Port Already in Use

**Symptoms:**
- "Port already in use" errors
- Cannot bind to port
- Services unreachable

**Solutions:**

1. **Find and Kill Process:**
```bash
# Find process using port
lsof -i :3000
netstat -tulpn | grep :3000

# Kill process
sudo kill -9 $(lsof -t -i:3000)
```

2. **Change Port Configuration:**
```yaml
# docker-compose.override.yml
version: "3.9"
services:
  website:
    ports:
      - "3001:3000"  # Use different host port
```

3. **Use Different Ports:**
```bash
# Set custom ports via environment
export WEBSITE_PORT=3001
export CMS_PORT=3002
docker compose up
```

### Problem: Service Communication Failures

**Symptoms:**
- API calls between services fail
- "Connection refused" between containers
- Network timeout errors

**Solutions:**

1. **Check Service Names:**
```bash
# Use service names for internal communication
# Correct: http://api-gateway:8080
# Incorrect: http://localhost:8080
```

2. **Verify Network Configuration:**
```bash
# Check Docker networks
docker network ls

# Inspect network
docker network inspect saas-startup-platform_default
```

3. **Test Connectivity:**
```bash
# Test from one container to another
docker compose exec website curl -f http://api-gateway:8080/health
```

## Volume and Data Issues

### Problem: File Changes Not Reflected

**Symptoms:**
- Code changes not visible in container
- Hot reload not working
- Stale files in container

**Solutions:**

1. **Check Volume Mounts:**
```yaml
# Ensure proper volume mounting
services:
  website:
    volumes:
      - ./apps/website:/app/apps/website
      - /app/apps/website/node_modules  # Exclude node_modules
```

2. **Fix File Permissions:**
```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Fix permissions
chmod -R 755 .
```

3. **Restart Services:**
```bash
# Restart specific service
docker compose restart website

# Full restart
docker compose down && docker compose up
```

### Problem: Data Persistence Issues

**Symptoms:**
- Database data lost on restart
- Uploaded files disappear
- Configuration resets

**Solutions:**

1. **Check Volume Configuration:**
```yaml
# Ensure named volumes for persistence
volumes:
  postgres_data: {}
  media_data: {}

services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

2. **Backup Important Data:**
```bash
# Backup database
docker compose exec postgres pg_dump -U app app > backup.sql

# Backup media files
docker compose exec media tar -czf /tmp/media-backup.tar.gz /data/media
```

## Security Issues

### Problem: Permission Denied Errors

**Symptoms:**
- Cannot write files
- Permission denied in containers
- Build failures due to permissions

**Solutions:**

1. **Fix User Permissions:**
```dockerfile
# Use consistent user IDs
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

USER nextjs
```

2. **Fix Host Permissions:**
```bash
# Fix file ownership
sudo chown -R $USER:$USER .

# Fix Docker socket (Linux)
sudo usermod -aG docker $USER
```

### Problem: Security Vulnerabilities

**Symptoms:**
- Security scan failures
- Vulnerable dependencies
- Outdated base images

**Solutions:**

1. **Update Dependencies:**
```bash
# Check for vulnerabilities
docker compose exec website pnpm audit

# Fix vulnerabilities
docker compose exec website pnpm audit fix
```

2. **Update Base Images:**
```dockerfile
# Use latest secure base image
FROM node:22-alpine AS base

# Update system packages
RUN apk update && apk upgrade
```

## Emergency Recovery

### Complete System Reset

When all else fails, perform a complete reset:

```bash
# Stop all containers
docker compose down

# Remove all containers and volumes
docker compose down -v --remove-orphans

# Clean Docker system
docker system prune -a --volumes

# Remove all images
docker rmi $(docker images -q)

# Restart from scratch
pnpm setup
```

### Rollback to Previous Version

```bash
# Check Git history
git log --oneline -10

# Rollback to previous commit
git checkout HEAD~1

# Rebuild containers
docker compose build --no-cache
docker compose up
```

### Data Recovery

```bash
# Restore database from backup
docker compose exec -T postgres psql -U app app < backup.sql

# Restore media files
docker compose exec media tar -xzf /tmp/media-backup.tar.gz -C /
```

## Getting Help

### Diagnostic Information

When seeking help, provide:

```bash
# System information
docker version
docker compose version
uname -a

# Container status
docker compose ps
docker compose logs --tail=50

# Resource usage
docker stats --no-stream
df -h
free -h

# Configuration
docker compose config
```

### Log Collection

```bash
# Collect all logs
mkdir -p debug-logs
docker compose logs > debug-logs/all-services.log
docker compose logs website > debug-logs/website.log
docker compose logs postgres > debug-logs/postgres.log

# System logs (Linux)
journalctl -u docker > debug-logs/docker-daemon.log
```

### Common Commands Reference

```bash
# Quick fixes
docker compose restart [service]     # Restart service
docker compose build --no-cache     # Clean rebuild
docker system prune -a              # Clean up everything
docker compose down -v              # Stop and remove volumes

# Debugging
docker compose logs -f [service]     # Follow logs
docker compose exec [service] sh    # Shell access
docker compose config               # Validate configuration
docker stats                        # Resource monitoring
```

For additional help:
- Check the [Docker Development Guide](./DOCKER_DEVELOPMENT_GUIDE.md)
- Review [Rollback Procedures](./DOCKER_ROLLBACK_PROCEDURES.md)
- Consult Docker documentation: https://docs.docker.com/
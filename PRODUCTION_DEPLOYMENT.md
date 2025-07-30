# Production Deployment Guide

This guide covers deploying the SaaS Startup Platform to production using Docker containers with proper security, monitoring, and backup procedures.

## Prerequisites

### System Requirements

- Linux server (Ubuntu 20.04+ or CentOS 8+ recommended)
- Minimum 4GB RAM, 2 CPU cores
- 50GB+ disk space
- Docker and Docker Compose installed
- Domain name with DNS configured

### Required Software

```bash
# Install Docker (Ubuntu/Debian)
sudo apt update
sudo apt install -y docker.io docker-compose-plugin

# Install Docker (CentOS/RHEL)
sudo dnf install -y docker docker-compose-plugin

# Install additional tools
sudo apt install -y curl jq openssl
```

## Pre-Deployment Setup

### 1. SSL Certificates

Generate or obtain SSL certificates for your domains:

```bash
# For Let's Encrypt (recommended for production)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d cms.yourdomain.com -d api.yourdomain.com

# Copy certificates to nginx/ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

### 2. Environment Configuration

```bash
# Copy and configure production environment
cp .env.production.example .env.production

# Edit the file with your actual values
nano .env.production
```

Required environment variables:
- `COUCHDB_PASSWORD`: Strong password for CouchDB
- `JWT_SECRET`: 32+ character secret for JWT tokens
- `NEXTAUTH_SECRET`: Secret for NextAuth.js
- `NEXTAUTH_URL`: Your CMS domain URL
- `NEXT_PUBLIC_API_URL`: Your API domain URL

### 3. DNS Configuration

Configure your DNS records:

```
A     yourdomain.com        -> YOUR_SERVER_IP
A     www.yourdomain.com    -> YOUR_SERVER_IP
A     cms.yourdomain.com    -> YOUR_SERVER_IP
A     api.yourdomain.com    -> YOUR_SERVER_IP
```

## Deployment

### Quick Deployment

```bash
# Run the deployment script
./scripts/deploy-production.sh
```

### Manual Deployment

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check service status
docker compose -f docker-compose.prod.yml ps
```

### Verify Deployment

```bash
# Check service health
curl -f https://yourdomain.com/api/health
curl -f https://cms.yourdomain.com/api/health
curl -f https://api.yourdomain.com/health

# Check SSL certificates
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com < /dev/null
```

## Service Architecture

### Services Overview

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Nginx | saas-nginx | 80, 443 | Reverse proxy, SSL termination |
| Backend | saas-backend | 8080, 9090 | Go gRPC API server |
| Website | saas-website | 3000 | Public Next.js website |
| CMS | saas-cms | 3000 | Admin Next.js dashboard |
| CouchDB | saas-couchdb | 5984 | Document database |

### Network Architecture

```
Internet → Nginx (SSL) → Backend Services
                      → Website
                      → CMS
                      → CouchDB (internal only)
```

## Monitoring and Maintenance

### Health Monitoring

```bash
# Run monitoring script
./scripts/monitor-production.sh

# Run once and exit
./scripts/monitor-production.sh --once

# Generate status report
./scripts/monitor-production.sh --report
```

### Log Management

```bash
# View service logs
docker compose -f docker-compose.prod.yml logs -f [service_name]

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Backup

```bash
# Create backup
COUCHDB_PASSWORD=your-password ./scripts/backup-db.sh

# Restore from backup
COUCHDB_PASSWORD=your-password ./scripts/restore-db.sh ./backups/couchdb_backup_20240101_120000.tar.gz
```

### Automated Backups

Add to crontab for automated backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/your/app && COUCHDB_PASSWORD=your-password ./scripts/backup-db.sh
```

## Security Considerations

### Firewall Configuration

```bash
# Configure UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Block direct access to application ports
sudo ufw deny 3000/tcp
sudo ufw deny 8080/tcp
sudo ufw deny 5984/tcp
```

### Container Security

- All containers run as non-root users
- Minimal base images (Alpine Linux)
- No unnecessary packages installed
- Resource limits configured

### SSL/TLS Security

- TLS 1.2+ only
- Strong cipher suites
- HSTS headers enabled
- Certificate auto-renewal with Let's Encrypt

## Scaling and Performance

### Horizontal Scaling

To scale services horizontally:

```bash
# Scale backend service
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Update nginx configuration for load balancing
# Edit nginx/conf.d/default.conf to add multiple upstream servers
```

### Performance Optimization

- Enable gzip compression (configured in nginx)
- Use CDN for static assets
- Implement Redis for caching (future enhancement)
- Database indexing and view optimization

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in nginx/ssl/cert.pem -text -noout
   
   # Renew Let's Encrypt certificates
   sudo certbot renew
   ```

2. **Database Connection Issues**
   ```bash
   # Check CouchDB status
   curl -u admin:password http://localhost:5984/_up
   
   # Check database logs
   docker logs saas-couchdb
   ```

3. **Service Not Starting**
   ```bash
   # Check service logs
   docker compose -f docker-compose.prod.yml logs [service_name]
   
   # Check resource usage
   docker stats
   ```

### Emergency Procedures

1. **Service Rollback**
   ```bash
   # Stop current deployment
   docker compose -f docker-compose.prod.yml down
   
   # Restore from backup
   COUCHDB_PASSWORD=your-password ./scripts/restore-db.sh ./backups/latest_backup.tar.gz
   
   # Deploy previous version
   git checkout previous-tag
   ./scripts/deploy-production.sh
   ```

2. **Database Recovery**
   ```bash
   # Stop all services
   docker compose -f docker-compose.prod.yml down
   
   # Restore database
   COUCHDB_PASSWORD=your-password ./scripts/restore-db.sh ./backups/backup_file.tar.gz --force
   
   # Restart services
   docker compose -f docker-compose.prod.yml up -d
   ```

## Maintenance Schedule

### Daily
- Automated backups
- Health check monitoring
- Log rotation

### Weekly
- Security updates
- Performance monitoring
- Backup verification

### Monthly
- SSL certificate renewal check
- Dependency updates
- Capacity planning review

## Support and Documentation

- **Health Endpoints**: All services expose `/health` or `/api/health` endpoints
- **Metrics**: Basic metrics available through health endpoints
- **Logs**: Structured JSON logging for all services
- **Alerts**: Email alerts for critical issues (configure ALERT_EMAIL)

For additional support, refer to the main README.md and individual service documentation.
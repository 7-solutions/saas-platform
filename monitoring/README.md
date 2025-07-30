# Monitoring and Alerting Setup

This directory contains the monitoring and alerting infrastructure for the SaaS Platform.

## Components

### Prometheus
- **Purpose**: Metrics collection and storage
- **Port**: 9091
- **Config**: `prometheus/prometheus.yml`
- **URL**: http://localhost:9091

### Grafana
- **Purpose**: Dashboards and visualization
- **Port**: 3002
- **Credentials**: admin/admin
- **URL**: http://localhost:3002

### Loki
- **Purpose**: Log aggregation
- **Port**: 3100
- **Config**: `loki/loki-config.yml`
- **URL**: http://localhost:3100

### Promtail
- **Purpose**: Log collection and forwarding to Loki
- **Config**: `promtail/promtail-config.yml`

### AlertManager
- **Purpose**: Alert routing and notification
- **Port**: 9093
- **Config**: `alertmanager/alertmanager.yml`
- **URL**: http://localhost:9093

## Quick Start

1. **Start the monitoring stack:**
   ```bash
   ./scripts/start-monitoring.sh
   ```

2. **Access Grafana:**
   - URL: http://localhost:3002
   - Username: admin
   - Password: admin

3. **View metrics in Prometheus:**
   - URL: http://localhost:9091

4. **Check application health:**
   ```bash
   ./scripts/monitor-production.sh
   ```

## Available Metrics

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - HTTP request duration
- `http_requests_in_flight` - Active HTTP requests

### gRPC Metrics
- `grpc_requests_total` - Total gRPC requests
- `grpc_request_duration_seconds` - gRPC request duration
- `grpc_requests_in_flight` - Active gRPC requests

### Database Metrics
- `database_connections_active` - Active database connections
- `database_queries_total` - Total database queries
- `database_query_duration_seconds` - Database query duration

### Authentication Metrics
- `auth_login_attempts_total` - Login attempts
- `auth_token_validations_total` - Token validations

### Business Metrics
- `pages_total` - Total pages in system
- `media_files_total` - Total media files
- `users_total` - Total users
- `contact_forms_total` - Contact form submissions

### System Metrics
- `saas_process_memory_bytes` - Memory usage
- `saas_process_cpu_usage_percent` - CPU usage
- `saas_goroutines_active` - Active goroutines

## Health Check Endpoints

### Main Health Check
- **URL**: http://localhost:8080/health
- **Purpose**: Comprehensive health status with detailed checks

### Liveness Probe
- **URL**: http://localhost:8080/health/live
- **Purpose**: Kubernetes liveness probe (simple alive check)

### Readiness Probe
- **URL**: http://localhost:8080/health/ready
- **Purpose**: Kubernetes readiness probe (dependency checks)

### Metrics Endpoint
- **URL**: http://localhost:8081/metrics
- **Purpose**: Prometheus metrics scraping

## Alerts

### Critical Alerts
- **ServiceDown**: Service is not responding
- **DatabaseConnectionFailed**: Database connection issues
- **HighErrorRate**: Error rate above 10%

### Warning Alerts
- **HighResponseTime**: 95th percentile > 1 second
- **HighMemoryUsage**: Memory usage > 500MB
- **LowDiskSpace**: Disk space < 10%
- **HighFailedLoginRate**: Failed login rate > 5/sec

## Alert Channels

### Email Notifications
- Critical alerts → admin@saas-platform.com
- Warning alerts → team@saas-platform.com

### Webhook Notifications
- All alerts → http://backend:8080/api/v1/alerts/webhook

## Configuration

### Prometheus Targets
Edit `prometheus/prometheus.yml` to add new scrape targets:

```yaml
scrape_configs:
  - job_name: 'my-service'
    static_configs:
      - targets: ['my-service:8080']
```

### Alert Rules
Add new alert rules in `prometheus/rules/alerts.yml`:

```yaml
- alert: MyAlert
  expr: my_metric > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "My custom alert"
```

### Grafana Dashboards
- Place dashboard JSON files in `grafana/dashboards/`
- They will be automatically loaded on startup

## Troubleshooting

### Check Service Status
```bash
docker compose -f monitoring/docker-compose.monitoring.yml ps
```

### View Logs
```bash
docker compose -f monitoring/docker-compose.monitoring.yml logs -f [service-name]
```

### Restart Services
```bash
docker compose -f monitoring/docker-compose.monitoring.yml restart [service-name]
```

### Stop Monitoring Stack
```bash
docker compose -f monitoring/docker-compose.monitoring.yml down
```

## Production Considerations

1. **Persistent Storage**: Configure proper volumes for data persistence
2. **Security**: Set up proper authentication and TLS
3. **Retention**: Configure appropriate data retention policies
4. **Backup**: Set up regular backups of monitoring data
5. **Scaling**: Consider using external storage for large deployments
6. **Network**: Ensure proper network security and firewall rules

## Integration with Application

The monitoring system is integrated with the application through:

1. **Metrics Collection**: Automatic metrics collection via middleware
2. **Health Checks**: Built-in health check endpoints
3. **Alerting**: Automatic alert generation for critical events
4. **Logging**: Structured logging with correlation IDs

## Custom Metrics

To add custom metrics in the application:

```go
// In your service
metrics := metrics.GetGlobalMetrics()
metrics.MyCustomMetric.Inc()
```

## Dashboard Access

- **Main Dashboard**: SaaS Platform Overview
- **System Metrics**: CPU, Memory, Disk usage
- **Application Metrics**: Request rates, response times, errors
- **Business Metrics**: User activity, content statistics
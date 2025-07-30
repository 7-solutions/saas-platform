#!/bin/bash

# Start monitoring stack
echo "Starting monitoring stack..."

# Create network if it doesn't exist
docker network ls | grep saas-network || docker network create saas-network

# Start monitoring services
docker compose -f monitoring/docker-compose.monitoring.yml up -d

echo "Monitoring stack started!"
echo ""
echo "Services available at:"
echo "- Prometheus: http://localhost:9091"
echo "- Grafana: http://localhost:3002 (admin/admin)"
echo "- AlertManager: http://localhost:9093"
echo "- Loki: http://localhost:3100"
echo ""
echo "To view logs: docker compose -f monitoring/docker-compose.monitoring.yml logs -f"
echo "To stop: docker compose -f monitoring/docker-compose.monitoring.yml down"
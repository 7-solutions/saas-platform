#!/bin/bash

# Production monitoring script
echo "Production Monitoring Dashboard"
echo "==============================="

# Check if monitoring services are running
echo "Checking monitoring services..."

# Check Prometheus
if curl -s http://localhost:9091/-/healthy > /dev/null; then
    echo "✅ Prometheus is healthy"
else
    echo "❌ Prometheus is not responding"
fi

# Check Grafana
if curl -s http://localhost:3002/api/health > /dev/null; then
    echo "✅ Grafana is healthy"
else
    echo "❌ Grafana is not responding"
fi

# Check AlertManager
if curl -s http://localhost:9093/-/healthy > /dev/null; then
    echo "✅ AlertManager is healthy"
else
    echo "❌ AlertManager is not responding"
fi

# Check Loki
if curl -s http://localhost:3100/ready > /dev/null; then
    echo "✅ Loki is healthy"
else
    echo "❌ Loki is not responding"
fi

echo ""
echo "Application Health Checks:"
echo "========================="

# Check backend health
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ Backend API is healthy"
    # Get detailed health info
    curl -s http://localhost:8080/health | jq '.' 2>/dev/null || echo "Health check response received"
else
    echo "❌ Backend API is not responding"
fi

echo ""
echo "Quick Metrics Summary:"
echo "====================="

# Get some basic metrics if available
if command -v curl &> /dev/null && command -v grep &> /dev/null; then
    echo "HTTP Request Rate (last 5m):"
    curl -s "http://localhost:9091/api/v1/query?query=rate(http_requests_total[5m])" | grep -o '"result":\[[^]]*\]' | head -5 || echo "Metrics not available"
    
    echo ""
    echo "Error Rate (last 5m):"
    curl -s "http://localhost:9091/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])" | grep -o '"result":\[[^]]*\]' | head -5 || echo "Error metrics not available"
fi

echo ""
echo "For detailed monitoring, visit:"
echo "- Grafana Dashboard: http://localhost:3002"
echo "- Prometheus: http://localhost:9091"
echo "- AlertManager: http://localhost:9093"
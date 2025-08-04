#!/usr/bin/env node

/**
 * Build Metrics Exporter
 * Converts build performance metrics to Prometheus format
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class BuildMetricsExporter {
  constructor(port = 9091) {
    this.port = port;
    this.metricsDir = path.join(process.cwd(), 'monitoring', 'build-metrics');
    this.server = null;
  }

  loadLatestMetrics() {
    const latestPath = path.join(this.metricsDir, 'latest.json');
    if (!fs.existsSync(latestPath)) {
      return null;
    }
    
    try {
      return JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    } catch (error) {
      console.error('Error loading metrics:', error.message);
      return null;
    }
  }

  loadHistoricalMetrics(hours = 24) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(this.metricsDir)
        .filter(f => f.startsWith('build-metrics-') && f.endsWith('.json'))
        .map(f => {
          const filepath = path.join(this.metricsDir, f);
          const stats = fs.statSync(filepath);
          return { file: f, mtime: stats.mtime.getTime() };
        })
        .filter(f => f.mtime > cutoffTime)
        .sort((a, b) => b.mtime - a.mtime);

      return files.map(f => {
        const filepath = path.join(this.metricsDir, f.file);
        return JSON.parse(fs.readFileSync(filepath, 'utf8'));
      });
    } catch (error) {
      console.error('Error loading historical metrics:', error.message);
      return [];
    }
  }

  convertToPrometheusFormat(metrics) {
    if (!metrics) {
      return '# No metrics available\n';
    }

    const lines = [];
    const timestamp = new Date(metrics.timestamp).getTime();

    // Add help and type information
    lines.push('# HELP build_duration_seconds Time taken to complete build in seconds');
    lines.push('# TYPE build_duration_seconds gauge');
    lines.push('# HELP build_cache_hit_rate Percentage of build steps that used cache');
    lines.push('# TYPE build_cache_hit_rate gauge');
    lines.push('# HELP build_success Whether the build was successful (1) or failed (0)');
    lines.push('# TYPE build_success gauge');
    lines.push('# HELP build_timestamp Unix timestamp when build completed');
    lines.push('# TYPE build_timestamp gauge');
    lines.push('# HELP build_image_size_bytes Size of the built Docker image in bytes');
    lines.push('# TYPE build_image_size_bytes gauge');
    lines.push('# HELP build_cache_hits Number of build steps that used cache');
    lines.push('# TYPE build_cache_hits gauge');
    lines.push('# HELP build_cache_misses Number of build steps that did not use cache');
    lines.push('# TYPE build_cache_misses gauge');
    lines.push('');

    // Overall build metrics
    if (metrics.totalDuration) {
      lines.push(`build_duration_seconds{build_id="${metrics.buildId}"} ${metrics.totalDuration / 1000} ${timestamp}`);
    }

    lines.push(`build_timestamp{build_id="${metrics.buildId}"} ${timestamp} ${timestamp}`);

    // Stage-specific metrics
    Object.entries(metrics.stages || {}).forEach(([stageName, stage]) => {
      const labels = `build_id="${metrics.buildId}",stage="${stageName}"`;
      
      if (stage.duration) {
        lines.push(`build_duration_seconds{${labels}} ${stage.duration / 1000} ${timestamp}`);
      }
      
      lines.push(`build_success{${labels}} ${stage.success ? 1 : 0} ${timestamp}`);

      // Extract service name from stage name (e.g., "docker-build-website" -> "website")
      const serviceMatch = stageName.match(/docker-build-(.+)/);
      if (serviceMatch) {
        const service = serviceMatch[1];
        const serviceLabels = `build_id="${metrics.buildId}",service="${service}"`;
        
        if (stage.duration) {
          lines.push(`build_duration_seconds{${serviceLabels}} ${stage.duration / 1000} ${timestamp}`);
        }
        
        lines.push(`build_success{${serviceLabels}} ${stage.success ? 1 : 0} ${timestamp}`);

        // Image size if available
        if (stage.imageSize) {
          const sizeBytes = this.parseImageSize(stage.imageSize);
          if (sizeBytes > 0) {
            lines.push(`build_image_size_bytes{${serviceLabels}} ${sizeBytes} ${timestamp}`);
          }
        }
      }
    });

    // Cache statistics
    Object.entries(metrics.cacheStats || {}).forEach(([service, stats]) => {
      const labels = `build_id="${metrics.buildId}",service="${service}"`;
      
      lines.push(`build_cache_hit_rate{${labels}} ${stats.hitRate} ${timestamp}`);
      lines.push(`build_cache_hits{${labels}} ${stats.cacheHits} ${timestamp}`);
      lines.push(`build_cache_misses{${labels}} ${stats.cacheMisses} ${timestamp}`);
    });

    // Error metrics
    if (metrics.errors && metrics.errors.length > 0) {
      metrics.errors.forEach(error => {
        const labels = `build_id="${metrics.buildId}",error_type="${error.type}"`;
        lines.push(`build_errors_total{${labels}} 1 ${timestamp}`);
      });
    }

    return lines.join('\n') + '\n';
  }

  parseImageSize(sizeStr) {
    // Convert Docker image size string to bytes
    // Examples: "123MB", "1.2GB", "456kB"
    const match = sizeStr.match(/^([\d.]+)([KMGT]?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    return Math.round(value * (multipliers[unit] || 1));
  }

  generateHistoricalMetrics() {
    const historicalMetrics = this.loadHistoricalMetrics();
    const lines = [];

    // Add help and type information
    lines.push('# HELP build_total Total number of builds');
    lines.push('# TYPE build_total counter');
    lines.push('# HELP build_failures_total Total number of failed builds');
    lines.push('# TYPE build_failures_total counter');
    lines.push('');

    // Aggregate historical data
    const serviceStats = {};
    let totalBuilds = 0;
    let totalFailures = 0;

    historicalMetrics.forEach(metrics => {
      totalBuilds++;
      
      let buildFailed = false;
      Object.entries(metrics.stages || {}).forEach(([stageName, stage]) => {
        if (!stage.success) {
          buildFailed = true;
        }

        const serviceMatch = stageName.match(/docker-build-(.+)/);
        if (serviceMatch) {
          const service = serviceMatch[1];
          if (!serviceStats[service]) {
            serviceStats[service] = { total: 0, failures: 0 };
          }
          serviceStats[service].total++;
          if (!stage.success) {
            serviceStats[service].failures++;
          }
        }
      });

      if (buildFailed) {
        totalFailures++;
      }
    });

    // Output aggregated metrics
    const now = Date.now();
    lines.push(`build_total ${totalBuilds} ${now}`);
    lines.push(`build_failures_total ${totalFailures} ${now}`);

    Object.entries(serviceStats).forEach(([service, stats]) => {
      lines.push(`build_total{service="${service}"} ${stats.total} ${now}`);
      lines.push(`build_failures_total{service="${service}"} ${stats.failures} ${now}`);
    });

    return lines.join('\n') + '\n';
  }

  handleMetricsRequest(req, res) {
    try {
      const latestMetrics = this.loadLatestMetrics();
      const currentMetrics = this.convertToPrometheusFormat(latestMetrics);
      const historicalMetrics = this.generateHistoricalMetrics();

      const response = currentMetrics + '\n' + historicalMetrics;

      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Content-Length': Buffer.byteLength(response)
      });
      res.end(response);
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error generating metrics\n');
    }
  }

  handleHealthRequest(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
  }

  start() {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      switch (url.pathname) {
        case '/metrics':
          this.handleMetricsRequest(req, res);
          break;
        case '/health':
          this.handleHealthRequest(req, res);
          break;
        default:
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found\n');
      }
    });

    this.server.listen(this.port, () => {
      console.log(`📊 Build metrics exporter listening on port ${this.port}`);
      console.log(`Metrics endpoint: http://localhost:${this.port}/metrics`);
      console.log(`Health endpoint: http://localhost:${this.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());
  }

  stop() {
    if (this.server) {
      console.log('Stopping build metrics exporter...');
      this.server.close(() => {
        console.log('Build metrics exporter stopped');
        process.exit(0);
      });
    }
  }

  exportToFile(outputPath) {
    try {
      const latestMetrics = this.loadLatestMetrics();
      const currentMetrics = this.convertToPrometheusFormat(latestMetrics);
      const historicalMetrics = this.generateHistoricalMetrics();

      const content = currentMetrics + '\n' + historicalMetrics;
      fs.writeFileSync(outputPath, content);
      
      console.log(`📊 Metrics exported to: ${outputPath}`);
      return true;
    } catch (error) {
      console.error('Error exporting metrics:', error.message);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'serve';
  
  const exporter = new BuildMetricsExporter();
  
  switch (command) {
    case 'serve':
      const port = parseInt(args[1]) || 9091;
      exporter.port = port;
      exporter.start();
      break;
      
    case 'export':
      const outputPath = args[1] || 'build-metrics.txt';
      if (exporter.exportToFile(outputPath)) {
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;
      
    case 'test':
      // Test the metrics generation
      const metrics = exporter.loadLatestMetrics();
      if (metrics) {
        console.log('Latest metrics found:');
        console.log(JSON.stringify(metrics, null, 2));
        console.log('\nPrometheus format:');
        console.log(exporter.convertToPrometheusFormat(metrics));
      } else {
        console.log('No metrics found');
      }
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/build-metrics-exporter.js serve [port]');
      console.log('  node scripts/build-metrics-exporter.js export [output-file]');
      console.log('  node scripts/build-metrics-exporter.js test');
      process.exit(1);
  }
}

module.exports = BuildMetricsExporter;
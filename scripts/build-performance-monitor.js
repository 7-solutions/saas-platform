#!/usr/bin/env node

/**
 * Build Performance Monitor
 * Tracks build times, cache hit rates, and resource usage during Docker builds
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class BuildPerformanceMonitor {
  constructor() {
    this.metricsDir = path.join(process.cwd(), 'monitoring', 'build-metrics');
    this.ensureMetricsDir();
    this.startTime = Date.now();
    this.metrics = {
      timestamp: new Date().toISOString(),
      buildId: this.generateBuildId(),
      stages: {},
      cacheStats: {},
      resourceUsage: {},
      errors: []
    };
  }

  generateBuildId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `build-${timestamp}-${random}`;
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  startStage(stageName) {
    console.log(`📊 Starting stage: ${stageName}`);
    this.metrics.stages[stageName] = {
      startTime: Date.now(),
      endTime: null,
      duration: null,
      success: false
    };
  }

  endStage(stageName, success = true) {
    if (!this.metrics.stages[stageName]) {
      console.warn(`⚠️  Stage ${stageName} was not started`);
      return;
    }

    const stage = this.metrics.stages[stageName];
    stage.endTime = Date.now();
    stage.duration = stage.endTime - stage.startTime;
    stage.success = success;

    const durationSeconds = (stage.duration / 1000).toFixed(2);
    const status = success ? '✅' : '❌';
    console.log(`${status} Stage ${stageName} completed in ${durationSeconds}s`);
  }

  recordCacheStats(service, stats) {
    this.metrics.cacheStats[service] = {
      ...stats,
      timestamp: Date.now()
    };
  }

  recordResourceUsage() {
    try {
      // Get Docker system info
      const dockerInfo = execSync('docker system df --format "table {{.Type}}\\t{{.TotalCount}}\\t{{.Size}}\\t{{.Reclaimable}}"', 
        { encoding: 'utf8', timeout: 5000 });
      
      // Get container resource usage
      const containerStats = execSync('docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"', 
        { encoding: 'utf8', timeout: 5000 });

      this.metrics.resourceUsage = {
        dockerInfo: dockerInfo.trim(),
        containerStats: containerStats.trim(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('⚠️  Could not collect resource usage:', error.message);
      this.metrics.errors.push({
        type: 'resource_collection',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  async monitorDockerBuild(service, dockerfile = null) {
    const buildCommand = dockerfile 
      ? `docker build -f ${dockerfile} -t ${service} .`
      : `docker compose build ${service}`;

    console.log(`🚀 Starting Docker build for ${service}`);
    this.startStage(`docker-build-${service}`);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const buildProcess = spawn('sh', ['-c', buildCommand], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, BUILDKIT_PROGRESS: 'plain' }
      });

      let buildOutput = '';
      let buildErrors = '';

      buildProcess.stdout.on('data', (data) => {
        const output = data.toString();
        buildOutput += output;
        
        // Parse BuildKit cache information
        this.parseBuildKitOutput(service, output);
        
        // Show progress
        if (output.includes('CACHED') || output.includes('DONE')) {
          process.stdout.write('.');
        }
      });

      buildProcess.stderr.on('data', (data) => {
        buildErrors += data.toString();
      });

      buildProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const success = code === 0;

        this.endStage(`docker-build-${service}`, success);

        if (success) {
          console.log(`\n✅ Build completed for ${service} in ${(duration / 1000).toFixed(2)}s`);
          
          // Record build artifacts size
          this.recordImageSize(service);
          
          resolve({
            service,
            duration,
            success: true,
            output: buildOutput
          });
        } else {
          console.log(`\n❌ Build failed for ${service}`);
          this.metrics.errors.push({
            type: 'build_failure',
            service,
            code,
            output: buildErrors,
            timestamp: Date.now()
          });
          
          reject(new Error(`Build failed for ${service} with code ${code}`));
        }
      });
    });
  }

  parseBuildKitOutput(service, output) {
    const lines = output.split('\n');
    let cacheHits = 0;
    let cacheMisses = 0;

    lines.forEach(line => {
      if (line.includes('CACHED')) {
        cacheHits++;
      } else if (line.includes('DONE') && !line.includes('CACHED')) {
        cacheMisses++;
      }
    });

    if (cacheHits > 0 || cacheMisses > 0) {
      const total = cacheHits + cacheMisses;
      const hitRate = total > 0 ? (cacheHits / total * 100).toFixed(1) : 0;
      
      this.recordCacheStats(service, {
        cacheHits,
        cacheMisses,
        total,
        hitRate: parseFloat(hitRate)
      });
    }
  }

  recordImageSize(service) {
    try {
      const sizeOutput = execSync(`docker images ${service} --format "{{.Size}}"`, 
        { encoding: 'utf8', timeout: 5000 });
      
      if (!this.metrics.stages[`docker-build-${service}`]) {
        this.metrics.stages[`docker-build-${service}`] = {};
      }
      
      this.metrics.stages[`docker-build-${service}`].imageSize = sizeOutput.trim();
    } catch (error) {
      console.warn(`⚠️  Could not get image size for ${service}:`, error.message);
    }
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n📊 Build Performance Report');
    console.log('=' .repeat(50));
    console.log(`Build ID: ${this.metrics.buildId}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Timestamp: ${this.metrics.timestamp}`);
    
    // Stage summary
    console.log('\n🏗️  Build Stages:');
    Object.entries(this.metrics.stages).forEach(([stage, data]) => {
      const status = data.success ? '✅' : '❌';
      const duration = data.duration ? `${(data.duration / 1000).toFixed(2)}s` : 'N/A';
      const size = data.imageSize ? ` (${data.imageSize})` : '';
      console.log(`  ${status} ${stage}: ${duration}${size}`);
    });

    // Cache statistics
    console.log('\n💾 Cache Statistics:');
    Object.entries(this.metrics.cacheStats).forEach(([service, stats]) => {
      console.log(`  ${service}: ${stats.hitRate}% hit rate (${stats.cacheHits}/${stats.total})`);
    });

    // Errors
    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.metrics.errors.forEach(error => {
        console.log(`  ${error.type}: ${error.message}`);
      });
    }

    // Performance benchmarks
    this.checkPerformanceBenchmarks();
  }

  checkPerformanceBenchmarks() {
    console.log('\n🎯 Performance Benchmarks:');
    
    const totalDuration = Date.now() - this.startTime;
    const targetBuildTime = 2 * 60 * 1000; // 2 minutes in ms
    
    if (totalDuration <= targetBuildTime) {
      console.log(`  ✅ Build time: ${(totalDuration / 1000).toFixed(2)}s (target: ${targetBuildTime / 1000}s)`);
    } else {
      console.log(`  ❌ Build time: ${(totalDuration / 1000).toFixed(2)}s exceeds target of ${targetBuildTime / 1000}s`);
    }

    // Check cache hit rates
    Object.entries(this.metrics.cacheStats).forEach(([service, stats]) => {
      const targetHitRate = 50; // 50% minimum cache hit rate
      if (stats.hitRate >= targetHitRate) {
        console.log(`  ✅ ${service} cache hit rate: ${stats.hitRate}% (target: ${targetHitRate}%)`);
      } else {
        console.log(`  ⚠️  ${service} cache hit rate: ${stats.hitRate}% below target of ${targetHitRate}%`);
      }
    });
  }

  saveMetrics() {
    const filename = `build-metrics-${this.metrics.buildId}.json`;
    const filepath = path.join(this.metricsDir, filename);
    
    this.metrics.totalDuration = Date.now() - this.startTime;
    this.recordResourceUsage();
    
    fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2));
    console.log(`\n💾 Metrics saved to: ${filepath}`);

    // Also save latest metrics for easy access
    const latestPath = path.join(this.metricsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(this.metrics, null, 2));
  }

  async monitorFullBuild(services = ['website', 'cms']) {
    console.log('🚀 Starting full build performance monitoring');
    
    try {
      this.startStage('full-build');
      
      // Build services in parallel for better performance
      const buildPromises = services.map(service => 
        this.monitorDockerBuild(service).catch(error => {
          console.error(`Build failed for ${service}:`, error.message);
          return { service, success: false, error: error.message };
        })
      );

      const results = await Promise.allSettled(buildPromises);
      
      this.endStage('full-build', results.every(r => r.status === 'fulfilled'));
      
      this.generateReport();
      this.saveMetrics();
      
      return this.metrics;
    } catch (error) {
      console.error('❌ Build monitoring failed:', error);
      this.metrics.errors.push({
        type: 'monitor_failure',
        message: error.message,
        timestamp: Date.now()
      });
      this.saveMetrics();
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  
  const monitor = new BuildPerformanceMonitor();
  
  switch (command) {
    case 'full':
      monitor.monitorFullBuild()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'service':
      const service = args[1];
      if (!service) {
        console.error('❌ Service name required: npm run build:monitor service <service-name>');
        process.exit(1);
      }
      monitor.monitorDockerBuild(service)
        .then(() => {
          monitor.generateReport();
          monitor.saveMetrics();
          process.exit(0);
        })
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/build-performance-monitor.js full');
      console.log('  node scripts/build-performance-monitor.js service <service-name>');
      process.exit(1);
  }
}

module.exports = BuildPerformanceMonitor;
#!/usr/bin/env node

/**
 * Runtime Performance Monitor
 * Monitors page load times, memory usage, and CPU usage in containers
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');

class RuntimePerformanceMonitor {
  constructor() {
    this.metricsDir = path.join(process.cwd(), 'monitoring', 'runtime-metrics');
    this.ensureMetricsDir();
    this.testResults = {
      timestamp: new Date().toISOString(),
      testId: this.generateTestId(),
      pageLoadTests: {},
      resourceUsage: {},
      performanceMetrics: {},
      errors: []
    };
  }

  generateTestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `runtime-${timestamp}-${random}`;
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  async measurePageLoadTime(url, testName = 'default') {
    console.log(`📊 Measuring page load time for ${url}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        
        response.on('end', () => {
          const result = {
            url,
            testName,
            loadTime,
            statusCode: response.statusCode,
            contentLength: body.length,
            headers: response.headers,
            timestamp: new Date().toISOString(),
            success: response.statusCode >= 200 && response.statusCode < 400
          };
          
          console.log(`${result.success ? '✅' : '❌'} ${testName}: ${loadTime}ms (${response.statusCode})`);
          resolve(result);
        });
      });
      
      request.on('error', (error) => {
        const endTime = Date.now();
        const result = {
          url,
          testName,
          loadTime: endTime - startTime,
          error: error.message,
          timestamp: new Date().toISOString(),
          success: false
        };
        
        console.log(`❌ ${testName}: Failed - ${error.message}`);
        resolve(result);
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        const endTime = Date.now();
        const result = {
          url,
          testName,
          loadTime: endTime - startTime,
          error: 'Timeout',
          timestamp: new Date().toISOString(),
          success: false
        };
        
        console.log(`❌ ${testName}: Timeout after 10s`);
        resolve(result);
      });
    });
  }

  async measureContainerResourceUsage() {
    console.log('📊 Measuring container resource usage...');
    
    try {
      // Get container stats
      const statsOutput = execSync(
        'docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.NetIO}}\\t{{.BlockIO}}"',
        { encoding: 'utf8', timeout: 10000 }
      );
      
      const lines = statsOutput.trim().split('\n').slice(1); // Skip header
      const containerStats = {};
      
      lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 6) {
          const [container, cpu, memUsage, memPerc, netIO, blockIO] = parts;
          
          containerStats[container] = {
            cpu: this.parseCpuPercentage(cpu),
            memoryUsage: this.parseMemoryUsage(memUsage),
            memoryPercentage: this.parsePercentage(memPerc),
            networkIO: this.parseNetworkIO(netIO),
            blockIO: this.parseBlockIO(blockIO),
            timestamp: Date.now()
          };
        }
      });
      
      console.log(`✅ Collected stats for ${Object.keys(containerStats).length} containers`);
      return containerStats;
      
    } catch (error) {
      console.error('❌ Failed to collect container stats:', error.message);
      this.testResults.errors.push({
        type: 'resource_collection',
        message: error.message,
        timestamp: Date.now()
      });
      return {};
    }
  }

  parseCpuPercentage(cpuStr) {
    const match = cpuStr.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : 0;
  }

  parseMemoryUsage(memStr) {
    // Parse "123.4MiB / 512MiB" format
    const parts = memStr.split(' / ');
    if (parts.length !== 2) return { used: 0, total: 0 };
    
    return {
      used: this.parseMemorySize(parts[0]),
      total: this.parseMemorySize(parts[1])
    };
  }

  parseMemorySize(sizeStr) {
    const match = sizeStr.match(/([\d.]+)([KMGT]?i?B)/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers = {
      'B': 1,
      'KB': 1000, 'KIB': 1024,
      'MB': 1000000, 'MIB': 1024 * 1024,
      'GB': 1000000000, 'GIB': 1024 * 1024 * 1024,
      'TB': 1000000000000, 'TIB': 1024 * 1024 * 1024 * 1024
    };
    
    return Math.round(value * (multipliers[unit] || 1));
  }

  parsePercentage(percStr) {
    const match = percStr.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : 0;
  }

  parseNetworkIO(netStr) {
    // Parse "1.23MB / 4.56MB" format
    const parts = netStr.split(' / ');
    if (parts.length !== 2) return { rx: 0, tx: 0 };
    
    return {
      rx: this.parseMemorySize(parts[0]),
      tx: this.parseMemorySize(parts[1])
    };
  }

  parseBlockIO(blockStr) {
    // Parse "1.23MB / 4.56MB" format
    const parts = blockStr.split(' / ');
    if (parts.length !== 2) return { read: 0, write: 0 };
    
    return {
      read: this.parseMemorySize(parts[0]),
      write: this.parseMemorySize(parts[1])
    };
  }

  async waitForContainerHealth(containerName, maxWaitTime = 60000) {
    console.log(`⏳ Waiting for ${containerName} to be healthy...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const healthOutput = execSync(
          `docker inspect ${containerName} --format='{{.State.Health.Status}}'`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        
        if (healthOutput === 'healthy') {
          console.log(`✅ ${containerName} is healthy`);
          return true;
        }
        
        if (healthOutput === 'unhealthy') {
          console.log(`❌ ${containerName} is unhealthy`);
          return false;
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        // Container might not have health check, try basic status
        try {
          const statusOutput = execSync(
            `docker inspect ${containerName} --format='{{.State.Status}}'`,
            { encoding: 'utf8', timeout: 5000 }
          ).trim();
          
          if (statusOutput === 'running') {
            console.log(`✅ ${containerName} is running (no health check)`);
            return true;
          }
        } catch (statusError) {
          console.log(`⚠️  Could not check ${containerName} status`);
        }
      }
    }
    
    console.log(`❌ ${containerName} did not become healthy within ${maxWaitTime}ms`);
    return false;
  }

  async runPageLoadTests() {
    console.log('🚀 Starting page load performance tests...');
    
    const testUrls = [
      { url: 'http://localhost:3000', name: 'website-homepage' },
      { url: 'http://localhost:3000/about', name: 'website-about' },
      { url: 'http://localhost:3000/api/health', name: 'website-api-health' },
      { url: 'http://localhost:3001', name: 'cms-homepage' },
      { url: 'http://localhost:3001/api/health', name: 'cms-api-health' }
    ];
    
    const results = {};
    
    for (const test of testUrls) {
      try {
        const result = await this.measurePageLoadTime(test.url, test.name);
        results[test.name] = result;
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Test ${test.name} failed:`, error.message);
        results[test.name] = {
          url: test.url,
          testName: test.name,
          error: error.message,
          success: false,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return results;
  }

  async runResourceUsageTests(duration = 30000) {
    console.log(`📊 Monitoring resource usage for ${duration / 1000}s...`);
    
    const samples = [];
    const sampleInterval = 5000; // 5 seconds
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const stats = await this.measureContainerResourceUsage();
      if (Object.keys(stats).length > 0) {
        samples.push({
          timestamp: Date.now(),
          stats
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, sampleInterval));
    }
    
    // Calculate averages and peaks
    const summary = this.calculateResourceSummary(samples);
    
    console.log(`✅ Collected ${samples.length} resource usage samples`);
    return { samples, summary };
  }

  calculateResourceSummary(samples) {
    if (samples.length === 0) return {};
    
    const containerSummaries = {};
    
    // Group by container
    samples.forEach(sample => {
      Object.entries(sample.stats).forEach(([container, stats]) => {
        if (!containerSummaries[container]) {
          containerSummaries[container] = {
            cpu: [],
            memory: [],
            memoryPercentage: []
          };
        }
        
        containerSummaries[container].cpu.push(stats.cpu);
        containerSummaries[container].memory.push(stats.memoryUsage.used);
        containerSummaries[container].memoryPercentage.push(stats.memoryPercentage);
      });
    });
    
    // Calculate statistics
    const summary = {};
    Object.entries(containerSummaries).forEach(([container, data]) => {
      summary[container] = {
        cpu: {
          avg: this.calculateAverage(data.cpu),
          max: Math.max(...data.cpu),
          min: Math.min(...data.cpu)
        },
        memory: {
          avg: this.calculateAverage(data.memory),
          max: Math.max(...data.memory),
          min: Math.min(...data.memory)
        },
        memoryPercentage: {
          avg: this.calculateAverage(data.memoryPercentage),
          max: Math.max(...data.memoryPercentage),
          min: Math.min(...data.memoryPercentage)
        }
      };
    });
    
    return summary;
  }

  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  checkPerformanceBenchmarks() {
    console.log('\n🎯 Performance Benchmark Results:');
    
    const benchmarks = {
      pageLoadTime: { target: 1000, unit: 'ms' }, // 1 second
      memoryUsage: { target: 512 * 1024 * 1024, unit: 'bytes' }, // 512MB
      cpuUsage: { target: 50, unit: '%' } // 50%
    };
    
    // Check page load times
    Object.entries(this.testResults.pageLoadTests).forEach(([testName, result]) => {
      if (result.success && result.loadTime) {
        const target = benchmarks.pageLoadTime.target;
        const status = result.loadTime <= target ? '✅' : '⚠️';
        console.log(`  ${status} ${testName}: ${result.loadTime}ms (target: ${target}ms)`);
      }
    });
    
    // Check resource usage
    if (this.testResults.resourceUsage.summary) {
      Object.entries(this.testResults.resourceUsage.summary).forEach(([container, stats]) => {
        // Memory check
        const memTarget = benchmarks.memoryUsage.target;
        const memStatus = stats.memory.avg <= memTarget ? '✅' : '⚠️';
        const memMB = Math.round(stats.memory.avg / (1024 * 1024));
        const memTargetMB = Math.round(memTarget / (1024 * 1024));
        console.log(`  ${memStatus} ${container} memory: ${memMB}MB avg (target: ${memTargetMB}MB)`);
        
        // CPU check
        const cpuTarget = benchmarks.cpuUsage.target;
        const cpuStatus = stats.cpu.avg <= cpuTarget ? '✅' : '⚠️';
        console.log(`  ${cpuStatus} ${container} CPU: ${stats.cpu.avg.toFixed(1)}% avg (target: ${cpuTarget}%)`);
      });
    }
  }

  generateReport() {
    console.log('\n📊 Runtime Performance Report');
    console.log('=' .repeat(50));
    console.log(`Test ID: ${this.testResults.testId}`);
    console.log(`Timestamp: ${this.testResults.timestamp}`);
    
    // Page load summary
    const pageTests = Object.values(this.testResults.pageLoadTests);
    const successfulTests = pageTests.filter(t => t.success);
    const avgLoadTime = successfulTests.length > 0 
      ? successfulTests.reduce((sum, t) => sum + t.loadTime, 0) / successfulTests.length 
      : 0;
    
    console.log(`\n🌐 Page Load Tests: ${successfulTests.length}/${pageTests.length} successful`);
    if (avgLoadTime > 0) {
      console.log(`Average load time: ${avgLoadTime.toFixed(0)}ms`);
    }
    
    // Resource usage summary
    if (this.testResults.resourceUsage.summary) {
      console.log('\n💾 Resource Usage Summary:');
      Object.entries(this.testResults.resourceUsage.summary).forEach(([container, stats]) => {
        console.log(`  ${container}:`);
        console.log(`    CPU: ${stats.cpu.avg.toFixed(1)}% avg, ${stats.cpu.max.toFixed(1)}% peak`);
        console.log(`    Memory: ${Math.round(stats.memory.avg / (1024 * 1024))}MB avg, ${Math.round(stats.memory.max / (1024 * 1024))}MB peak`);
      });
    }
    
    // Errors
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.testResults.errors.forEach(error => {
        console.log(`  ${error.type}: ${error.message}`);
      });
    }
    
    this.checkPerformanceBenchmarks();
  }

  saveResults() {
    const filename = `runtime-metrics-${this.testResults.testId}.json`;
    const filepath = path.join(this.metricsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.testResults, null, 2));
    console.log(`\n💾 Results saved to: ${filepath}`);
    
    // Also save as latest for easy access
    const latestPath = path.join(this.metricsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(this.testResults, null, 2));
  }

  async runFullPerformanceTest() {
    console.log('🚀 Starting comprehensive runtime performance test');
    
    try {
      // Wait for containers to be healthy
      const containers = ['saas-platform-website-1', 'saas-platform-cms-1'];
      for (const container of containers) {
        await this.waitForContainerHealth(container);
      }
      
      // Run page load tests
      this.testResults.pageLoadTests = await this.runPageLoadTests();
      
      // Run resource usage monitoring
      this.testResults.resourceUsage = await this.runResourceUsageTests();
      
      this.generateReport();
      this.saveResults();
      
      return this.testResults;
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      this.testResults.errors.push({
        type: 'test_failure',
        message: error.message,
        timestamp: Date.now()
      });
      this.saveResults();
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  
  const monitor = new RuntimePerformanceMonitor();
  
  switch (command) {
    case 'full':
      monitor.runFullPerformanceTest()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'pageload':
      monitor.runPageLoadTests()
        .then(results => {
          console.log(JSON.stringify(results, null, 2));
          process.exit(0);
        })
        .catch(() => process.exit(1));
      break;
      
    case 'resources':
      const duration = parseInt(args[1]) || 30000;
      monitor.runResourceUsageTests(duration)
        .then(results => {
          console.log(JSON.stringify(results, null, 2));
          process.exit(0);
        })
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/runtime-performance-monitor.js full');
      console.log('  node scripts/runtime-performance-monitor.js pageload');
      console.log('  node scripts/runtime-performance-monitor.js resources [duration-ms]');
      process.exit(1);
  }
}

module.exports = RuntimePerformanceMonitor;
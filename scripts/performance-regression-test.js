#!/usr/bin/env node

/**
 * Performance Regression Testing
 * Compares current performance against historical baselines
 */

const fs = require('fs');
const path = require('path');
const RuntimePerformanceMonitor = require('./runtime-performance-monitor');

class PerformanceRegressionTester {
  constructor() {
    this.metricsDir = path.join(process.cwd(), 'monitoring', 'runtime-metrics');
    this.baselineFile = path.join(this.metricsDir, 'baseline.json');
    this.thresholds = {
      pageLoadTime: {
        warning: 20, // 20% increase
        critical: 50 // 50% increase
      },
      memoryUsage: {
        warning: 15, // 15% increase
        critical: 30 // 30% increase
      },
      cpuUsage: {
        warning: 25, // 25% increase
        critical: 50 // 50% increase
      }
    };
  }

  loadBaseline() {
    if (!fs.existsSync(this.baselineFile)) {
      return null;
    }
    
    try {
      return JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
    } catch (error) {
      console.error('Error loading baseline:', error.message);
      return null;
    }
  }

  loadHistoricalMetrics(days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(this.metricsDir)
        .filter(f => f.startsWith('runtime-metrics-') && f.endsWith('.json'))
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

  calculateBaseline(historicalMetrics) {
    if (historicalMetrics.length === 0) {
      return null;
    }

    console.log(`📊 Calculating baseline from ${historicalMetrics.length} historical runs`);

    // Calculate baseline page load times
    const pageLoadBaselines = {};
    const resourceBaselines = {};

    historicalMetrics.forEach(metrics => {
      // Process page load tests
      Object.entries(metrics.pageLoadTests || {}).forEach(([testName, result]) => {
        if (result.success && result.loadTime) {
          if (!pageLoadBaselines[testName]) {
            pageLoadBaselines[testName] = [];
          }
          pageLoadBaselines[testName].push(result.loadTime);
        }
      });

      // Process resource usage
      if (metrics.resourceUsage && metrics.resourceUsage.summary) {
        Object.entries(metrics.resourceUsage.summary).forEach(([container, stats]) => {
          if (!resourceBaselines[container]) {
            resourceBaselines[container] = {
              cpu: [],
              memory: []
            };
          }
          resourceBaselines[container].cpu.push(stats.cpu.avg);
          resourceBaselines[container].memory.push(stats.memory.avg);
        });
      }
    });

    // Calculate averages
    const baseline = {
      timestamp: new Date().toISOString(),
      sampleSize: historicalMetrics.length,
      pageLoadTimes: {},
      resourceUsage: {}
    };

    Object.entries(pageLoadBaselines).forEach(([testName, times]) => {
      baseline.pageLoadTimes[testName] = {
        avg: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        samples: times.length
      };
    });

    Object.entries(resourceBaselines).forEach(([container, data]) => {
      baseline.resourceUsage[container] = {
        cpu: {
          avg: data.cpu.reduce((sum, val) => sum + val, 0) / data.cpu.length,
          samples: data.cpu.length
        },
        memory: {
          avg: data.memory.reduce((sum, val) => sum + val, 0) / data.memory.length,
          samples: data.memory.length
        }
      };
    });

    return baseline;
  }

  saveBaseline(baseline) {
    fs.writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
    console.log(`💾 Baseline saved to: ${this.baselineFile}`);
  }

  compareWithBaseline(currentMetrics, baseline) {
    const regressions = [];

    // Compare page load times
    Object.entries(currentMetrics.pageLoadTests || {}).forEach(([testName, result]) => {
      if (!result.success || !result.loadTime) return;
      
      const baselineTime = baseline.pageLoadTimes[testName];
      if (!baselineTime) return;

      const increase = ((result.loadTime - baselineTime.avg) / baselineTime.avg) * 100;
      
      if (increase > this.thresholds.pageLoadTime.critical) {
        regressions.push({
          type: 'CRITICAL',
          category: 'page_load_time',
          test: testName,
          current: result.loadTime,
          baseline: baselineTime.avg,
          increase: increase.toFixed(1),
          message: `${testName} load time increased by ${increase.toFixed(1)}% (${result.loadTime}ms vs ${baselineTime.avg.toFixed(0)}ms baseline)`
        });
      } else if (increase > this.thresholds.pageLoadTime.warning) {
        regressions.push({
          type: 'WARNING',
          category: 'page_load_time',
          test: testName,
          current: result.loadTime,
          baseline: baselineTime.avg,
          increase: increase.toFixed(1),
          message: `${testName} load time increased by ${increase.toFixed(1)}% (${result.loadTime}ms vs ${baselineTime.avg.toFixed(0)}ms baseline)`
        });
      }
    });

    // Compare resource usage
    if (currentMetrics.resourceUsage && currentMetrics.resourceUsage.summary) {
      Object.entries(currentMetrics.resourceUsage.summary).forEach(([container, stats]) => {
        const baselineStats = baseline.resourceUsage[container];
        if (!baselineStats) return;

        // Check memory usage
        const memIncrease = ((stats.memory.avg - baselineStats.memory.avg) / baselineStats.memory.avg) * 100;
        if (memIncrease > this.thresholds.memoryUsage.critical) {
          regressions.push({
            type: 'CRITICAL',
            category: 'memory_usage',
            container,
            current: stats.memory.avg,
            baseline: baselineStats.memory.avg,
            increase: memIncrease.toFixed(1),
            message: `${container} memory usage increased by ${memIncrease.toFixed(1)}% (${Math.round(stats.memory.avg / (1024 * 1024))}MB vs ${Math.round(baselineStats.memory.avg / (1024 * 1024))}MB baseline)`
          });
        } else if (memIncrease > this.thresholds.memoryUsage.warning) {
          regressions.push({
            type: 'WARNING',
            category: 'memory_usage',
            container,
            current: stats.memory.avg,
            baseline: baselineStats.memory.avg,
            increase: memIncrease.toFixed(1),
            message: `${container} memory usage increased by ${memIncrease.toFixed(1)}% (${Math.round(stats.memory.avg / (1024 * 1024))}MB vs ${Math.round(baselineStats.memory.avg / (1024 * 1024))}MB baseline)`
          });
        }

        // Check CPU usage
        const cpuIncrease = ((stats.cpu.avg - baselineStats.cpu.avg) / baselineStats.cpu.avg) * 100;
        if (cpuIncrease > this.thresholds.cpuUsage.critical) {
          regressions.push({
            type: 'CRITICAL',
            category: 'cpu_usage',
            container,
            current: stats.cpu.avg,
            baseline: baselineStats.cpu.avg,
            increase: cpuIncrease.toFixed(1),
            message: `${container} CPU usage increased by ${cpuIncrease.toFixed(1)}% (${stats.cpu.avg.toFixed(1)}% vs ${baselineStats.cpu.avg.toFixed(1)}% baseline)`
          });
        } else if (cpuIncrease > this.thresholds.cpuUsage.warning) {
          regressions.push({
            type: 'WARNING',
            category: 'cpu_usage',
            container,
            current: stats.cpu.avg,
            baseline: baselineStats.cpu.avg,
            increase: cpuIncrease.toFixed(1),
            message: `${container} CPU usage increased by ${cpuIncrease.toFixed(1)}% (${stats.cpu.avg.toFixed(1)}% vs ${baselineStats.cpu.avg.toFixed(1)}% baseline)`
          });
        }
      });
    }

    return regressions;
  }

  generateRegressionReport(regressions) {
    if (regressions.length === 0) {
      console.log('✅ No performance regressions detected');
      return;
    }

    console.log('\n🚨 Performance Regression Report');
    console.log('=' .repeat(50));

    const critical = regressions.filter(r => r.type === 'CRITICAL');
    const warnings = regressions.filter(r => r.type === 'WARNING');

    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL REGRESSIONS:');
      critical.forEach(regression => {
        console.log(`  ❌ ${regression.message}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\n🟡 WARNING REGRESSIONS:');
      warnings.forEach(regression => {
        console.log(`  ⚠️  ${regression.message}`);
      });
    }

    console.log(`\nTotal regressions: ${regressions.length} (${critical.length} critical, ${warnings.length} warnings)`);
  }

  saveRegressionReport(regressions) {
    const reportData = {
      timestamp: new Date().toISOString(),
      regressions,
      summary: {
        total: regressions.length,
        critical: regressions.filter(r => r.type === 'CRITICAL').length,
        warnings: regressions.filter(r => r.type === 'WARNING').length
      }
    };

    const filename = `regression-report-${Date.now()}.json`;
    const filepath = path.join(this.metricsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));
    
    // Also save as latest
    const latestPath = path.join(this.metricsDir, 'latest-regression.json');
    fs.writeFileSync(latestPath, JSON.stringify(reportData, null, 2));
    
    console.log(`\n💾 Regression report saved to: ${filepath}`);
  }

  async runRegressionTest() {
    console.log('🔍 Starting performance regression test...');

    try {
      // Run current performance test
      const monitor = new RuntimePerformanceMonitor();
      const currentMetrics = await monitor.runFullPerformanceTest();

      // Load or create baseline
      let baseline = this.loadBaseline();
      if (!baseline) {
        console.log('📊 No baseline found, creating from historical data...');
        const historicalMetrics = this.loadHistoricalMetrics(14); // 2 weeks
        
        if (historicalMetrics.length < 3) {
          console.log('⚠️  Insufficient historical data for baseline (need at least 3 runs)');
          console.log('💡 Run more performance tests to establish a baseline');
          return { regressions: [], baseline: null, currentMetrics };
        }

        baseline = this.calculateBaseline(historicalMetrics);
        this.saveBaseline(baseline);
      }

      console.log(`📊 Using baseline from ${baseline.timestamp} (${baseline.sampleSize} samples)`);

      // Compare with baseline
      const regressions = this.compareWithBaseline(currentMetrics, baseline);

      this.generateRegressionReport(regressions);
      this.saveRegressionReport(regressions);

      return { regressions, baseline, currentMetrics };

    } catch (error) {
      console.error('❌ Regression test failed:', error.message);
      throw error;
    }
  }

  async updateBaseline() {
    console.log('🔄 Updating performance baseline...');

    const historicalMetrics = this.loadHistoricalMetrics(14); // 2 weeks
    
    if (historicalMetrics.length < 5) {
      console.log('⚠️  Insufficient data for baseline update (need at least 5 runs)');
      return false;
    }

    const newBaseline = this.calculateBaseline(historicalMetrics);
    
    // Backup old baseline
    if (fs.existsSync(this.baselineFile)) {
      const backupFile = path.join(this.metricsDir, `baseline-backup-${Date.now()}.json`);
      fs.copyFileSync(this.baselineFile, backupFile);
      console.log(`📦 Old baseline backed up to: ${backupFile}`);
    }

    this.saveBaseline(newBaseline);
    console.log('✅ Baseline updated successfully');
    
    return true;
  }

  showBaselineInfo() {
    const baseline = this.loadBaseline();
    
    if (!baseline) {
      console.log('❌ No baseline found');
      return;
    }

    console.log('\n📊 Current Performance Baseline');
    console.log('=' .repeat(40));
    console.log(`Created: ${baseline.timestamp}`);
    console.log(`Sample size: ${baseline.sampleSize} runs`);

    console.log('\n🌐 Page Load Time Baselines:');
    Object.entries(baseline.pageLoadTimes).forEach(([test, stats]) => {
      console.log(`  ${test}: ${stats.avg.toFixed(0)}ms avg (${stats.samples} samples)`);
    });

    console.log('\n💾 Resource Usage Baselines:');
    Object.entries(baseline.resourceUsage).forEach(([container, stats]) => {
      console.log(`  ${container}:`);
      console.log(`    CPU: ${stats.cpu.avg.toFixed(1)}% avg`);
      console.log(`    Memory: ${Math.round(stats.memory.avg / (1024 * 1024))}MB avg`);
    });
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';
  
  const tester = new PerformanceRegressionTester();
  
  switch (command) {
    case 'test':
      tester.runRegressionTest()
        .then(result => {
          const hasCritical = result.regressions.some(r => r.type === 'CRITICAL');
          process.exit(hasCritical ? 1 : 0);
        })
        .catch(() => process.exit(1));
      break;
      
    case 'baseline':
      const subCommand = args[1] || 'show';
      if (subCommand === 'update') {
        tester.updateBaseline()
          .then(success => process.exit(success ? 0 : 1))
          .catch(() => process.exit(1));
      } else {
        tester.showBaselineInfo();
      }
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/performance-regression-test.js test');
      console.log('  node scripts/performance-regression-test.js baseline [show|update]');
      process.exit(1);
  }
}

module.exports = PerformanceRegressionTester;
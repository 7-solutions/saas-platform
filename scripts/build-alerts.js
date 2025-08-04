#!/usr/bin/env node

/**
 * Build Performance Alert System
 * Monitors build metrics and sends alerts for regressions
 */

const fs = require('fs');
const path = require('path');

class BuildAlertSystem {
  constructor() {
    this.metricsDir = path.join(process.cwd(), 'monitoring', 'build-metrics');
    this.alertsDir = path.join(process.cwd(), 'monitoring', 'alerts');
    this.thresholds = {
      buildTime: {
        warning: 90, // seconds
        critical: 120 // seconds (2 minutes)
      },
      cacheHitRate: {
        warning: 30, // percent
        critical: 20 // percent
      },
      buildSizeIncrease: {
        warning: 10, // percent
        critical: 25 // percent
      },
      failureRate: {
        warning: 5, // percent
        critical: 10 // percent
      }
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.metricsDir, this.alertsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadLatestMetrics() {
    const latestPath = path.join(this.metricsDir, 'latest.json');
    if (!fs.existsSync(latestPath)) {
      throw new Error('No build metrics found. Run a build first.');
    }
    
    return JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  }

  loadHistoricalMetrics(days = 7) {
    const files = fs.readdirSync(this.metricsDir)
      .filter(f => f.startsWith('build-metrics-') && f.endsWith('.json'))
      .sort()
      .slice(-days * 3); // Approximate 3 builds per day

    return files.map(file => {
      const filepath = path.join(this.metricsDir, file);
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    });
  }

  calculateBaseline(historicalMetrics) {
    if (historicalMetrics.length === 0) {
      return null;
    }

    const successful = historicalMetrics.filter(m => 
      Object.values(m.stages).some(stage => stage.success)
    );

    if (successful.length === 0) {
      return null;
    }

    const buildTimes = successful.map(m => m.totalDuration).filter(Boolean);
    const cacheHitRates = successful.flatMap(m => 
      Object.values(m.cacheStats).map(stats => stats.hitRate)
    ).filter(Boolean);

    return {
      avgBuildTime: buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length,
      avgCacheHitRate: cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length,
      sampleSize: successful.length
    };
  }

  checkBuildTimeAlerts(currentMetrics, baseline) {
    const alerts = [];
    const buildTimeSeconds = currentMetrics.totalDuration / 1000;

    // Absolute threshold alerts
    if (buildTimeSeconds > this.thresholds.buildTime.critical) {
      alerts.push({
        type: 'CRITICAL',
        category: 'build_time',
        message: `Build time ${buildTimeSeconds.toFixed(1)}s exceeds critical threshold of ${this.thresholds.buildTime.critical}s`,
        value: buildTimeSeconds,
        threshold: this.thresholds.buildTime.critical
      });
    } else if (buildTimeSeconds > this.thresholds.buildTime.warning) {
      alerts.push({
        type: 'WARNING',
        category: 'build_time',
        message: `Build time ${buildTimeSeconds.toFixed(1)}s exceeds warning threshold of ${this.thresholds.buildTime.warning}s`,
        value: buildTimeSeconds,
        threshold: this.thresholds.buildTime.warning
      });
    }

    // Regression alerts (compared to baseline)
    if (baseline && baseline.avgBuildTime) {
      const baselineSeconds = baseline.avgBuildTime / 1000;
      const increase = ((buildTimeSeconds - baselineSeconds) / baselineSeconds) * 100;
      
      if (increase > this.thresholds.buildSizeIncrease.critical) {
        alerts.push({
          type: 'CRITICAL',
          category: 'build_regression',
          message: `Build time increased by ${increase.toFixed(1)}% compared to baseline (${baselineSeconds.toFixed(1)}s)`,
          value: increase,
          baseline: baselineSeconds,
          current: buildTimeSeconds
        });
      } else if (increase > this.thresholds.buildSizeIncrease.warning) {
        alerts.push({
          type: 'WARNING',
          category: 'build_regression',
          message: `Build time increased by ${increase.toFixed(1)}% compared to baseline (${baselineSeconds.toFixed(1)}s)`,
          value: increase,
          baseline: baselineSeconds,
          current: buildTimeSeconds
        });
      }
    }

    return alerts;
  }

  checkCacheAlerts(currentMetrics, baseline) {
    const alerts = [];
    
    Object.entries(currentMetrics.cacheStats).forEach(([service, stats]) => {
      // Absolute threshold alerts
      if (stats.hitRate < this.thresholds.cacheHitRate.critical) {
        alerts.push({
          type: 'CRITICAL',
          category: 'cache_hit_rate',
          service,
          message: `${service} cache hit rate ${stats.hitRate}% below critical threshold of ${this.thresholds.cacheHitRate.critical}%`,
          value: stats.hitRate,
          threshold: this.thresholds.cacheHitRate.critical
        });
      } else if (stats.hitRate < this.thresholds.cacheHitRate.warning) {
        alerts.push({
          type: 'WARNING',
          category: 'cache_hit_rate',
          service,
          message: `${service} cache hit rate ${stats.hitRate}% below warning threshold of ${this.thresholds.cacheHitRate.warning}%`,
          value: stats.hitRate,
          threshold: this.thresholds.cacheHitRate.warning
        });
      }
    });

    return alerts;
  }

  checkFailureAlerts(currentMetrics) {
    const alerts = [];
    const failedStages = Object.entries(currentMetrics.stages)
      .filter(([_, stage]) => !stage.success);

    if (failedStages.length > 0) {
      alerts.push({
        type: 'CRITICAL',
        category: 'build_failure',
        message: `Build failures detected in stages: ${failedStages.map(([name]) => name).join(', ')}`,
        failedStages: failedStages.map(([name, stage]) => ({ name, ...stage }))
      });
    }

    if (currentMetrics.errors.length > 0) {
      alerts.push({
        type: 'WARNING',
        category: 'build_errors',
        message: `${currentMetrics.errors.length} build errors detected`,
        errors: currentMetrics.errors
      });
    }

    return alerts;
  }

  generateAlertReport(alerts) {
    if (alerts.length === 0) {
      console.log('✅ No build performance alerts');
      return;
    }

    console.log('\n🚨 Build Performance Alerts');
    console.log('=' .repeat(50));

    const critical = alerts.filter(a => a.type === 'CRITICAL');
    const warnings = alerts.filter(a => a.type === 'WARNING');

    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL ALERTS:');
      critical.forEach(alert => {
        console.log(`  ❌ ${alert.message}`);
        if (alert.service) console.log(`     Service: ${alert.service}`);
        if (alert.value !== undefined) console.log(`     Value: ${alert.value}`);
        if (alert.threshold !== undefined) console.log(`     Threshold: ${alert.threshold}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\n🟡 WARNING ALERTS:');
      warnings.forEach(alert => {
        console.log(`  ⚠️  ${alert.message}`);
        if (alert.service) console.log(`     Service: ${alert.service}`);
        if (alert.value !== undefined) console.log(`     Value: ${alert.value}`);
        if (alert.threshold !== undefined) console.log(`     Threshold: ${alert.threshold}`);
      });
    }

    console.log(`\nTotal alerts: ${alerts.length} (${critical.length} critical, ${warnings.length} warnings)`);
  }

  saveAlerts(alerts) {
    if (alerts.length === 0) return;

    const timestamp = new Date().toISOString();
    const alertData = {
      timestamp,
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.type === 'CRITICAL').length,
        warnings: alerts.filter(a => a.type === 'WARNING').length
      }
    };

    const filename = `alerts-${Date.now()}.json`;
    const filepath = path.join(this.alertsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(alertData, null, 2));
    
    // Also save as latest for easy access
    const latestPath = path.join(this.alertsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(alertData, null, 2));
    
    console.log(`\n💾 Alerts saved to: ${filepath}`);
  }

  sendWebhookAlert(alerts) {
    // Placeholder for webhook integration
    // In a real implementation, this would send to Slack, Discord, etc.
    const webhookUrl = process.env.BUILD_ALERT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log('💡 Set BUILD_ALERT_WEBHOOK_URL to enable webhook alerts');
      return;
    }

    const critical = alerts.filter(a => a.type === 'CRITICAL');
    if (critical.length === 0) return;

    console.log(`🔔 Would send webhook alert for ${critical.length} critical issues`);
    // Implementation would use fetch/axios to send webhook
  }

  async checkAlerts() {
    try {
      console.log('🔍 Checking build performance alerts...');
      
      const currentMetrics = this.loadLatestMetrics();
      const historicalMetrics = this.loadHistoricalMetrics();
      const baseline = this.calculateBaseline(historicalMetrics);
      
      if (baseline) {
        console.log(`📊 Baseline: ${(baseline.avgBuildTime / 1000).toFixed(1)}s avg build time, ${baseline.avgCacheHitRate.toFixed(1)}% avg cache hit rate (${baseline.sampleSize} samples)`);
      }

      const alerts = [
        ...this.checkBuildTimeAlerts(currentMetrics, baseline),
        ...this.checkCacheAlerts(currentMetrics, baseline),
        ...this.checkFailureAlerts(currentMetrics)
      ];

      this.generateAlertReport(alerts);
      this.saveAlerts(alerts);
      this.sendWebhookAlert(alerts);

      return alerts;
    } catch (error) {
      console.error('❌ Alert check failed:', error.message);
      throw error;
    }
  }

  getAlertHistory(days = 7) {
    const files = fs.readdirSync(this.alertsDir)
      .filter(f => f.startsWith('alerts-') && f.endsWith('.json'))
      .sort()
      .slice(-days * 5); // Approximate alerts per day

    return files.map(file => {
      const filepath = path.join(this.alertsDir, file);
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    });
  }

  generateTrendReport() {
    try {
      const historicalMetrics = this.loadHistoricalMetrics(14); // 2 weeks
      const alertHistory = this.getAlertHistory(14);

      console.log('\n📈 Build Performance Trends (14 days)');
      console.log('=' .repeat(50));

      if (historicalMetrics.length === 0) {
        console.log('No historical data available');
        return;
      }

      // Build time trend
      const buildTimes = historicalMetrics
        .map(m => ({ time: new Date(m.timestamp), duration: m.totalDuration / 1000 }))
        .sort((a, b) => a.time - b.time);

      const avgBuildTime = buildTimes.reduce((sum, b) => sum + b.duration, 0) / buildTimes.length;
      const recentAvg = buildTimes.slice(-5).reduce((sum, b) => sum + b.duration, 0) / Math.min(5, buildTimes.length);
      const trend = recentAvg > avgBuildTime ? '📈' : '📉';

      console.log(`Build Time: ${avgBuildTime.toFixed(1)}s avg, ${recentAvg.toFixed(1)}s recent ${trend}`);

      // Alert frequency
      const totalAlerts = alertHistory.reduce((sum, a) => sum + a.summary.total, 0);
      const criticalAlerts = alertHistory.reduce((sum, a) => sum + a.summary.critical, 0);
      
      console.log(`Alerts: ${totalAlerts} total, ${criticalAlerts} critical over 14 days`);

      // Cache performance
      const cacheStats = historicalMetrics.flatMap(m => 
        Object.values(m.cacheStats).map(stats => stats.hitRate)
      ).filter(Boolean);

      if (cacheStats.length > 0) {
        const avgCacheHitRate = cacheStats.reduce((sum, rate) => sum + rate, 0) / cacheStats.length;
        console.log(`Cache Hit Rate: ${avgCacheHitRate.toFixed(1)}% average`);
      }

    } catch (error) {
      console.error('❌ Trend report failed:', error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  
  const alertSystem = new BuildAlertSystem();
  
  switch (command) {
    case 'check':
      alertSystem.checkAlerts()
        .then(alerts => {
          process.exit(alerts.some(a => a.type === 'CRITICAL') ? 1 : 0);
        })
        .catch(() => process.exit(1));
      break;
      
    case 'trends':
      alertSystem.generateTrendReport();
      break;
      
    case 'history':
      const days = parseInt(args[1]) || 7;
      const history = alertSystem.getAlertHistory(days);
      console.log(JSON.stringify(history, null, 2));
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/build-alerts.js check');
      console.log('  node scripts/build-alerts.js trends');
      console.log('  node scripts/build-alerts.js history [days]');
      process.exit(1);
  }
}

module.exports = BuildAlertSystem;
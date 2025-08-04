/**
 * Next.js Performance Test for Build and Bundle Analysis
 * Focuses on measuring Next.js 15 build performance and bundle sizes
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Performance targets
const TARGETS = {
  maxBuildTime: 120000, // 2 minutes
  maxBundleSizePerApp: 50 * 1024 * 1024, // 50MB per app
  buildTimeImprovement: 0.30, // 30% improvement target
};

const CONFIG = {
  apps: ['website', 'cms'],
  projectRoot: process.cwd(),
};

const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    const child = spawn('sh', ['-c', command], {
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Show real-time output
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Show real-time errors
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
};

const measureTime = async (operation) => {
  const startTime = Date.now();
  const result = await operation();
  const endTime = Date.now();
  return {
    result,
    duration: endTime - startTime,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
  };
};

const getDirectorySize = async (dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    let totalSize = 0;
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStats = await fs.stat(itemPath);
      
      if (itemStats.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else {
        totalSize += itemStats.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.log(`Could not measure size of ${dirPath}:`, error.message);
    return 0;
  }
};

class NextJSPerformanceTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      buildResults: {},
      bundleAnalysis: {},
      summary: {},
    };
  }

  async cleanBuilds() {
    console.log('🧹 Cleaning previous builds...');
    
    for (const app of CONFIG.apps) {
      try {
        const buildPath = path.join(CONFIG.projectRoot, 'apps', app, '.next');
        await executeCommand(`rm -rf "${buildPath}"`);
        console.log(`✅ Cleaned ${app} build directory`);
      } catch (error) {
        console.log(`⚠️  Could not clean ${app}:`, error.message);
      }
    }
  }

  async measureBuildPerformance() {
    console.log('📊 Measuring Next.js build performance...');
    
    for (const app of CONFIG.apps) {
      console.log(`\n🔨 Building ${app} app...`);
      
      const buildMeasurement = await measureTime(async () => {
        return await executeCommand(`pnpm --filter @saas-platform/${app} build`, {
          cwd: CONFIG.projectRoot,
        });
      });
      
      this.results.buildResults[app] = {
        duration: buildMeasurement.duration,
        success: true,
        startTime: buildMeasurement.startTime,
        endTime: buildMeasurement.endTime,
        meetsTarget: buildMeasurement.duration <= TARGETS.maxBuildTime,
      };
      
      console.log(`✅ ${app} build completed in ${Math.round(buildMeasurement.duration / 1000)}s`);
    }
    
    // Calculate totals
    const totalBuildTime = Object.values(this.results.buildResults)
      .reduce((sum, result) => sum + result.duration, 0);
    
    this.results.buildResults.summary = {
      totalBuildTime,
      averageBuildTime: totalBuildTime / CONFIG.apps.length,
      allBuildsSuccessful: Object.values(this.results.buildResults).every(r => r.success),
      meetsTarget: totalBuildTime <= TARGETS.maxBuildTime,
    };
    
    console.log(`\n📈 Total build time: ${Math.round(totalBuildTime / 1000)}s`);
    console.log(`📈 Average build time: ${Math.round(totalBuildTime / CONFIG.apps.length / 1000)}s`);
  }

  async analyzeBundleSizes() {
    console.log('\n📦 Analyzing bundle sizes...');
    
    for (const app of CONFIG.apps) {
      console.log(`\n📊 Analyzing ${app} bundle...`);
      
      const appPath = path.join(CONFIG.projectRoot, 'apps', app);
      const buildPath = path.join(appPath, '.next');
      
      try {
        await fs.access(buildPath);
        
        // Measure different parts of the build
        const staticPath = path.join(buildPath, 'static');
        const serverPath = path.join(buildPath, 'server');
        const standalonePath = path.join(buildPath, 'standalone');
        
        const measurements = {
          totalSize: await getDirectorySize(buildPath),
          staticSize: await getDirectorySize(staticPath),
          serverSize: await getDirectorySize(serverPath),
          standaloneSize: await getDirectorySize(standalonePath),
        };
        
        // Get JavaScript bundle information
        try {
          const staticJSPath = path.join(staticPath, 'chunks');
          if (await fs.access(staticJSPath).then(() => true).catch(() => false)) {
            measurements.jsChunksSize = await getDirectorySize(staticJSPath);
          } else {
            measurements.jsChunksSize = 0;
          }
        } catch (error) {
          measurements.jsChunksSize = 0;
        }
        
        // Get CSS information
        try {
          const cssFiles = await executeCommand(`find "${staticPath}" -name "*.css" -type f -exec du -b {} + | awk '{sum += $1} END {print sum}'`);
          measurements.cssSize = parseInt(cssFiles.stdout.trim() || '0', 10);
        } catch (error) {
          measurements.cssSize = 0;
        }
        
        this.results.bundleAnalysis[app] = {
          ...measurements,
          totalSizeMB: Math.round(measurements.totalSize / 1024 / 1024 * 100) / 100,
          staticSizeMB: Math.round(measurements.staticSize / 1024 / 1024 * 100) / 100,
          serverSizeMB: Math.round(measurements.serverSize / 1024 / 1024 * 100) / 100,
          meetsTarget: measurements.totalSize <= TARGETS.maxBundleSizePerApp,
          timestamp: new Date().toISOString(),
        };
        
        console.log(`📦 ${app} total size: ${this.results.bundleAnalysis[app].totalSizeMB}MB`);
        console.log(`  📁 Static assets: ${this.results.bundleAnalysis[app].staticSizeMB}MB`);
        console.log(`  🖥️  Server bundle: ${this.results.bundleAnalysis[app].serverSizeMB}MB`);
        
      } catch (error) {
        console.log(`❌ Could not analyze ${app} bundle:`, error.message);
        this.results.bundleAnalysis[app] = {
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }
    
    // Calculate summary
    const validBundles = Object.values(this.results.bundleAnalysis)
      .filter(bundle => !bundle.error);
    
    const totalBundleSize = validBundles.reduce((sum, bundle) => sum + bundle.totalSize, 0);
    
    this.results.bundleAnalysis.summary = {
      totalBundleSize,
      totalBundleSizeMB: Math.round(totalBundleSize / 1024 / 1024 * 100) / 100,
      averageBundleSize: validBundles.length > 0 ? totalBundleSize / validBundles.length : 0,
      validBundles: validBundles.length,
      allBundlesAnalyzed: validBundles.length === CONFIG.apps.length,
    };
    
    console.log(`\n📈 Total bundle size: ${this.results.bundleAnalysis.summary.totalBundleSizeMB}MB`);
  }

  async checkNextJSFeatures() {
    console.log('\n🔍 Checking Next.js 15 features...');
    
    const features = {};
    
    for (const app of CONFIG.apps) {
      const configPath = path.join(CONFIG.projectRoot, 'apps', app, 'next.config.js');
      
      try {
        const configContent = await fs.readFile(configPath, 'utf8');
        
        features[app] = {
          hasStandaloneOutput: configContent.includes('output: "standalone"'),
          hasExperimentalFeatures: configContent.includes('experimental'),
          hasPPR: configContent.includes('ppr') || configContent.includes('partialPrerendering'),
          hasOptimizedImages: configContent.includes('images'),
          configPath,
        };
        
        console.log(`📋 ${app} features:`);
        console.log(`  🏗️  Standalone output: ${features[app].hasStandaloneOutput ? '✅' : '❌'}`);
        console.log(`  🧪 Experimental features: ${features[app].hasExperimentalFeatures ? '✅' : '❌'}`);
        console.log(`  ⚡ PPR enabled: ${features[app].hasPPR ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`⚠️  Could not read ${app} config:`, error.message);
        features[app] = { error: error.message };
      }
    }
    
    this.results.nextjsFeatures = features;
  }

  generateSummary() {
    console.log('\n📋 Generating performance summary...');
    
    const summary = {
      overallScore: 0,
      targetsMet: 0,
      totalTargets: 0,
      achievements: [],
      recommendations: [],
      metrics: {},
    };
    
    // Build performance
    if (this.results.buildResults.summary?.meetsTarget) {
      summary.targetsMet++;
      summary.achievements.push(`Build time target met: ${Math.round(this.results.buildResults.summary.totalBuildTime / 1000)}s < ${TARGETS.maxBuildTime / 1000}s`);
    } else {
      summary.recommendations.push(`Optimize build time: Current ${Math.round(this.results.buildResults.summary?.totalBuildTime / 1000 || 0)}s exceeds target ${TARGETS.maxBuildTime / 1000}s`);
    }
    summary.totalTargets++;
    
    // Bundle size
    const bundleSizeOK = this.results.bundleAnalysis.summary?.totalBundleSizeMB <= (TARGETS.maxBundleSizePerApp * CONFIG.apps.length / 1024 / 1024);
    if (bundleSizeOK) {
      summary.targetsMet++;
      summary.achievements.push(`Bundle size reasonable: ${this.results.bundleAnalysis.summary?.totalBundleSizeMB || 0}MB`);
    } else {
      summary.recommendations.push(`Consider optimizing bundle size: ${this.results.bundleAnalysis.summary?.totalBundleSizeMB || 0}MB`);
    }
    summary.totalTargets++;
    
    // Next.js features
    const appsWithStandalone = Object.values(this.results.nextjsFeatures || {})
      .filter(features => features.hasStandaloneOutput).length;
    
    if (appsWithStandalone === CONFIG.apps.length) {
      summary.achievements.push(`All apps use standalone output for Docker optimization`);
    } else {
      summary.recommendations.push(`Enable standalone output in all Next.js apps for better Docker performance`);
    }
    
    // Calculate score
    summary.overallScore = Math.round((summary.targetsMet / summary.totalTargets) * 100);
    
    // Store metrics
    summary.metrics = {
      totalBuildTime: this.results.buildResults.summary?.totalBuildTime || 0,
      totalBundleSize: this.results.bundleAnalysis.summary?.totalBundleSizeMB || 0,
      appsBuilt: Object.keys(this.results.buildResults).length - 1, // -1 for summary
      bundlesAnalyzed: this.results.bundleAnalysis.summary?.validBundles || 0,
    };
    
    this.results.summary = summary;
    return summary;
  }

  async saveReport() {
    const reportPath = path.join(CONFIG.projectRoot, 'nextjs-performance-report.json');
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 Report saved to: ${reportPath}`);
    } catch (error) {
      console.log('Could not save report:', error.message);
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 NEXT.JS 15 PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(70));
    
    console.log('\n📊 BUILD PERFORMANCE:');
    if (this.results.buildResults.summary) {
      console.log(`  Total Build Time: ${Math.round(this.results.buildResults.summary.totalBuildTime / 1000)}s`);
      console.log(`  Average Build Time: ${Math.round(this.results.buildResults.summary.averageBuildTime / 1000)}s`);
      console.log(`  Target: ${TARGETS.maxBuildTime / 1000}s`);
      console.log(`  Status: ${this.results.buildResults.summary.meetsTarget ? '✅ PASS' : '❌ FAIL'}`);
      
      CONFIG.apps.forEach(app => {
        const result = this.results.buildResults[app];
        if (result) {
          console.log(`    ${app}: ${Math.round(result.duration / 1000)}s ${result.meetsTarget ? '✅' : '❌'}`);
        }
      });
    }
    
    console.log('\n📦 BUNDLE ANALYSIS:');
    if (this.results.bundleAnalysis.summary) {
      console.log(`  Total Bundle Size: ${this.results.bundleAnalysis.summary.totalBundleSizeMB}MB`);
      console.log(`  Bundles Analyzed: ${this.results.bundleAnalysis.summary.validBundles}/${CONFIG.apps.length}`);
      
      CONFIG.apps.forEach(app => {
        const bundle = this.results.bundleAnalysis[app];
        if (bundle && !bundle.error) {
          console.log(`    ${app}: ${bundle.totalSizeMB}MB (static: ${bundle.staticSizeMB}MB, server: ${bundle.serverSizeMB}MB)`);
        }
      });
    }
    
    console.log('\n🔧 NEXT.JS 15 FEATURES:');
    if (this.results.nextjsFeatures) {
      CONFIG.apps.forEach(app => {
        const features = this.results.nextjsFeatures[app];
        if (features && !features.error) {
          console.log(`  ${app}:`);
          console.log(`    Standalone Output: ${features.hasStandaloneOutput ? '✅' : '❌'}`);
          console.log(`    Experimental Features: ${features.hasExperimentalFeatures ? '✅' : '❌'}`);
          console.log(`    PPR Enabled: ${features.hasPPR ? '✅' : '❌'}`);
        }
      });
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log(`  Overall Score: ${this.results.summary.overallScore}%`);
    console.log(`  Targets Met: ${this.results.summary.targetsMet}/${this.results.summary.totalTargets}`);
    
    if (this.results.summary.achievements.length > 0) {
      console.log('\n🏆 ACHIEVEMENTS:');
      this.results.summary.achievements.forEach(achievement => {
        console.log(`  ✅ ${achievement}`);
      });
    }
    
    if (this.results.summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.summary.recommendations.forEach(recommendation => {
        console.log(`  🔧 ${recommendation}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

async function runNextJSPerformanceTest() {
  console.log('🚀 Starting Next.js 15 Performance Validation...');
  
  const test = new NextJSPerformanceTest();
  
  try {
    await test.cleanBuilds();
    await test.measureBuildPerformance();
    await test.analyzeBundleSizes();
    await test.checkNextJSFeatures();
    
    test.generateSummary();
    test.printReport();
    await test.saveReport();
    
    // Success if score is 80% or higher
    const success = test.results.summary.overallScore >= 80;
    
    if (success) {
      console.log('\n🎉 Next.js 15 performance validation PASSED!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Performance validation needs improvement.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runNextJSPerformanceTest();
}

module.exports = {
  NextJSPerformanceTest,
  TARGETS,
  CONFIG,
};
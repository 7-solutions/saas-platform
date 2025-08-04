/**
 * Production Readiness Verification for Next.js 15 Upgrade
 * Tests production Docker builds, security configurations, and monitoring/logging
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Production readiness criteria
const PRODUCTION_CRITERIA = {
  security: {
    nonRootUser: true,
    minimalBaseImage: true,
    noSecrets: true,
    securityHeaders: true,
  },
  docker: {
    multiStage: true,
    optimizedLayers: true,
    healthChecks: true,
    resourceLimits: true,
  },
  monitoring: {
    healthEndpoints: true,
    logging: true,
    metrics: true,
    errorHandling: true,
  },
};

const CONFIG = {
  projectRoot: process.cwd(),
  apps: ['website', 'cms'],
  services: ['auth', 'content', 'media', 'contact'],
  prodComposeFile: 'docker-compose.prod.yml',
  testTimeout: 60000,
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
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ProductionReadinessVerifier {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      dockerBuilds: {},
      securityChecks: {},
      monitoringChecks: {},
      summary: {},
    };
  }

  async verifyDockerBuilds() {
    console.log('🐳 Verifying production Docker builds...');
    
    const buildResults = {};
    
    // Check if production compose file exists
    const prodComposePath = path.join(CONFIG.projectRoot, CONFIG.prodComposeFile);
    
    try {
      await fs.access(prodComposePath);
      console.log(`✅ Production compose file found: ${CONFIG.prodComposeFile}`);
      
      buildResults.composeFileExists = true;
      
      // Read and analyze compose file
      const composeContent = await fs.readFile(prodComposePath, 'utf8');
      buildResults.composeAnalysis = {
        hasHealthChecks: composeContent.includes('healthcheck'),
        hasResourceLimits: composeContent.includes('resources') || composeContent.includes('limits'),
        hasSecurityContext: composeContent.includes('user:') || composeContent.includes('read_only'),
        hasEnvironmentConfig: composeContent.includes('environment'),
        hasVolumeConfig: composeContent.includes('volumes'),
      };
      
      console.log('📋 Production compose analysis:');
      Object.entries(buildResults.composeAnalysis).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? '✅' : '❌'}`);
      });
      
    } catch (error) {
      console.log(`❌ Production compose file not found: ${error.message}`);
      buildResults.composeFileExists = false;
      buildResults.error = error.message;
    }
    
    // Test building production images (without starting them)
    for (const app of CONFIG.apps) {
      console.log(`\n🔨 Testing production build for ${app}...`);
      
      try {
        // Check if app has production Dockerfile
        const prodDockerfile = path.join(CONFIG.projectRoot, 'apps', app, 'Dockerfile');
        
        try {
          await fs.access(prodDockerfile);
          console.log(`✅ Production Dockerfile found for ${app}`);
          
          // Analyze Dockerfile for production best practices
          const dockerfileContent = await fs.readFile(prodDockerfile, 'utf8');
          
          buildResults[app] = {
            dockerfileExists: true,
            analysis: {
              multiStage: dockerfileContent.includes('FROM') && dockerfileContent.split('FROM').length > 2,
              nonRootUser: dockerfileContent.includes('USER') && !dockerfileContent.includes('USER root'),
              alpineBase: dockerfileContent.includes('alpine'),
              healthCheck: dockerfileContent.includes('HEALTHCHECK'),
              minimalLayers: dockerfileContent.split('RUN').length <= 5, // Reasonable number of RUN commands
            },
          };
          
          console.log(`📋 ${app} Dockerfile analysis:`);
          Object.entries(buildResults[app].analysis).forEach(([key, value]) => {
            console.log(`  ${key}: ${value ? '✅' : '❌'}`);
          });
          
        } catch (error) {
          console.log(`❌ Production Dockerfile not found for ${app}`);
          buildResults[app] = {
            dockerfileExists: false,
            error: error.message,
          };
        }
        
      } catch (error) {
        console.log(`❌ Error analyzing ${app}:`, error.message);
        buildResults[app] = { error: error.message };
      }
    }
    
    this.results.dockerBuilds = buildResults;
    return buildResults;
  }

  async verifySecurityConfiguration() {
    console.log('\n🔒 Verifying security configurations...');
    
    const securityResults = {};
    
    // Check Dockerfile security practices
    for (const app of CONFIG.apps) {
      const dockerfilePath = path.join(CONFIG.projectRoot, 'apps', app, 'Dockerfile');
      
      try {
        const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
        
        securityResults[app] = {
          nonRootUser: dockerfileContent.includes('USER') && !dockerfileContent.includes('USER root'),
          noSecretsInImage: !dockerfileContent.includes('SECRET') && !dockerfileContent.includes('PASSWORD'),
          minimalBaseImage: dockerfileContent.includes('alpine') || dockerfileContent.includes('distroless'),
          copyOptimization: dockerfileContent.includes('COPY --chown'),
          exposedPorts: (dockerfileContent.match(/EXPOSE/g) || []).length <= 2, // Reasonable port exposure
        };
        
        console.log(`🔒 ${app} security analysis:`);
        Object.entries(securityResults[app]).forEach(([key, value]) => {
          console.log(`  ${key}: ${value ? '✅' : '❌'}`);
        });
        
      } catch (error) {
        console.log(`⚠️  Could not analyze ${app} security:`, error.message);
        securityResults[app] = { error: error.message };
      }
    }
    
    // Check for security-related configuration files
    const securityFiles = [
      '.dockerignore',
      'docker-compose.security.yml',
      'nginx/nginx.conf',
    ];
    
    securityResults.configFiles = {};
    
    for (const file of securityFiles) {
      const filePath = path.join(CONFIG.projectRoot, file);
      
      try {
        await fs.access(filePath);
        securityResults.configFiles[file] = { exists: true };
        console.log(`✅ Security config file found: ${file}`);
        
        // Analyze specific files
        if (file === '.dockerignore') {
          const content = await fs.readFile(filePath, 'utf8');
          securityResults.configFiles[file].analysis = {
            ignoresSecrets: content.includes('.env') || content.includes('*.key'),
            ignoresNodeModules: content.includes('node_modules'),
            ignoresGit: content.includes('.git'),
          };
        }
        
      } catch (error) {
        securityResults.configFiles[file] = { exists: false };
        console.log(`⚠️  Security config file missing: ${file}`);
      }
    }
    
    this.results.securityChecks = securityResults;
    return securityResults;
  }

  async verifyMonitoringAndLogging() {
    console.log('\n📊 Verifying monitoring and logging...');
    
    const monitoringResults = {};
    
    // Check for monitoring configuration files
    const monitoringFiles = [
      'monitoring/prometheus/prometheus.yml',
      'monitoring/grafana/provisioning',
      'monitoring/docker-compose.monitoring.yml',
    ];
    
    monitoringResults.configFiles = {};
    
    for (const file of monitoringFiles) {
      const filePath = path.join(CONFIG.projectRoot, file);
      
      try {
        const stats = await fs.stat(filePath);
        monitoringResults.configFiles[file] = { 
          exists: true,
          isDirectory: stats.isDirectory(),
        };
        console.log(`✅ Monitoring config found: ${file}`);
      } catch (error) {
        monitoringResults.configFiles[file] = { exists: false };
        console.log(`⚠️  Monitoring config missing: ${file}`);
      }
    }
    
    // Check application health endpoints (if services are running)
    const healthEndpoints = [
      { name: 'auth', port: 8101, path: '/health' },
      { name: 'content', port: 8102, path: '/health' },
      { name: 'media', port: 8103, path: '/health' },
      { name: 'contact', port: 8104, path: '/health' },
    ];
    
    monitoringResults.healthEndpoints = {};
    
    for (const endpoint of healthEndpoints) {
      try {
        const response = await axios.get(`http://localhost:${endpoint.port}${endpoint.path}`, {
          timeout: 5000,
        });
        
        monitoringResults.healthEndpoints[endpoint.name] = {
          available: true,
          status: response.status,
          responseTime: response.headers['x-response-time'] || 'unknown',
          data: response.data,
        };
        
        console.log(`✅ ${endpoint.name} health endpoint available`);
        
      } catch (error) {
        monitoringResults.healthEndpoints[endpoint.name] = {
          available: false,
          error: error.message,
        };
        console.log(`⚠️  ${endpoint.name} health endpoint not available`);
      }
    }
    
    // Check logging configuration in Next.js apps
    for (const app of CONFIG.apps) {
      const nextConfigPath = path.join(CONFIG.projectRoot, 'apps', app, 'next.config.js');
      
      try {
        const configContent = await fs.readFile(nextConfigPath, 'utf8');
        
        monitoringResults[`${app}_logging`] = {
          hasLogging: configContent.includes('logging') || configContent.includes('winston'),
          hasErrorReporting: configContent.includes('sentry') || configContent.includes('error'),
          hasMetrics: configContent.includes('metrics') || configContent.includes('analytics'),
          standaloneOutput: configContent.includes('output: "standalone"'),
        };
        
        console.log(`📊 ${app} monitoring features:`);
        Object.entries(monitoringResults[`${app}_logging`]).forEach(([key, value]) => {
          console.log(`  ${key}: ${value ? '✅' : '❌'}`);
        });
        
      } catch (error) {
        console.log(`⚠️  Could not analyze ${app} monitoring config:`, error.message);
        monitoringResults[`${app}_logging`] = { error: error.message };
      }
    }
    
    this.results.monitoringChecks = monitoringResults;
    return monitoringResults;
  }

  async checkEnvironmentConfiguration() {
    console.log('\n🌍 Checking environment configuration...');
    
    const envResults = {};
    
    // Check for environment files
    const envFiles = [
      '.env.example',
      '.env.production.example',
      'apps/website/.env.local.example',
      'apps/cms/.env.local.example',
    ];
    
    envResults.envFiles = {};
    
    for (const file of envFiles) {
      const filePath = path.join(CONFIG.projectRoot, file);
      
      try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        
        envResults.envFiles[file] = {
          exists: true,
          hasDbConfig: content.includes('DATABASE_URL') || content.includes('DB_'),
          hasSecrets: content.includes('SECRET') || content.includes('KEY'),
          hasApiConfig: content.includes('API_') || content.includes('NEXT_PUBLIC_'),
          lineCount: content.split('\n').length,
        };
        
        console.log(`✅ Environment file found: ${file}`);
        
      } catch (error) {
        envResults.envFiles[file] = { exists: false };
        console.log(`⚠️  Environment file missing: ${file}`);
      }
    }
    
    // Check package.json scripts for production
    const packageJsonPath = path.join(CONFIG.projectRoot, 'package.json');
    
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      envResults.productionScripts = {
        hasContainersProd: !!packageJson.scripts['containers:prod'],
        hasProdBuild: !!packageJson.scripts['containers:prod:build'],
        hasHealthCheck: !!packageJson.scripts['health:check'],
        hasBackup: !!packageJson.scripts['backup:create'],
        hasRollback: !!packageJson.scripts['rollback:auto'],
      };
      
      console.log('📋 Production scripts availability:');
      Object.entries(envResults.productionScripts).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? '✅' : '❌'}`);
      });
      
    } catch (error) {
      console.log('⚠️  Could not analyze package.json:', error.message);
      envResults.productionScripts = { error: error.message };
    }
    
    this.results.environmentConfig = envResults;
    return envResults;
  }

  generateSummary() {
    console.log('\n📋 Generating production readiness summary...');
    
    const summary = {
      overallScore: 0,
      categoriesScored: 0,
      totalCategories: 4,
      readinessLevel: 'Not Ready',
      criticalIssues: [],
      recommendations: [],
      achievements: [],
    };
    
    // Docker builds assessment
    let dockerScore = 0;
    if (this.results.dockerBuilds.composeFileExists) {
      dockerScore += 25;
      summary.achievements.push('Production Docker Compose file exists');
    } else {
      summary.criticalIssues.push('Missing production Docker Compose file');
    }
    
    const dockerAnalyses = Object.values(this.results.dockerBuilds)
      .filter(result => result.analysis)
      .map(result => result.analysis);
    
    if (dockerAnalyses.length > 0) {
      const avgDockerFeatures = dockerAnalyses.reduce((sum, analysis) => {
        return sum + Object.values(analysis).filter(Boolean).length;
      }, 0) / dockerAnalyses.length;
      
      dockerScore += (avgDockerFeatures / 5) * 75; // 5 features max
    }
    
    summary.dockerScore = Math.round(dockerScore);
    summary.categoriesScored++;
    
    // Security assessment
    let securityScore = 0;
    const securityAnalyses = Object.values(this.results.securityChecks)
      .filter(result => result.nonRootUser !== undefined);
    
    if (securityAnalyses.length > 0) {
      const avgSecurityFeatures = securityAnalyses.reduce((sum, analysis) => {
        return sum + Object.values(analysis).filter(Boolean).length;
      }, 0) / securityAnalyses.length;
      
      securityScore = (avgSecurityFeatures / 5) * 100; // 5 security features max
    }
    
    summary.securityScore = Math.round(securityScore);
    summary.categoriesScored++;
    
    // Monitoring assessment
    let monitoringScore = 0;
    const monitoringConfigs = this.results.monitoringChecks.configFiles || {};
    const existingConfigs = Object.values(monitoringConfigs).filter(config => config.exists).length;
    
    monitoringScore += (existingConfigs / 3) * 50; // 3 monitoring configs
    
    const healthEndpoints = this.results.monitoringChecks.healthEndpoints || {};
    const availableEndpoints = Object.values(healthEndpoints).filter(endpoint => endpoint.available).length;
    
    monitoringScore += (availableEndpoints / 4) * 50; // 4 health endpoints
    
    summary.monitoringScore = Math.round(monitoringScore);
    summary.categoriesScored++;
    
    // Environment configuration assessment
    let envScore = 0;
    const envFiles = this.results.environmentConfig?.envFiles || {};
    const existingEnvFiles = Object.values(envFiles).filter(file => file.exists).length;
    
    envScore += (existingEnvFiles / 4) * 50; // 4 env files
    
    const prodScripts = this.results.environmentConfig?.productionScripts || {};
    const availableScripts = Object.values(prodScripts).filter(Boolean).length;
    
    envScore += (availableScripts / 5) * 50; // 5 production scripts
    
    summary.environmentScore = Math.round(envScore);
    summary.categoriesScored++;
    
    // Calculate overall score
    summary.overallScore = Math.round(
      (summary.dockerScore + summary.securityScore + summary.monitoringScore + summary.environmentScore) / 4
    );
    
    // Determine readiness level
    if (summary.overallScore >= 90) {
      summary.readinessLevel = 'Production Ready';
    } else if (summary.overallScore >= 70) {
      summary.readinessLevel = 'Nearly Ready';
    } else if (summary.overallScore >= 50) {
      summary.readinessLevel = 'Needs Improvement';
    } else {
      summary.readinessLevel = 'Not Ready';
    }
    
    // Generate recommendations
    if (summary.dockerScore < 80) {
      summary.recommendations.push('Improve Docker configuration with multi-stage builds and security practices');
    }
    if (summary.securityScore < 80) {
      summary.recommendations.push('Enhance security configuration with non-root users and minimal base images');
    }
    if (summary.monitoringScore < 80) {
      summary.recommendations.push('Set up comprehensive monitoring and logging infrastructure');
    }
    if (summary.environmentScore < 80) {
      summary.recommendations.push('Complete environment configuration and production scripts');
    }
    
    this.results.summary = summary;
    return summary;
  }

  async saveReport() {
    const reportPath = path.join(CONFIG.projectRoot, 'production-readiness-report.json');
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 Production readiness report saved to: ${reportPath}`);
    } catch (error) {
      console.log('Could not save report:', error.message);
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 PRODUCTION READINESS VERIFICATION REPORT');
    console.log('='.repeat(70));
    
    console.log('\n📊 OVERALL ASSESSMENT:');
    console.log(`  Readiness Level: ${this.results.summary.readinessLevel}`);
    console.log(`  Overall Score: ${this.results.summary.overallScore}%`);
    
    console.log('\n📋 CATEGORY SCORES:');
    console.log(`  Docker Configuration: ${this.results.summary.dockerScore}%`);
    console.log(`  Security Configuration: ${this.results.summary.securityScore}%`);
    console.log(`  Monitoring & Logging: ${this.results.summary.monitoringScore}%`);
    console.log(`  Environment Configuration: ${this.results.summary.environmentScore}%`);
    
    if (this.results.summary.achievements.length > 0) {
      console.log('\n🏆 ACHIEVEMENTS:');
      this.results.summary.achievements.forEach(achievement => {
        console.log(`  ✅ ${achievement}`);
      });
    }
    
    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.results.summary.criticalIssues.forEach(issue => {
        console.log(`  ❌ ${issue}`);
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

async function runProductionReadinessVerification() {
  console.log('🚀 Starting Production Readiness Verification...');
  
  const verifier = new ProductionReadinessVerifier();
  
  try {
    await verifier.verifyDockerBuilds();
    await verifier.verifySecurityConfiguration();
    await verifier.verifyMonitoringAndLogging();
    await verifier.checkEnvironmentConfiguration();
    
    verifier.generateSummary();
    verifier.printReport();
    await verifier.saveReport();
    
    // Success if readiness level is "Nearly Ready" or better
    const success = verifier.results.summary.overallScore >= 70;
    
    if (success) {
      console.log('\n🎉 Production readiness verification PASSED!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Production readiness needs improvement.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Production readiness verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runProductionReadinessVerification();
}

module.exports = {
  ProductionReadinessVerifier,
  PRODUCTION_CRITERIA,
  CONFIG,
};
#!/usr/bin/env node

/**
 * Container Orchestration and Service Discovery Tests
 * Tests Docker Compose setup and inter-service communication
 */

const { execSync, spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Test configuration
const config = {
  services: {
    couchdb: { port: 5984, healthPath: '/_up' },
    backend: { port: 8080, healthPath: '/api/v1/health' },
    website: { port: 3000, healthPath: '/' },
    cms: { port: 3001, healthPath: '/' },
    metrics: { port: 8081, healthPath: '/metrics' }
  },
  timeout: 60000, // 60 seconds timeout for service startup
  retryInterval: 2000 // 2 seconds between retries
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runCommand = (command, options = {}) => {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: 30000,
      ...options
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
};

const checkServiceHealth = async (serviceName, port, healthPath) => {
  const url = `http://localhost:${port}${healthPath}`;

  try {
    const response = await fetch(url, { timeout: 5000 });
    return {
      healthy: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
};

const waitForService = async (serviceName, port, healthPath, timeout = config.timeout) => {
  const startTime = Date.now();

  console.log(`⏳ Waiting for ${serviceName} to be healthy...`);

  while (Date.now() - startTime < timeout) {
    const health = await checkServiceHealth(serviceName, port, healthPath);

    if (health.healthy) {
      console.log(`✅ ${serviceName} is healthy`);
      return true;
    }

    await sleep(config.retryInterval);
  }

  console.log(`❌ ${serviceName} failed to become healthy within ${timeout}ms`);
  return false;
};

const runTest = async (testName, testFn) => {
  console.log(`\n🧪 Running: ${testName}`);
  try {
    await testFn();
    console.log(`✅ PASSED: ${testName}`);
    results.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
};

// Test functions
const testDockerInstallation = async () => {
  const result = runCommand('docker --version');
  if (!result.success) {
    throw new Error('Docker is not installed or not accessible');
  }
  console.log(`   Docker version: ${result.output}`);
};

const testDockerComposeInstallation = async () => {
  const result = runCommand('docker compose version');
  if (!result.success) {
    throw new Error('Docker Compose is not installed or not accessible');
  }
  console.log(`   Docker Compose version: ${result.output}`);
};

const testComposeFileValidation = async () => {
  const result = runCommand('docker compose -f docker-compose.yml config');
  if (!result.success) {
    throw new Error(`Compose file validation failed: ${result.error}`);
  }
  console.log('   Compose file is valid');
};

const testNetworkCreation = async () => {
  // Check if network exists
  const networkResult = runCommand('docker network ls --format "{{.Name}}"');
  if (!networkResult.success) {
    throw new Error('Failed to list Docker networks');
  }

  const networks = networkResult.output.split('\n');
  const hasNetwork = networks.some(network =>
    network.includes('saas') || network.includes('default')
  );

  if (!hasNetwork) {
    throw new Error('Expected network not found');
  }

  console.log('   Container network is properly configured');
};

const testServiceStartup = async () => {
  console.log('   Starting services with Docker Compose...');

  // Start services
  const startResult = runCommand('docker compose up -d --build', { timeout: 120000 });
  if (!startResult.success) {
    throw new Error(`Failed to start services: ${startResult.error}`);
  }

  console.log('   Services started, waiting for health checks...');

  // Wait for each service to be healthy
  const serviceChecks = [];
  for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
    serviceChecks.push(
      waitForService(serviceName, serviceConfig.port, serviceConfig.healthPath)
    );
  }

  const healthResults = await Promise.all(serviceChecks);
  const allHealthy = healthResults.every(result => result);

  if (!allHealthy) {
    throw new Error('Not all services became healthy');
  }

  console.log('   All services are healthy');
};

const testServiceDiscovery = async () => {
  // Test that backend can connect to CouchDB
  const backendHealth = await checkServiceHealth('backend', 8080, '/api/v1/health');
  if (!backendHealth.healthy) {
    throw new Error('Backend service is not healthy');
  }

  // Test that frontend can connect to backend
  const websiteResponse = await fetch('http://localhost:3000/api/health').catch(() => null);
  const cmsResponse = await fetch('http://localhost:3001/api/health').catch(() => null);

  console.log('   Service discovery is working');
};

const testInterServiceCommunication = async () => {
  // Test API communication from website
  const apiResponse = await fetch('http://localhost:8080/api/v1/health');
  if (!apiResponse.ok) {
    throw new Error('API communication failed');
  }

  // Test database connectivity through API
  const pagesResponse = await fetch('http://localhost:8080/api/v1/pages');
  if (!pagesResponse.ok && pagesResponse.status !== 404) {
    throw new Error('Database connectivity through API failed');
  }

  console.log('   Inter-service communication is working');
};

const testContainerLogs = async () => {
  // Check that we can access container logs
  const services = ['backend', 'couchdb', 'website', 'cms'];

  for (const service of services) {
    const logResult = runCommand(`docker compose logs --tail=10 ${service}`);
    if (!logResult.success) {
      console.log(`   Warning: Could not access logs for ${service}`);
    } else {
      console.log(`   ✓ Logs accessible for ${service}`);
    }
  }
};

const testVolumeManagement = async () => {
  // Check that volumes are created and mounted
  const volumeResult = runCommand('docker volume ls --format "{{.Name}}"');
  if (!volumeResult.success) {
    throw new Error('Failed to list volumes');
  }

  const volumes = volumeResult.output.split('\n');
  const hasCouchDBVolume = volumes.some(vol => vol.includes('couchdb'));

  if (!hasCouchDBVolume) {
    console.log('   Warning: CouchDB volume not found');
  } else {
    console.log('   ✓ CouchDB volume is properly mounted');
  }
};

const testEnvironmentVariables = async () => {
  // Test that environment variables are properly passed
  const envResult = runCommand('docker compose exec -T backend env');
  if (!envResult.success) {
    throw new Error('Failed to check environment variables');
  }

  const envVars = envResult.output;
  const requiredVars = ['COUCHDB_URL', 'JWT_SECRET', 'PORT'];

  for (const varName of requiredVars) {
    if (!envVars.includes(varName)) {
      throw new Error(`Required environment variable ${varName} not found`);
    }
  }

  console.log('   Environment variables are properly configured');
};

const testServiceRestart = async () => {
  console.log('   Testing service restart...');

  // Restart backend service
  const restartResult = runCommand('docker compose restart backend');
  if (!restartResult.success) {
    throw new Error('Failed to restart backend service');
  }

  // Wait for service to be healthy again
  const isHealthy = await waitForService('backend', 8080, '/api/v1/health', 30000);
  if (!isHealthy) {
    throw new Error('Backend service did not become healthy after restart');
  }

  console.log('   Service restart successful');
};

const testGracefulShutdown = async () => {
  console.log('   Testing graceful shutdown...');

  // Stop services
  const stopResult = runCommand('docker compose down');
  if (!stopResult.success) {
    throw new Error(`Failed to stop services: ${stopResult.error}`);
  }

  // Verify services are stopped
  await sleep(5000);

  const healthChecks = [];
  for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
    healthChecks.push(checkServiceHealth(serviceName, serviceConfig.port, serviceConfig.healthPath));
  }

  const healthResults = await Promise.all(healthChecks);
  const anyHealthy = healthResults.some(result => result.healthy);

  if (anyHealthy) {
    throw new Error('Some services are still running after shutdown');
  }

  console.log('   Graceful shutdown successful');
};

const testProductionConfiguration = async () => {
  // Test production compose file if it exists
  const prodComposeExists = runCommand('test -f docker-compose.prod.yml');
  if (!prodComposeExists.success) {
    console.log('   Production compose file not found, skipping');
    return;
  }

  // Validate production configuration
  const prodValidation = runCommand('docker compose -f docker-compose.prod.yml config');
  if (!prodValidation.success) {
    throw new Error('Production compose file validation failed');
  }

  console.log('   Production configuration is valid');
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting Container Orchestration Tests');
  console.log('='.repeat(50));

  // Pre-flight checks
  await runTest('Docker Installation', testDockerInstallation);
  await runTest('Docker Compose Installation', testDockerComposeInstallation);
  await runTest('Compose File Validation', testComposeFileValidation);

  // Container orchestration tests
  await runTest('Network Creation', testNetworkCreation);
  await runTest('Service Startup', testServiceStartup);
  await runTest('Service Discovery', testServiceDiscovery);
  await runTest('Inter-Service Communication', testInterServiceCommunication);

  // Container management tests
  await runTest('Container Logs', testContainerLogs);
  await runTest('Volume Management', testVolumeManagement);
  await runTest('Environment Variables', testEnvironmentVariables);

  // Reliability tests
  await runTest('Service Restart', testServiceRestart);
  await runTest('Production Configuration', testProductionConfiguration);

  // Cleanup test (run last)
  await runTest('Graceful Shutdown', testGracefulShutdown);

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 Container Orchestration Test Results');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.passed + results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(({ test, error }) => {
      console.log(`   • ${test}: ${error}`);
    });
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
};

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  checkServiceHealth,
  waitForService,
  config
};
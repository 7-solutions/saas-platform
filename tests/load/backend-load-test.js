#!/usr/bin/env node

/**
 * Backend Load Testing Script
 * Tests backend services under various load conditions
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const API_VERSION = 'v1';

// Load test configuration
const config = {
  baseURL: `${BASE_URL}/api/${API_VERSION}`,
  tests: {
    light: { concurrent: 5, requests: 50, duration: 30000 },
    medium: { concurrent: 20, requests: 200, duration: 60000 },
    heavy: { concurrent: 50, requests: 500, duration: 120000 }
  },
  timeout: 10000
};

// Test results tracking
const results = {
  requests: 0,
  successes: 0,
  failures: 0,
  timeouts: 0,
  responseTimes: [],
  errors: [],
  startTime: 0,
  endTime: 0
};

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (endpoint, options = {}) => {
  const url = `${config.baseURL}${endpoint}`;
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, {
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    results.requests++;
    results.responseTimes.push(responseTime);
    
    if (response.ok) {
      results.successes++;
    } else {
      results.failures++;
      results.errors.push({
        endpoint,
        status: response.status,
        statusText: response.statusText,
        responseTime
      });
    }
    
    return {
      status: response.status,
      responseTime,
      ok: response.ok
    };
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    results.requests++;
    results.responseTimes.push(responseTime);
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      results.timeouts++;
    } else {
      results.failures++;
    }
    
    results.errors.push({
      endpoint,
      error: error.message,
      responseTime
    });
    
    return {
      status: 0,
      responseTime,
      ok: false,
      error: error.message
    };
  }
};

// Test scenarios
const testScenarios = {
  healthCheck: () => makeRequest('/health'),
  
  contactFormSubmission: () => makeRequest('/contact', {
    method: 'POST',
    body: JSON.stringify({
      name: `Load Test User ${Math.random()}`,
      email: `loadtest${Math.random()}@example.com`,
      company: 'Load Test Company',
      message: 'This is a load test message.'
    })
  }),
  
  listPages: () => makeRequest('/pages'),
  
  listBlogPosts: () => makeRequest('/blog'),
  
  getBlogCategories: () => makeRequest('/blog/categories'),
  
  getBlogTags: () => makeRequest('/blog/tags'),
  
  getRSSFeed: () => makeRequest('/blog/rss'),
  
  listMedia: () => makeRequest('/media'),
  
  authLogin: () => makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'loadtest@example.com',
      password: 'wrongpassword'
    })
  })
};

// Load test runner
const runLoadTest = async (testName, scenario, concurrent, totalRequests, duration) => {
  console.log(`\n🚀 Starting ${testName} load test`);
  console.log(`   Concurrent users: ${concurrent}`);
  console.log(`   Total requests: ${totalRequests}`);
  console.log(`   Duration: ${duration / 1000}s`);
  console.log('   ' + '-'.repeat(40));
  
  // Reset results
  Object.assign(results, {
    requests: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    responseTimes: [],
    errors: [],
    startTime: performance.now()
  });
  
  const workers = [];
  const requestsPerWorker = Math.ceil(totalRequests / concurrent);
  const endTime = Date.now() + duration;
  
  // Start concurrent workers
  for (let i = 0; i < concurrent; i++) {
    workers.push(runWorker(scenario, requestsPerWorker, endTime));
  }
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  results.endTime = performance.now();
  
  // Calculate statistics
  const totalTime = results.endTime - results.startTime;
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const minResponseTime = Math.min(...results.responseTimes);
  const maxResponseTime = Math.max(...results.responseTimes);
  const requestsPerSecond = (results.requests / totalTime) * 1000;
  
  // Calculate percentiles
  const sortedTimes = results.responseTimes.sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  
  // Print results
  console.log('\n📊 Load Test Results:');
  console.log(`   Total Requests: ${results.requests}`);
  console.log(`   Successful: ${results.successes} (${((results.successes / results.requests) * 100).toFixed(2)}%)`);
  console.log(`   Failed: ${results.failures} (${((results.failures / results.requests) * 100).toFixed(2)}%)`);
  console.log(`   Timeouts: ${results.timeouts} (${((results.timeouts / results.requests) * 100).toFixed(2)}%)`);
  console.log(`   Requests/sec: ${requestsPerSecond.toFixed(2)}`);
  console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   Min Response Time: ${minResponseTime.toFixed(2)}ms`);
  console.log(`   Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
  console.log(`   50th Percentile: ${p50.toFixed(2)}ms`);
  console.log(`   90th Percentile: ${p90.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${p95.toFixed(2)}ms`);
  console.log(`   99th Percentile: ${p99.toFixed(2)}ms`);
  
  // Show errors if any
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    const errorCounts = {};
    results.errors.forEach(error => {
      const key = error.status || error.error || 'Unknown';
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   ${error}: ${count} occurrences`);
    });
  }
  
  return {
    requests: results.requests,
    successes: results.successes,
    failures: results.failures,
    timeouts: results.timeouts,
    avgResponseTime,
    requestsPerSecond,
    p95
  };
};

const runWorker = async (scenario, maxRequests, endTime) => {
  let requestCount = 0;
  
  while (requestCount < maxRequests && Date.now() < endTime) {
    await scenario();
    requestCount++;
    
    // Small delay to prevent overwhelming the server
    await sleep(Math.random() * 10);
  }
};

// Stress test specific endpoints
const runStressTest = async () => {
  console.log('\n🔥 Running Stress Tests');
  console.log('=' .repeat(50));
  
  const stressResults = {};
  
  // Test each endpoint under stress
  for (const [name, scenario] of Object.entries(testScenarios)) {
    console.log(`\n🎯 Stress testing: ${name}`);
    
    try {
      const result = await runLoadTest(
        `${name} stress`,
        scenario,
        30, // 30 concurrent users
        300, // 300 total requests
        60000 // 60 seconds
      );
      
      stressResults[name] = result;
      
      // Brief pause between tests
      await sleep(2000);
    } catch (error) {
      console.log(`❌ Stress test failed for ${name}: ${error.message}`);
      stressResults[name] = { error: error.message };
    }
  }
  
  return stressResults;
};

// Memory and resource monitoring
const monitorResources = async (duration) => {
  console.log('\n📈 Monitoring backend resources...');
  
  const startTime = Date.now();
  const endTime = startTime + duration;
  const measurements = [];
  
  while (Date.now() < endTime) {
    try {
      // Try to get health/metrics endpoint
      const healthResponse = await makeRequest('/health');
      const metricsResponse = await fetch(`${BASE_URL}:8081/metrics`).catch(() => null);
      
      measurements.push({
        timestamp: Date.now(),
        health: healthResponse.ok,
        responseTime: healthResponse.responseTime,
        metrics: metricsResponse ? await metricsResponse.text().catch(() => null) : null
      });
    } catch (error) {
      measurements.push({
        timestamp: Date.now(),
        error: error.message
      });
    }
    
    await sleep(5000); // Check every 5 seconds
  }
  
  // Analyze measurements
  const healthyCount = measurements.filter(m => m.health).length;
  const avgResponseTime = measurements
    .filter(m => m.responseTime)
    .reduce((sum, m) => sum + m.responseTime, 0) / measurements.length;
  
  console.log(`   Health checks: ${healthyCount}/${measurements.length} successful`);
  console.log(`   Avg health response time: ${avgResponseTime.toFixed(2)}ms`);
  
  return measurements;
};

// Main test runner
const runAllLoadTests = async () => {
  console.log('🚀 Starting Backend Load Testing Suite');
  console.log(`📍 Target: ${config.baseURL}`);
  console.log('=' .repeat(50));
  
  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await sleep(3000);
  
  try {
    // 1. Light load test
    console.log('\n1️⃣ Light Load Test');
    await runLoadTest(
      'Light Load',
      testScenarios.healthCheck,
      config.tests.light.concurrent,
      config.tests.light.requests,
      config.tests.light.duration
    );
    
    await sleep(5000);
    
    // 2. Medium load test
    console.log('\n2️⃣ Medium Load Test');
    await runLoadTest(
      'Medium Load',
      testScenarios.contactFormSubmission,
      config.tests.medium.concurrent,
      config.tests.medium.requests,
      config.tests.medium.duration
    );
    
    await sleep(5000);
    
    // 3. Heavy load test
    console.log('\n3️⃣ Heavy Load Test');
    await runLoadTest(
      'Heavy Load',
      testScenarios.listPages,
      config.tests.heavy.concurrent,
      config.tests.heavy.requests,
      config.tests.heavy.duration
    );
    
    await sleep(5000);
    
    // 4. Stress test all endpoints
    const stressResults = await runStressTest();
    
    // 5. Resource monitoring during load
    console.log('\n5️⃣ Resource Monitoring Test');
    const resourceData = await monitorResources(30000); // 30 seconds
    
    // Final summary
    console.log('\n' + '=' .repeat(50));
    console.log('📋 Load Testing Summary');
    console.log('=' .repeat(50));
    
    console.log('\n🎯 Stress Test Results:');
    Object.entries(stressResults).forEach(([endpoint, result]) => {
      if (result.error) {
        console.log(`   ❌ ${endpoint}: ${result.error}`);
      } else {
        console.log(`   ✅ ${endpoint}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.p95.toFixed(2)}ms p95`);
      }
    });
    
    console.log('\n✅ Load testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Load testing failed:', error);
    process.exit(1);
  }
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
  runAllLoadTests();
}

module.exports = {
  runAllLoadTests,
  runLoadTest,
  testScenarios,
  config
};
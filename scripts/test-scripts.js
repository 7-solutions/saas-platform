#!/usr/bin/env node

/**
 * Test script to verify database scripts functionality
 * This script tests the database scripts without requiring a running CouchDB instance
 */

const fs = require('fs');
const path = require('path');

function testScriptExists(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const exists = fs.existsSync(scriptPath);
  console.log(`${exists ? '✅' : '❌'} ${scriptName} ${exists ? 'exists' : 'missing'}`);
  return exists;
}

function testScriptExecutable(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  try {
    const stats = fs.statSync(scriptPath);
    const isExecutable = !!(stats.mode & parseInt('111', 8));
    console.log(`${isExecutable ? '✅' : '❌'} ${scriptName} ${isExecutable ? 'is executable' : 'not executable'}`);
    return isExecutable;
  } catch (error) {
    console.log(`❌ ${scriptName} cannot check permissions: ${error.message}`);
    return false;
  }
}

function testScriptSyntax(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const { execSync } = require('child_process');
  
  try {
    // Use node -c to check syntax without executing
    execSync(`node -c "${scriptPath}"`, { stdio: 'pipe' });
    console.log(`✅ ${scriptName} has valid syntax`);
    return true;
  } catch (error) {
    console.log(`❌ ${scriptName} has syntax errors: ${error.message}`);
    return false;
  }
}

function testConfigFiles() {
  const configPath = path.join(__dirname, 'couchdb', 'local.ini');
  const exists = fs.existsSync(configPath);
  console.log(`${exists ? '✅' : '❌'} CouchDB config ${exists ? 'exists' : 'missing'}`);
  
  if (exists) {
    const content = fs.readFileSync(configPath, 'utf8');
    const hasAdminConfig = content.includes('[admins]');
    const hasCorsConfig = content.includes('[cors]');
    console.log(`${hasAdminConfig ? '✅' : '❌'} CouchDB config has admin section`);
    console.log(`${hasCorsConfig ? '✅' : '❌'} CouchDB config has CORS section`);
  }
  
  return exists;
}

function runTests() {
  console.log('🧪 Testing database scripts...\n');

  const scripts = [
    'init-db.js',
    'reset-db.js',
    'seed-db.js',
    'migrate-db.js',
    'init-test-db.js'
  ];

  let allPassed = true;

  console.log('📁 File existence tests:');
  for (const script of scripts) {
    if (!testScriptExists(script)) {
      allPassed = false;
    }
  }

  console.log('\n🔐 Executable permissions tests:');
  for (const script of scripts) {
    if (!testScriptExecutable(script)) {
      allPassed = false;
    }
  }

  console.log('\n📝 Syntax validation tests:');
  for (const script of scripts) {
    if (!testScriptSyntax(script)) {
      allPassed = false;
    }
  }

  console.log('\n⚙️  Configuration tests:');
  if (!testConfigFiles()) {
    allPassed = false;
  }

  console.log('\n📋 Summary:');
  if (allPassed) {
    console.log('✅ All database scripts are properly configured and ready to use!');
    console.log('\nTo test with a running CouchDB instance:');
    console.log('1. Start containers: docker compose up -d couchdb');
    console.log('2. Initialize database: pnpm db:init');
    console.log('3. Seed database: pnpm db:seed');
  } else {
    console.log('❌ Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

runTests();
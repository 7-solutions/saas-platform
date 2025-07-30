#!/usr/bin/env node

/**
 * Database reset script
 * Drops and recreates the database with fresh design documents
 */

const http = require('http');

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'password';

const auth = Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, COUCHDB_URL);
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${result.reason || body}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function deleteDatabase(dbName) {
  try {
    await makeRequest('DELETE', `/${dbName}`);
    console.log(`✅ Database '${dbName}' deleted successfully`);
  } catch (error) {
    if (error.message.includes('not_found')) {
      console.log(`ℹ️  Database '${dbName}' does not exist`);
    } else {
      console.error(`❌ Failed to delete database '${dbName}':`, error.message);
      throw error;
    }
  }
}

async function resetDatabase() {
  console.log('🔄 Resetting CouchDB database...');

  try {
    // Delete existing database
    await deleteDatabase('saas_platform');

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Re-initialize database
    console.log('🚀 Re-initializing database...');
    require('./init-db.js');

  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }
}

// Run reset
resetDatabase();
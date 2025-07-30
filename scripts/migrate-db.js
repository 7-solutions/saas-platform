#!/usr/bin/env node

/**
 * Database migration utility
 * Handles schema changes and data migrations for CouchDB
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'password';
const DB_NAME = process.env.DB_NAME || 'saas_platform';

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

async function getMigrationStatus() {
  try {
    const result = await makeRequest('GET', `/${DB_NAME}/_design/migrations`);
    return result.migrations || {};
  } catch (error) {
    if (error.message.includes('not_found')) {
      // Create migrations design document
      const migrationDoc = {
        _id: '_design/migrations',
        migrations: {},
        views: {
          applied: {
            map: 'function(doc) { if(doc._id === "_design/migrations") { for(var key in doc.migrations) { emit(key, doc.migrations[key]); } } }'
          }
        }
      };
      await makeRequest('PUT', `/${DB_NAME}/_design/migrations`, migrationDoc);
      return {};
    }
    throw error;
  }
}

async function markMigrationApplied(migrationName) {
  try {
    const doc = await makeRequest('GET', `/${DB_NAME}/_design/migrations`);
    doc.migrations[migrationName] = {
      applied_at: new Date().toISOString(),
      status: 'completed'
    };
    await makeRequest('PUT', `/${DB_NAME}/_design/migrations`, doc);
    console.log(`✅ Migration '${migrationName}' marked as applied`);
  } catch (error) {
    console.error(`❌ Failed to mark migration '${migrationName}' as applied:`, error.message);
    throw error;
  }
}

// Migration definitions
const migrations = {
  '001_add_page_categories': {
    description: 'Add categories field to page documents',
    up: async () => {
      console.log('Adding categories field to existing pages...');
      
      // Get all page documents
      const result = await makeRequest('GET', `/${DB_NAME}/_design/pages/_view/by_status?include_docs=true`);
      
      for (const row of result.rows) {
        const doc = row.doc;
        if (!doc.categories) {
          doc.categories = [];
          await makeRequest('PUT', `/${DB_NAME}/${doc._id}`, doc);
          console.log(`Updated page: ${doc.title}`);
        }
      }
    }
  },

  '002_add_user_preferences': {
    description: 'Add preferences field to user documents',
    up: async () => {
      console.log('Adding preferences field to existing users...');
      
      // Get all user documents
      const result = await makeRequest('GET', `/${DB_NAME}/_design/users/_view/by_email?include_docs=true`);
      
      for (const row of result.rows) {
        const doc = row.doc;
        if (!doc.preferences) {
          doc.preferences = {
            theme: 'light',
            notifications: true,
            language: 'en'
          };
          await makeRequest('PUT', `/${DB_NAME}/${doc._id}`, doc);
          console.log(`Updated user: ${doc.email}`);
        }
      }
    }
  },

  '003_add_media_tags': {
    description: 'Add tags field to media documents',
    up: async () => {
      console.log('Adding tags field to existing media...');
      
      // Get all media documents
      const result = await makeRequest('GET', `/${DB_NAME}/_design/media/_view/by_date?include_docs=true`);
      
      for (const row of result.rows) {
        const doc = row.doc;
        if (!doc.tags) {
          doc.tags = [];
          await makeRequest('PUT', `/${DB_NAME}/${doc._id}`, doc);
          console.log(`Updated media: ${doc.filename}`);
        }
      }
    }
  }
};

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    const appliedMigrations = await getMigrationStatus();
    
    for (const [migrationName, migration] of Object.entries(migrations)) {
      if (appliedMigrations[migrationName]) {
        console.log(`⏭️  Skipping already applied migration: ${migrationName}`);
        continue;
      }

      console.log(`🚀 Running migration: ${migrationName}`);
      console.log(`   Description: ${migration.description}`);
      
      try {
        await migration.up();
        await markMigrationApplied(migrationName);
        console.log(`✅ Migration '${migrationName}' completed successfully`);
      } catch (error) {
        console.error(`❌ Migration '${migrationName}' failed:`, error.message);
        throw error;
      }
    }

    console.log('✅ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    process.exit(1);
  }
}

async function listMigrations() {
  console.log('📋 Available migrations:');
  
  const appliedMigrations = await getMigrationStatus();
  
  for (const [migrationName, migration] of Object.entries(migrations)) {
    const status = appliedMigrations[migrationName] ? '✅ Applied' : '⏳ Pending';
    console.log(`  ${migrationName}: ${migration.description} [${status}]`);
    if (appliedMigrations[migrationName]) {
      console.log(`    Applied at: ${appliedMigrations[migrationName].applied_at}`);
    }
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'run':
    runMigrations();
    break;
  case 'list':
    listMigrations();
    break;
  default:
    console.log('Usage: node migrate-db.js [run|list]');
    console.log('  run  - Run pending migrations');
    console.log('  list - List all migrations and their status');
    process.exit(1);
}
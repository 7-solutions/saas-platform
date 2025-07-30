#!/usr/bin/env node

/**
 * Database initialization script
 * Creates necessary databases and design documents in CouchDB
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

async function createDatabase(dbName) {
  try {
    await makeRequest('PUT', `/${dbName}`);
    console.log(`✅ Database '${dbName}' created successfully`);
  } catch (error) {
    if (error.message.includes('file_exists')) {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    } else {
      console.error(`❌ Failed to create database '${dbName}':`, error.message);
      throw error;
    }
  }
}

async function createDesignDocument(dbName, designDoc) {
  try {
    await makeRequest('PUT', `/${dbName}/_design/${designDoc.name}`, designDoc.doc);
    console.log(`✅ Design document '${designDoc.name}' created in '${dbName}'`);
  } catch (error) {
    if (error.message.includes('conflict')) {
      console.log(`ℹ️  Design document '${designDoc.name}' already exists in '${dbName}'`);
    } else {
      console.error(`❌ Failed to create design document '${designDoc.name}':`, error.message);
      throw error;
    }
  }
}

async function initializeDatabase() {
  console.log('🚀 Initializing CouchDB databases...');

  try {
    // Create main database
    await createDatabase('saas_platform');

    // Create design documents
    const designDocs = [
      {
        name: 'pages',
        doc: {
          views: {
            by_status: {
              map: 'function(doc) { if(doc.type === "page") { emit(doc.status, doc); } }'
            },
            by_slug: {
              map: 'function(doc) { if(doc.type === "page") { emit(doc.slug, doc); } }'
            },
            published: {
              map: 'function(doc) { if(doc.type === "page" && doc.status === "published") { emit(doc.updated_at, doc); } }'
            },
            by_created_date: {
              map: 'function(doc) { if(doc.type === "page") { emit(doc.created_at, doc); } }'
            },
            by_updated_date: {
              map: 'function(doc) { if(doc.type === "page") { emit(doc.updated_at, doc); } }'
            },
            by_author: {
              map: 'function(doc) { if(doc.type === "page" && doc.created_by) { emit(doc.created_by, doc); } }'
            }
          }
        }
      },
      {
        name: 'users',
        doc: {
          views: {
            by_email: {
              map: 'function(doc) { if(doc.type === "user") { emit(doc.email, doc); } }'
            },
            by_role: {
              map: 'function(doc) { if(doc.type === "user") { emit(doc.role, doc); } }'
            },
            by_created_date: {
              map: 'function(doc) { if(doc.type === "user") { emit(doc.created_at, doc); } }'
            },
            active_users: {
              map: 'function(doc) { if(doc.type === "user" && doc.last_login) { emit(doc.last_login, doc); } }'
            }
          }
        }
      },
      {
        name: 'media',
        doc: {
          views: {
            by_type: {
              map: 'function(doc) { if(doc.type === "media") { emit(doc.mime_type, doc); } }'
            },
            by_date: {
              map: 'function(doc) { if(doc.type === "media") { emit(doc.created_at, doc); } }'
            },
            by_uploader: {
              map: 'function(doc) { if(doc.type === "media" && doc.uploaded_by) { emit(doc.uploaded_by, doc); } }'
            },
            by_size: {
              map: 'function(doc) { if(doc.type === "media") { emit(doc.size, doc); } }'
            },
            images_only: {
              map: 'function(doc) { if(doc.type === "media" && doc.mime_type && doc.mime_type.startsWith("image/")) { emit(doc.created_at, doc); } }'
            }
          }
        }
      }
    ];

    for (const designDoc of designDocs) {
      await createDesignDocument('saas_platform', designDoc);
    }

    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
#!/usr/bin/env node

/**
 * Database seeding script
 * Populates the database with sample data for development
 */

const http = require('http');
const crypto = require('crypto');

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

function hashPassword(password) {
  // Simple hash for demo purposes - in production use bcrypt
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createDocument(dbName, doc) {
  try {
    const result = await makeRequest('POST', `/${dbName}`, doc);
    console.log(`✅ Created document: ${doc._id || result.id}`);
    return result;
  } catch (error) {
    if (error.message.includes('conflict')) {
      console.log(`ℹ️  Document already exists: ${doc._id}`);
    } else {
      console.error(`❌ Failed to create document:`, error.message);
      throw error;
    }
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');

  try {
    const now = new Date().toISOString();

    // Sample users
    const users = [
      {
        _id: 'user:admin@example.com',
        type: 'user',
        email: 'admin@example.com',
        password_hash: hashPassword('admin123'),
        role: 'admin',
        profile: {
          name: 'Admin User',
          avatar: null
        },
        created_at: now,
        last_login: null
      },
      {
        _id: 'user:editor@example.com',
        type: 'user',
        email: 'editor@example.com',
        password_hash: hashPassword('editor123'),
        role: 'editor',
        profile: {
          name: 'Content Editor',
          avatar: null
        },
        created_at: now,
        last_login: null
      }
    ];

    // Sample pages
    const pages = [
      {
        _id: 'page:home',
        type: 'page',
        title: 'Home',
        slug: 'home',
        content: {
          blocks: [
            {
              type: 'hero',
              data: {
                title: 'Welcome to Our SaaS Platform',
                subtitle: 'Build amazing things with our cutting-edge technology',
                cta_text: 'Get Started',
                cta_link: '/contact',
                background_image: null
              }
            },
            {
              type: 'features',
              data: {
                title: 'Why Choose Us',
                features: [
                  {
                    title: 'Fast & Reliable',
                    description: 'Built with modern technology for optimal performance',
                    icon: 'zap'
                  },
                  {
                    title: 'Secure',
                    description: 'Enterprise-grade security to protect your data',
                    icon: 'shield'
                  },
                  {
                    title: 'Scalable',
                    description: 'Grows with your business needs',
                    icon: 'trending-up'
                  }
                ]
              }
            }
          ]
        },
        meta: {
          title: 'Home - SaaS Platform',
          description: 'Welcome to our innovative SaaS platform'
        },
        status: 'published',
        created_at: now,
        updated_at: now,
        created_by: 'user:admin@example.com'
      },
      {
        _id: 'page:about',
        type: 'page',
        title: 'About Us',
        slug: 'about',
        content: {
          blocks: [
            {
              type: 'text',
              data: {
                content: '<h1>About Our Company</h1><p>We are a innovative tech startup focused on building amazing SaaS solutions.</p>'
              }
            }
          ]
        },
        meta: {
          title: 'About Us - SaaS Platform',
          description: 'Learn more about our company and mission'
        },
        status: 'published',
        created_at: now,
        updated_at: now,
        created_by: 'user:admin@example.com'
      },
      {
        _id: 'page:services',
        type: 'page',
        title: 'Services',
        slug: 'services',
        content: {
          blocks: [
            {
              type: 'text',
              data: {
                content: '<h1>Our Services</h1><p>We offer a comprehensive suite of services to help your business grow.</p>'
              }
            }
          ]
        },
        meta: {
          title: 'Services - SaaS Platform',
          description: 'Discover our range of professional services'
        },
        status: 'draft',
        created_at: now,
        updated_at: now,
        created_by: 'user:editor@example.com'
      }
    ];

    // Sample media files
    const mediaFiles = [
      {
        _id: 'media:hero-bg-001',
        type: 'media',
        filename: 'hero-background.jpg',
        original_name: 'hero-background.jpg',
        mime_type: 'image/jpeg',
        size: 1024000,
        url: '/uploads/hero-background.jpg',
        alt_text: 'Hero section background image',
        uploaded_by: 'user:admin@example.com',
        created_at: now
      },
      {
        _id: 'media:logo-001',
        type: 'media',
        filename: 'company-logo.png',
        original_name: 'company-logo.png',
        mime_type: 'image/png',
        size: 45000,
        url: '/uploads/company-logo.png',
        alt_text: 'Company logo',
        uploaded_by: 'user:admin@example.com',
        created_at: now
      }
    ];

    // Create all documents
    console.log('Creating users...');
    for (const user of users) {
      await createDocument('saas_platform', user);
    }

    console.log('Creating pages...');
    for (const page of pages) {
      await createDocument('saas_platform', page);
    }

    console.log('Creating media files...');
    for (const media of mediaFiles) {
      await createDocument('saas_platform', media);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('Sample login credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Editor: editor@example.com / editor123');

  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
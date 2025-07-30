# Database Scripts

This directory contains scripts for managing the CouchDB database used by the SaaS startup platform.

## Available Scripts

### Database Initialization

- **`init-db.js`** - Initializes the main database with design documents and views
- **`init-test-db.js`** - Sets up a separate test database for running tests
- **`reset-db.js`** - Drops and recreates the main database (destructive operation)

### Data Management

- **`seed-db.js`** - Populates the database with sample data for development
- **`migrate-db.js`** - Handles database schema migrations and data transformations

### Configuration

- **`couchdb/local.ini`** - CouchDB configuration file mounted in the container

## Usage

### NPM Scripts (Recommended)

```bash
# Initialize main database
pnpm db:init

# Reset database (WARNING: Destroys all data)
pnpm db:reset

# Seed with sample data
pnpm db:seed

# Run migrations
pnpm db:migrate

# List migration status
pnpm db:migrate:list

# Initialize test database
pnpm db:test:init

# Clean test database
pnpm db:test:clean
```

### Direct Script Execution

```bash
# Initialize main database
node scripts/init-db.js

# Initialize test database
node scripts/init-test-db.js

# Clean test database
node scripts/init-test-db.js clean

# Seed database
node scripts/seed-db.js

# Run migrations
node scripts/migrate-db.js run

# List migrations
node scripts/migrate-db.js list
```

## Environment Variables

All scripts support the following environment variables:

- `COUCHDB_URL` - CouchDB server URL (default: http://localhost:5984)
- `COUCHDB_USER` - CouchDB admin username (default: admin)
- `COUCHDB_PASSWORD` - CouchDB admin password (default: password)
- `DB_NAME` - Main database name (default: saas_platform)
- `TEST_DB_NAME` - Test database name (default: saas_platform_test)

## Database Structure

### Main Database: `saas_platform`

The main database contains the following document types:

#### Pages
- Document ID format: `page:{slug}`
- Contains website pages and blog posts
- Fields: title, slug, content, meta, status, created_at, updated_at, created_by

#### Users
- Document ID format: `user:{email}`
- Contains admin and editor users
- Fields: email, password_hash, role, profile, created_at, last_login

#### Media
- Document ID format: `media:{unique-id}`
- Contains uploaded files and images
- Fields: filename, original_name, mime_type, size, url, alt_text, uploaded_by, created_at

### Design Documents and Views

#### Pages (`_design/pages`)
- `by_status` - Pages grouped by status (draft, published)
- `by_slug` - Pages indexed by slug for URL routing
- `published` - Only published pages, sorted by update date
- `by_created_date` - Pages sorted by creation date
- `by_updated_date` - Pages sorted by last update
- `by_author` - Pages grouped by author

#### Users (`_design/users`)
- `by_email` - Users indexed by email address
- `by_role` - Users grouped by role (admin, editor)
- `by_created_date` - Users sorted by creation date
- `active_users` - Users who have logged in, sorted by last login

#### Media (`_design/media`)
- `by_type` - Media files grouped by MIME type
- `by_date` - Media files sorted by upload date
- `by_uploader` - Media files grouped by uploader
- `by_size` - Media files sorted by file size
- `images_only` - Only image files, sorted by upload date

### Test Database: `saas_platform_test`

Identical structure to the main database but used exclusively for running tests.

## Sample Data

The seed script creates the following sample data:

### Users
- **Admin User**: admin@example.com / admin123
- **Editor User**: editor@example.com / editor123

### Pages
- **Home Page**: Published homepage with hero section and features
- **About Page**: Published about page
- **Services Page**: Draft services page

### Media Files
- Sample hero background image
- Company logo placeholder

## Migrations

The migration system allows for schema changes and data transformations:

### Available Migrations
1. `001_add_page_categories` - Adds categories field to page documents
2. `002_add_user_preferences` - Adds preferences field to user documents
3. `003_add_media_tags` - Adds tags field to media documents

### Creating New Migrations

Add new migrations to the `migrations` object in `migrate-db.js`:

```javascript
const migrations = {
  '004_your_migration_name': {
    description: 'Description of what this migration does',
    up: async () => {
      // Migration logic here
    }
  }
};
```

## Development Workflow

1. **Start containers**: `pnpm containers:up`
2. **Initialize database**: `pnpm db:init`
3. **Seed with sample data**: `pnpm db:seed`
4. **Run migrations**: `pnpm db:migrate`

For testing:
1. **Initialize test database**: `pnpm db:test:init`
2. **Run tests**: `pnpm test`
3. **Clean test database**: `pnpm db:test:clean`

## Troubleshooting

### Connection Issues
- Ensure CouchDB container is running: `docker ps`
- Check CouchDB logs: `docker logs saas-couchdb`
- Verify CouchDB is accessible: `curl http://localhost:5984`

### Permission Issues
- Verify admin credentials in environment variables
- Check CouchDB configuration in `scripts/couchdb/local.ini`

### Database Corruption
- Reset database: `pnpm db:reset`
- Reinitialize: `pnpm db:init`
- Reseed: `pnpm db:seed`

## Security Notes

- Default credentials are for development only
- Change admin password in production
- Use environment variables for sensitive configuration
- Enable authentication in production CouchDB setup
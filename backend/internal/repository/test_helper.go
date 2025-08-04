package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/database"
	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// TestDBConfig holds test database configuration (repurposed for Postgres)
type TestDBConfig struct {
	URL string
}

// getenvDefault returns env var if set, otherwise defaultVal
func getenvDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// DefaultTestDBConfig returns default test database configuration for Postgres
func DefaultTestDBConfig() TestDBConfig {
	// Example default matches docker-compose.test.yml
	// Allow DATABASE_URL to override if TEST_DATABASE_URL not set
	url := getenvDefault("TEST_DATABASE_URL", getenvDefault("DATABASE_URL", "postgres://app:app@localhost:15432/app_test?sslmode=disable"))
	return TestDBConfig{URL: url}
}

// SetupTestDB initializes a pgxpool.Pool for tests, ensures schema exists, and seeds minimal data.
// It returns the pool and a teardown function that truncates tables with CASCADE semantics.
func SetupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	cfg := DefaultTestDBConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.URL)
	require.NoError(t, err, "failed to create pgx pool")

	// Ensure connection is valid
	require.NoError(t, pool.Ping(ctx), "failed to ping test database")

	// Ensure essential tables exist. If migrations not applied, create minimal schema subset to unblock tests.
	ensureDDL(ctx, t, pool)

	// Truncate tables before test to isolate data
	truncateAll(ctx, t, pool)

	// Seed minimal test data
	seedMinimal(ctx, t, pool)

	// Register cleanup
	t.Cleanup(func() {
		// Truncate again and close
		truncateAll(ctx, t, pool)
		pool.Close()
	})

	return pool
}

// SetupTestPGClient initializes the test DB and returns a real *database.PostgresClient.
// It relies on TEST_DATABASE_URL (or DATABASE_URL) for connectivity and registers cleanup.
func SetupTestPGClient(t *testing.T) *database.PostgresClient {
	t.Helper()

	// Ensure schema and seeds are present
	_ = SetupTestDB(t)

	// Construct Postgres client via environment-based config
	client, err := database.NewPostgresClient(context.Background())
	require.NoError(t, err, "failed to create Postgres client for tests")

	t.Cleanup(func() {
		client.Close()
	})

	return client
}

// ensureDDL creates tables if missing (subset sufficient for repository tests)
func ensureDDL(ctx context.Context, t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	// Create required extensions and enums if missing
	_, _ = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
	_, _ = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS citext;`)
	_, _ = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
	_, _ = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS unaccent;`)

	// Enums
	_, _ = pool.Exec(ctx, `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'page_status') THEN
    CREATE TYPE page_status AS ENUM ('draft','published','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE post_status AS ENUM ('draft','published','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status') THEN
    CREATE TYPE contact_status AS ENUM ('new','in_progress','resolved','spam');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','editor','author','viewer');
  END IF;
END$$;`)

	// Functions used in triggers (idempotent)
	_, _ = pool.Exec(ctx, `
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`)

	// Minimal tables used by repos and tests
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`)

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status page_status NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_tsv tsvector
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_unique ON pages (slug);`)

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  status post_status NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_tsv tsvector
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique ON blog_posts (slug);`)

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_filename_unique ON media (filename);`)

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  name TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status contact_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_tsv tsvector
);`)

	// Triggers for updated_at (idempotent)
	_, _ = pool.Exec(ctx, `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
    CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_pages') THEN
    CREATE TRIGGER set_updated_at_pages BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_blog_posts') THEN
    CREATE TRIGGER set_updated_at_blog_posts BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_media') THEN
    CREATE TRIGGER set_updated_at_media BEFORE UPDATE ON media
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_contact_submissions') THEN
    CREATE TRIGGER set_updated_at_contact_submissions BEFORE UPDATE ON contact_submissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;`)
}

// seedMinimal inserts an admin and author and some basic rows if absent
func seedMinimal(ctx context.Context, t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	// Users
	_, _ = pool.Exec(ctx, `
INSERT INTO users (email, name, password_hash, role)
VALUES
  ('admin@example.com','Admin User','$2a$10$examplehashforadmin','admin'),
  ('author@example.com','Author User','$2a$10$examplehashforauthor','author')
ON CONFLICT (email) DO NOTHING;`)

	// Page home
	_, _ = pool.Exec(ctx, `
WITH a AS (SELECT id FROM users WHERE email='author@example.com' LIMIT 1)
INSERT INTO pages (slug, title, content, status, author_id, published_at)
SELECT 'home','Home','Welcome to the site','published', a.id, NOW() FROM a
ON CONFLICT DO NOTHING;`)

	// Blog post
	_, _ = pool.Exec(ctx, `
WITH a AS (SELECT id FROM users WHERE email='author@example.com' LIMIT 1)
INSERT INTO blog_posts (slug, title, excerpt, content, status, author_id, published_at)
SELECT 'hello-world','Hello World','Intro','This is the first blog post','published', a.id, NOW()
FROM a
ON CONFLICT DO NOTHING;`)

	// Media sample
	_, _ = pool.Exec(ctx, `
WITH u AS (SELECT id FROM users WHERE email='admin@example.com' LIMIT 1)
INSERT INTO media (filename, path, mime_type, size_bytes, uploader_id)
SELECT 'logo.png','/uploads/logo.png','image/png',2048,u.id
FROM u
ON CONFLICT (filename) DO NOTHING;`)
}

// truncateAll truncates relevant tables to isolate tests
func truncateAll(ctx context.Context, t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	// Order is safe with CASCADE and RESTART IDENTITY for deterministic IDs when using sequences
	_, err := pool.Exec(ctx, `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_post_categories') THEN
    EXECUTE 'TRUNCATE TABLE blog_post_categories, blog_post_tags, pages, blog_posts, categories, tags, media, contact_submissions RESTART IDENTITY CASCADE';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
    EXECUTE 'TRUNCATE TABLE pages, blog_posts, media, contact_submissions RESTART IDENTITY CASCADE';
  END IF;
END $$;`)
	require.NoError(t, err, "failed to truncate tables")
}

// CreateTestPage creates a test page for testing
func CreateTestPage(slug, title string) *models.Page {
	return models.NewPage(title, slug)
}

// CreateTestUser creates a test user for testing
func CreateTestUser(email, role string) *models.User {
	return models.NewUser(email, "hashed_password", role)
}

// CreateTestMedia creates a test media for testing
func CreateTestMedia(filename, uploader string) *models.Media {
	return models.NewMedia(filename, filename, "image/jpeg", uploader, 1024)
}

// WaitForView is a no-op for Postgres-backed tests (kept for compatibility)
func WaitForView(t *testing.T, _ interface{}, _ string, _ string) {
	// No-op: Postgres writes are visible immediately within the same transaction/session.
}

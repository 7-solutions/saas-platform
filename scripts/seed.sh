#!/usr/bin/env bash
set -euo pipefail

echo "[seed] Seeding development/test data"

: "${DATABASE_URL:?DATABASE_URL env var must be set, e.g. postgres://user:pass@localhost:5432/app?sslmode=disable}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Ensure minimal dependencies exist
-- Users: one admin, one author
INSERT INTO users (id, email, name, password_hash, role)
VALUES 
  (gen_random_uuid(), 'admin@example.com', 'Admin User', '$2a$10$examplehashforadmin', 'admin'),
  (gen_random_uuid(), 'author@example.com', 'Author User', '$2a$10$examplehashforauthor', 'author')
ON CONFLICT (email) DO NOTHING;

-- Capture IDs for FK references using CTEs
WITH a AS (
  SELECT id FROM users WHERE email='author@example.com' LIMIT 1
),
ad AS (
  SELECT id FROM users WHERE email='admin@example.com' LIMIT 1
)
-- Page: home
INSERT INTO pages (id, slug, title, content, status, author_id, published_at)
SELECT gen_random_uuid(), 'home', 'Home', 'Welcome to the site', 'published', a.id, NOW()
FROM a
ON CONFLICT DO NOTHING;

-- Blog posts
WITH a AS (
  SELECT id FROM users WHERE email='author@example.com' LIMIT 1
)
INSERT INTO blog_posts (id, slug, title, excerpt, content, status, author_id, published_at)
SELECT gen_random_uuid(), 'hello-world', 'Hello World', 'Intro post', 'This is the first blog post', 'published', a.id, NOW()
FROM a
ON CONFLICT DO NOTHING;

WITH a AS (
  SELECT id FROM users WHERE email='author@example.com' LIMIT 1
)
INSERT INTO blog_posts (id, slug, title, excerpt, content, status, author_id, published_at)
SELECT gen_random_uuid(), 'second-post', 'Second Post', 'Another post', 'Content of second post', 'draft', a.id, NULL
FROM a
ON CONFLICT DO NOTHING;

-- Media sample
WITH u AS (
  SELECT id FROM users WHERE email='admin@example.com' LIMIT 1
)
INSERT INTO media (id, filename, path, mime_type, size_bytes, uploader_id)
SELECT gen_random_uuid(), 'logo.png', '/uploads/logo.png', 'image/png', 2048, u.id
FROM u
ON CONFLICT (filename) DO NOTHING;
SQL

echo "[seed] Done"
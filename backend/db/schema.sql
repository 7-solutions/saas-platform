-- Schema DDL for cms/blog platform
-- PostgreSQL 17 compatible
-- Idempotent where possible

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'page_status') THEN
    CREATE TYPE page_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status') THEN
    CREATE TYPE contact_status AS ENUM ('new', 'in_progress', 'resolved', 'spam');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'editor', 'author', 'viewer');
  END IF;
END$$;

-- Updated at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tables

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pages
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

CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_unique ON pages (slug);
CREATE INDEX IF NOT EXISTS pages_status_idx ON pages (status);
CREATE INDEX IF NOT EXISTS pages_author_idx ON pages (author_id);
CREATE INDEX IF NOT EXISTS pages_published_at_idx ON pages (published_at);
CREATE INDEX IF NOT EXISTS pages_title_trgm_idx ON pages USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pages_tsv_idx ON pages USING GIN (search_tsv);

-- blog_posts
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

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON blog_posts (status);
CREATE INDEX IF NOT EXISTS blog_posts_author_idx ON blog_posts (author_id);
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON blog_posts (published_at);
CREATE INDEX IF NOT EXISTS blog_posts_title_trgm_idx ON blog_posts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS blog_posts_tsv_idx ON blog_posts USING GIN (search_tsv);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique ON categories (slug);

-- tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_unique ON tags (slug);

-- blog_post_categories (junction)
CREATE TABLE IF NOT EXISTS blog_post_categories (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);
CREATE INDEX IF NOT EXISTS blog_post_categories_post_idx ON blog_post_categories (post_id);
CREATE INDEX IF NOT EXISTS blog_post_categories_category_idx ON blog_post_categories (category_id);

-- blog_post_tags (junction)
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS blog_post_tags_post_idx ON blog_post_tags (post_id);
CREATE INDEX IF NOT EXISTS blog_post_tags_tag_idx ON blog_post_tags (tag_id);

-- media
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
CREATE UNIQUE INDEX IF NOT EXISTS media_filename_unique ON media (filename);
CREATE INDEX IF NOT EXISTS media_uploader_idx ON media (uploader_id);

-- contact_submissions
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
);
CREATE INDEX IF NOT EXISTS contact_status_idx ON contact_submissions (status);
CREATE INDEX IF NOT EXISTS contact_email_idx ON contact_submissions (email);
CREATE INDEX IF NOT EXISTS contact_created_at_idx ON contact_submissions (created_at);
CREATE INDEX IF NOT EXISTS contact_tsv_idx ON contact_submissions USING GIN (search_tsv);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users'
  ) THEN
    CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_pages'
  ) THEN
    CREATE TRIGGER set_updated_at_pages BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_blog_posts'
  ) THEN
    CREATE TRIGGER set_updated_at_blog_posts BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_categories'
  ) THEN
    CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tags'
  ) THEN
    CREATE TRIGGER set_updated_at_tags BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_media'
  ) THEN
    CREATE TRIGGER set_updated_at_media BEFORE UPDATE ON media
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_contact_submissions'
  ) THEN
    CREATE TRIGGER set_updated_at_contact_submissions BEFORE UPDATE ON contact_submissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Generated columns / maintenance: maintain tsvectors
CREATE OR REPLACE FUNCTION pages_update_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.title), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.content), '')), 'B');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pages_tsv_trigger'
  ) THEN
    CREATE TRIGGER pages_tsv_trigger
    BEFORE INSERT OR UPDATE OF title, content ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_update_tsv();
  END IF;
END$$;

CREATE OR REPLACE FUNCTION posts_update_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.title), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.excerpt), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.content), '')), 'C');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'blog_posts_tsv_trigger'
  ) THEN
    CREATE TRIGGER blog_posts_tsv_trigger
    BEFORE INSERT OR UPDATE OF title, excerpt, content ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION posts_update_tsv();
  END IF;
END$$;

CREATE OR REPLACE FUNCTION contacts_update_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.subject), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.message), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.email::text), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.name), '')), 'C');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contact_submissions_tsv_trigger'
  ) THEN
    CREATE TRIGGER contact_submissions_tsv_trigger
    BEFORE INSERT OR UPDATE OF subject, message, email, name ON contact_submissions
    FOR EACH ROW EXECUTE FUNCTION contacts_update_tsv();
  END IF;
END$$;
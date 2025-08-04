# SQLC setup

This directory contains the PostgreSQL schema and the initial SQL query set used by sqlc to generate typed database accessors in Go.

## Requirements

- PostgreSQL 14+ (tested with 17)
- sqlc v2
- Go 1.22+
- pgx/v5 driver

## Paths

- Schema DDL: backend/db/schema.sql
- Queries: backend/db/queries/*.sql
- sqlc config: backend/sqlc.yaml
- Generated Go: backend/internal/database/sqlc (package db)

## Generate code

From the backend directory:

```bash
make sqlc-generate
# or
sqlc generate -f ./sqlc.yaml
```

This will read schema.sql and all SQL files under backend/db/queries and emit Go code into backend/internal/database/sqlc.

## Database connection

Set DATABASE_URL for your environment, for example:

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/appdb?sslmode=disable"
```

Migrations/DDL (schema.sql) is idempotent for development and includes IF NOT EXISTS guards for extensions, enums, tables, indexes, and triggers.

## Text search queries

Search endpoints accept a pre-formatted tsquery string. Callers should prepare terms with suffix wildcards and boolean operators. Examples:

- Single term prefix: "hello:*"
- Multi-term AND: "hello:* & world:*"
- Phrase broken into lexemes: "static:* & site:*"
- Sanitization: callers should clean user input, split into tokens, drop unsafe characters, and join with " & " plus ":*".

The queries internally call:
```sql
search_tsv @@ to_tsquery('simple', $1)
```
and rank with `ts_rank_cd(...)`. The tsvector columns are maintained by triggers and use unaccent and simple configuration.

## Enum mappings

The following enums are defined and mapped to Go string types via sqlc overrides:

- page_status: draft, published, archived
- post_status: draft, published, archived
- contact_status: new, in_progress, resolved, spam
- user_role: admin, editor, author, viewer

## pgx/v5 driver

sqlc.yaml is configured with:
- engine: postgresql
- sql_package: pgx/v5

Ensure your module imports pgx/v5 somewhere (tools.go or actual code) so it’s included in go.mod. A typical tools.go looks like:

```go
//go:build tools
// +build tools

package tools

import (
	_ "github.com/jackc/pgx/v5/pgxpool"
)
```

Place that under a tools or internal/tools package if desired. This repo will wire it when repositories migrate to sqlc.

## Files overview

Queries are grouped by domain:
- pages.sql
- blog_posts.sql (includes category/tag CRUD minimal and linking)
- media.sql
- users.sql
- contact_submissions.sql

Each query is annotated with sqlc method comments, for example:

```sql
-- name: GetPageBySlug :one
SELECT * FROM pages WHERE slug = $1 LIMIT 1;
```

Return cardinality directives:
- :one, :many, :exec, :execrows

## Notes

- All SQL is written for PostgreSQL and compatible with pgx/v5.
- Triggers automatically update updated_at and maintain search tsvector columns.
- For performance, GIN(TRGM) indexes exist on titles and full text indexes on tsvector columns.
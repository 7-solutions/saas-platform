# Makefile targets for backend tooling

.PHONY: sqlc-generate
sqlc-generate:
	@which sqlc > /dev/null || (echo "sqlc not found. Install from https://docs.sqlc.dev/en/latest/overview/install.html" && exit 1)
	sqlc generate -f ./sqlc.yaml

.PHONY: migrate
migrate:
	@which psql > /dev/null || (echo "psql not found. Install PostgreSQL client." && exit 1)
	@./../scripts/migrate.sh

.PHONY: seed
seed:
	@which psql > /dev/null || (echo "psql not found. Install PostgreSQL client." && exit 1)
	@./../scripts/seed.sh

.PHONY: test-db-reset
test-db-reset:
	@which psql > /dev/null || (echo "psql not found. Install PostgreSQL client." && exit 1)
	@test -n "$$TEST_DATABASE_URL" || (echo "TEST_DATABASE_URL must be set, e.g. postgres://app:app@localhost:15432/app_test?sslmode=disable" && exit 1)
	psql "$$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_post_categories') THEN EXECUTE 'TRUNCATE TABLE blog_post_categories, blog_post_tags, pages, blog_posts, categories, tags, media, contact_submissions RESTART IDENTITY CASCADE'; END IF; END $$;"
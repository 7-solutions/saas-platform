# SaaS Startup Platform

Monorepo containing:
- Next.js apps: `apps/website`, `apps/cms`
- Go services: `api-gateway`, `backend` (monolith for alternative deployment)
- Shared TypeScript libraries: `packages/ui`, `packages/shared`
- Infra: Dockerfiles, docker-compose (dev/test/prod), DB migrations, scripts

Tooling:
- Package manager: pnpm
- Task orchestrator: Turborepo
- Next.js 15 standalone builds for container deployments
- Go 1.24.x for services
- Postgres database, SQLC for Go DB layer

## Prerequisites

- Node.js 22+ and pnpm 9+
- Docker and Docker Compose v2
- Go 1.24+ (for local Go development)
- Recommended: direnv for environment management

Copy `.env.example` to `.env` and adjust as needed:
```
cp .env.example .env
```

Important variables:
- NEXT_PUBLIC_API_URL (frontends)
- NEXTAUTH_URL, NEXTAUTH_SECRET (CMS and auth flows)
- DATABASE_URL, TEST_DATABASE_URL (Postgres)
- JWT_SECRET (services)
- HTTP/GRPC/METRICS_ADDR or PORT as used by services

## Monorepo Commands (Turbo)

At repo root:
- Dev both Next apps:
  ```
  pnpm turbo run dev --parallel --filter=@saas-platform/website --filter=@saas-platform/cms
  ```
- Dev single app:
  ```
  pnpm turbo run dev --filter=@saas-platform/website
  pnpm turbo run dev --filter=@saas-platform/cms
  ```
- Build all:
  ```
  pnpm turbo run build
  ```
- Lint / Type-check / Test:
  ```
  pnpm turbo run lint
  pnpm turbo run type-check
  pnpm turbo run test
  ```

Go services (via Turbo scripts in package.json):
- Dev:
  ```
  pnpm turbo run dev --filter=@saas-platform/api-gateway
  pnpm turbo run dev --filter=@saas-platform/backend
  ```
  If `air` is not installed, dev will fallback to `go run`.

- Build binaries:
  ```
  pnpm turbo run build --filter=@saas-platform/api-gateway
  pnpm turbo run build --filter=@saas-platform/backend
  ```

## Deployment (Docker)

This repository supports containerized deployment using multi-stage Dockerfiles and Next.js standalone output.

### Build Docker images

From repo root:
```
# Website
docker build -f apps/website/Dockerfile -t saas/website:latest apps/website

# CMS
docker build -f apps/cms/Dockerfile -t saas/cms:latest apps/cms

# API Gateway
docker build -f api-gateway/Dockerfile -t saas/api-gateway:latest api-gateway

# Backend monolith (alternative to microservices)
docker build -f backend/Dockerfile -t saas/backend:latest backend
```

Notes:
- Next.js Dockerfiles expect `output: 'standalone'` (already configured).
- Go service Dockerfiles produce static binaries in distroless/alpine images.

### Docker Compose Environments

This repo includes multiple compose files under `docker/` and a root `docker-compose.yml`.

Common flows:

Dev compose:
```
docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml up --build
```

Test compose:
```
docker compose -f docker-compose.yml -f docker/docker-compose.test.yml up --build --abort-on-container-exit
```

Prod compose (example):
```
docker compose -f docker-compose.yml -f docker/docker-compose.prod.yml up -d
```

Shorthands (if present in package.json scripts at root):
```
pnpm containers:build
pnpm containers:up
pnpm containers:down
pnpm containers:prod
pnpm containers:prod:build
```

Environment variables for compose:
- Ensure `.env` provides values for:
  - NEXT_PUBLIC_API_URL (e.g., http://api-gateway:8080)
  - NEXTAUTH_URL, NEXTAUTH_SECRET (for CMS auth)
  - DATABASE_URL (Postgres DSN)
  - JWT_SECRET
- Compose files may enforce required vars via `${VAR:?err}` syntax in prod.

### Service Ports (typical defaults)

- api-gateway: HTTP 8080, metrics 9090
- backend monolith: HTTP 8080 (or 8090), gRPC 9090, metrics 8081/9091 (verify Dockerfile and main.go)
- website: 3000 (may auto-swizzle if occupied)
- cms: 3001 (may auto-swizzle if occupied)
- postgres: 5432

## Database: Migrate and Seed

This repo uses Postgres and `sqlc`-generated code in Go services. Migrations are in `backend/migrations/` and SQL query sources in `backend/db/queries/`.

You can run DB tasks via included node scripts (see root `package.json` scripts) or your preferred migrate tool:

Root scripts:
```
# Initialize database (create DB/schema)
pnpm db:init

# Run migrations
pnpm db:migrate

# List migrations
pnpm db:migrate:list

# Seed data
pnpm db:seed

# Reset database (drop + recreate)
pnpm db:reset
```

Test database helpers:
```
pnpm db:test:init
pnpm db:test:clean
```

Alternatively, inside running compose services, you can execute migration binaries (if packaged) or run SQL scripts directly against Postgres.

Ensure `DATABASE_URL` (and `TEST_DATABASE_URL` for test) is set appropriately in your environment or compose.

## Production Deployment Outline

1) Build images
```
docker build -f apps/website/Dockerfile -t ghcr.io/ORG/website:SHA apps/website
docker build -f apps/cms/Dockerfile -t ghcr.io/ORG/cms:SHA apps/cms
docker build -f api-gateway/Dockerfile -t ghcr.io/ORG/api-gateway:SHA api-gateway
# optional monolith path
docker build -f backend/Dockerfile -t ghcr.io/ORG/backend:SHA backend
```

2) Push images
```
docker push ghcr.io/ORG/website:SHA
docker push ghcr.io/ORG/cms:SHA
docker push ghcr.io/ORG/api-gateway:SHA
docker push ghcr.io/ORG/backend:SHA
```

3) Provision environment variables/secrets:
- NEXT_PUBLIC_API_URL accordingly
- NEXTAUTH_URL, NEXTAUTH_SECRET (CMS)
- DATABASE_URL (Postgres managed service)
- JWT_SECRET
- Any service-specific GRPC/HTTP/METRICS_ADDR overrides

4) Run compose in the target environment (or deploy via your orchestrator with equivalent specs).

## CI with Turborepo (Outline)

Recommended GitHub Actions workflow (not yet committed here):
- Job `checks`: install with pnpm, run `pnpm turbo run lint type-check test`
- Job `build`: run `pnpm turbo run build`
- Job `docker-build`: build and push images (buildx) with tags per SHA
- Optional: Enable Turbo remote caching with `TURBO_TOKEN` and `TURBO_TEAM`

## Troubleshooting

- Next build fails fetching data: Ensure NEXT_PUBLIC_API_URL points to reachable api-gateway or mock endpoint during build. For static export, handle fetch failures gracefully or use ISR fallbacks.

- ESLint config errors:
  - `.eslintrc.js` uses `plugin:@typescript-eslint/recommended`. Ensure root devDeps include `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`.

- Turbo errors about project config:
  - Ensure per-app `turbo.json` includes `"extends": ["//"]` to inherit root pipeline.

- Ports already in use:
  - Next dev auto-selects a different port and logs it (e.g., 3002, 3003). For fixed ports, export `PORT` per app.

## Repository Structure

- apps/website: Public website (Next.js, standalone)
- apps/cms: Admin CMS (Next.js, NextAuth)
- api-gateway: Go gateway (HTTP + gRPC upstreams)
- backend: Go monolith (alternative to microservices)
- packages/ui: Shared UI library
- packages/shared: Shared TS utilities
- docker/: Compose overlays for dev/test/prod
- backend/db/: SQL queries and schema (Postgres)
- backend/migrations/: Migrations
- turbo.json: Root Turborepo pipeline
- Per-package turbo.json: Package-specific outputs/inputs/env

## Quick Start

Development (Next apps):
```
pnpm install
pnpm turbo run dev --parallel --filter=@saas-platform/website --filter=@saas-platform/cms
# Website: http://localhost:3003 (or 3000 if free)
# CMS:     http://localhost:3002 (or 3001 if free)
```

Build and test:
```
pnpm turbo run build
pnpm turbo run lint type-check test
```

Compose up (dev):
```
docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml up --build
```

Migrate and seed:
```
pnpm db:migrate
pnpm db:seed
```

## License

Proprietary – All rights reserved.
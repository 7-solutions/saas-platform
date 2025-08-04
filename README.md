# SaaS Platform Monorepo

Production-grade monorepo providing:
- Public website (Next.js)
- Admin CMS (Next.js + NextAuth)
- API Gateway (Go, gRPC-Gateway)
- Optional Monolith backend (Go, gRPC + HTTP gateway)
- Shared UI and utilities packages (TypeScript)
- Docker/Compose environments (dev/test/prod)
- Turborepo for orchestration, caching, and CI friendliness

## Tech Stack

Frontend
- Next.js 15 (App Router, standalone output)
- React 18
- TypeScript 5.7+
- Jest + Testing Library (unit tests)
- ESLint (next/core-web-vitals, TypeScript plugin)

Backend/Services
- Go 1.24.x
- gRPC + grpc-gateway HTTP
- SQLC for typed DB access (Postgres)
- Prometheus client for metrics
- Structured logging

Infrastructure/Tooling
- pnpm workspaces
- Turborepo (build/lint/test/dev orchestration, remote cache-ready)
- Docker multi-stage builds; distroless/alpine for Go services
- Docker Compose: dev, test, prod overlays
- Postgres
- Optional hot-reload: air (Go)

## Repository Structure

- apps/
  - website: Public website (Next.js)
  - cms: Admin CMS (Next.js, NextAuth)
- api-gateway/: Go HTTP gateway → upstream microservices via gRPC
- backend/: Go monolith (alternative to microservices topology)
- packages/
  - ui: Shared UI library (TS, Storybook-ready)
  - shared: Shared TS utilities
- docker/: Compose overlays for dev/test/prod
- backend/db/: SQL queries and schema (Postgres)
- backend/migrations/: DB migrations
- turbo.json: Root pipeline
- Per-package turbo.json: Specialization (outputs/inputs/env)

## Architecture (Designed)

Overview
- Frontends (website, cms) consume REST endpoints from api-gateway.
- api-gateway exposes HTTP routes and translates into upstream gRPC calls to domain microservices (auth, content, media, contact). In this repo, those can be external services or replaced by the monolith backend for a simpler deployment.
- Shared libs provide design system (ui) and utilities (shared) to both apps.
- Turborepo defines a uniform pipeline for build/dev/test/lint/type-check/clean/check with caching and dependency graph across packages. Next apps depend on packages/ui and packages/shared; Go services optionally depend on shared Go libs (if present).

Deployment Modes
1) Microservices with api-gateway
   - api-gateway uses gRPC upstreams (addresses configured via env).
   - Frontends talk to gateway (NEXT_PUBLIC_API_URL).
2) Monolith backend
   - Single backend binary exposes gRPC + HTTP gateway; api-gateway can be bypassed.
   - Frontends talk directly to monolith HTTP.

Data layer
- Postgres as primary DB. SQLC-generated Go code under backend/internal/database/sqlc supports typed queries.

Observability
- Metrics via Prometheus client endpoints (metrics ports per service).
- Health endpoints for liveness and readiness.

Security
- JWT secret for services consuming auth.
- NextAuth (CMS) requires NEXTAUTH_URL and NEXTAUTH_SECRET.

## Prerequisites

- Node.js 22+ and pnpm 9+
- Go 1.24+
- Docker and Docker Compose v2
- Recommended: direnv for environment management

Copy `.env.example` to `.env` and adjust as needed:
```
cp .env.example .env
```

Key env vars:
- NEXT_PUBLIC_API_URL (frontends)
- NEXTAUTH_URL, NEXTAUTH_SECRET (CMS)
- DATABASE_URL, TEST_DATABASE_URL (Postgres)
- JWT_SECRET (services)
- Service ports: HTTP/GRPC/METRICS or PORT

## Turborepo Workflows

Install dependencies:
```
pnpm install
```

Dev (Next apps in parallel):
```
pnpm turbo run dev --parallel --filter=@saas-platform/website --filter=@saas-platform/cms
```

Dev single app:
```
pnpm turbo run dev --filter=@saas-platform/website
pnpm turbo run dev --filter=@saas-platform/cms
```

Go services:
```
# Dev (falls back to `go run` if `air` is unavailable)
pnpm turbo run dev --filter=@saas-platform/api-gateway
pnpm turbo run dev --filter=@saas-platform/backend

# Build binaries
pnpm turbo run build --filter=@saas-platform/api-gateway
pnpm turbo run build --filter=@saas-platform/backend
```

Build everything:
```
pnpm turbo run build
```

Quality checks:
```
pnpm turbo run lint
pnpm turbo run type-check
pnpm turbo run test
```

## Docker Deployment

Build images (from repo root):
```
# Website
docker build -f apps/website/Dockerfile -t saas/website:latest apps/website

# CMS
docker build -f apps/cms/Dockerfile -t saas/cms:latest apps/cms

# API Gateway
docker build -f api-gateway/Dockerfile -t saas/api-gateway:latest api-gateway

# Backend (monolith), optional
docker build -f backend/Dockerfile -t saas/backend:latest backend
```

Notes:
- Next.js apps use `output: 'standalone'`, Dockerfiles copy `.next/standalone` and `.next/static`.
- Go services produce static binaries and run under distroless/alpine.

### Docker Compose

Dev:
```
docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml up --build
```

Test:
```
docker compose -f docker-compose.yml -f docker/docker-compose.test.yml up --build --abort-on-container-exit
```

Prod (example):
```
docker compose -f docker-compose.yml -f docker/docker-compose.prod.yml up -d
```

Ensure envs are present (often enforced in prod via `${VAR:?err}`):
- NEXT_PUBLIC_API_URL (e.g., http://api-gateway:8080)
- NEXTAUTH_URL, NEXTAUTH_SECRET
- DATABASE_URL
- JWT_SECRET

Typical ports:
- api-gateway: 8080 (HTTP), 9090 (metrics)
- backend monolith: 8080 (HTTP), 9090 (gRPC), 8081/9091 (metrics)
- website: 3000 (auto-swizzle if occupied)
- cms: 3001 (auto-swizzle if occupied)
- postgres: 5432

## Database: Migration & Seeding

Scripts at repo root (package.json):
```
pnpm db:init          # Initialize database/schema
pnpm db:migrate       # Run migrations
pnpm db:migrate:list  # List migrations
pnpm db:seed          # Seed data
pnpm db:reset         # Reset database
```

Test DB helpers:
```
pnpm db:test:init
pnpm db:test:clean
```

Ensure `DATABASE_URL` (and `TEST_DATABASE_URL`) are configured. Migrations live in `backend/migrations/`; SQL sources in `backend/db/queries/`. SQLC-generated code in `backend/internal/database/sqlc/`.

## CI (Outline)

Recommended GitHub Actions jobs:
1) checks
   - pnpm install
   - pnpm turbo run lint type-check test
2) build
   - pnpm turbo run build
3) docker-build
   - Build and push images for apps/services
Remote cache:
- Configure `TURBO_TOKEN` + `TURBO_TEAM`. Consider `TURBO_REMOTE_ONLY=true` in CI.

## Troubleshooting

- Next build data fetch failures:
  - Ensure NEXT_PUBLIC_API_URL is reachable in build environment; if not, use ISR fallbacks/mocks.

- ESLint config:
  - `.eslintrc.js` uses `plugin:@typescript-eslint/recommended`. Ensure devDeps include `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`.

- Turborepo per-package config:
  - Ensure per-app `turbo.json` has `"extends": ["//"]`.

- Port conflicts:
  - Dev servers auto-select available ports and log them.

## Roadmap

- Decide final backend shape: microservices behind api-gateway vs monolith
- Adopt `golangci-lint` and `.golangci.yml` for Go linting
- Add `.air.toml` for Go live reload
- CI pipelines for PR checks and image publishing
- Optional: Remote cache in CI via Turbo token/team

## License

Proprietary – All rights reserved.
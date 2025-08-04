Microservices Migration – Phase 1 (Scaffold + Compose)

Overview
This commit scaffolds the microservices structure and shared libraries, adds minimal runnable stubs (health + metrics) for all services and the API Gateway, and updates docker-compose to orchestrate the new topology alongside CouchDB. Legacy backend/ remains intact.

What’s Included
1) Shared libraries
- shared/go-logger: Structured logging via slog with simple context helpers.
- shared/go-metrics: Prometheus registry with HTTP server and basic HTTP instrumentation.
- shared/go-jwt: JWT keypair load/generate, issue/verify, JWKS, and header extraction helpers.
- go.work: Workspace tying together all modules.

2) API Gateway
- api-gateway: go.mod, Dockerfile, minimal HTTP server with /health and /health/*, metrics server, and a CORS-capable gateway scaffold (internal/gateway/server.go). gRPC-Gateway registration will be wired after proto migration.

3) Services (auth, content, media, contact)
- go.mod per service with grpc/protobuf deps and replaces to shared libraries.
- Minimal cmd/main.go per service:
  - Starts gRPC server with standard health service registered.
  - Starts HTTP server exposing /health (for docker healthchecks) with metrics middleware.
  - Exposes METRICS_ADDR for Prometheus scraping (default :9100 in-container).
- Dockerfiles for all services and gateway, using multi-stage build with distroless runtime.

4) Compose
- docker-compose.yml updated in place to use the new services plus couchdb.
- docker/docker-compose.dev.yml, docker/docker-compose.prod.yml, docker/docker-compose.test.yml added for environment-specific workflows.
- Legacy backend included under profiles: ["legacy"]; not run by default.

Next Steps (Phase 2+)
- Move all proto definitions under shared/proto and generate stubs for services/*/gen and gateway handlers.
- Extract logic from backend/internal into the respective services:
  - Auth: JWT auth, sessions/refresh, JWKS.
  - Content: Pages + Blog CRUD/list/search/rss.
  - Media: Upload/list/get/delete/update with storage abstraction.
  - Contact: Form submit/list/... + Email service.
- Wire gRPC-Gateway registrations in API Gateway to services:
  - auth:9101, content:9102, media:9103, contact:9104
- Add CORS, Authorization passthrough, timeouts, and OpenAPI (optional).
- Update apps/website and apps/cms to use NEXT_PUBLIC_API_URL against API Gateway.
- Run Docker-only E2E and gradually decommission monolith once green.

Environment Variables (defaults used in compose)
- SERVICE_NAME: service label for logs.
- LOG_LEVEL, LOG_FORMAT: logging configuration.
- METRICS_ADDR: address for Prometheus metrics (per service).
- GRPC_ADDR: gRPC bind address (per service).
- HTTP_ADDR: HTTP health endpoint bind address (per service).
- COUCHDB_URL: connection string for repositories (to be used when logic is migrated).
- JWT_*: keys for auth service (private/public PEM, kid).

Run (dev)
docker compose -f docker/docker-compose.dev.yml up --build

Run (root compose)
docker compose up --build

Notes
- This is a scaffold: business logic and proto-generated code will be introduced next.
- Health and metrics endpoints allow early orchestration and deployment testing.
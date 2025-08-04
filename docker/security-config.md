# Docker Security Configuration

## Security Hardening Measures Implemented

### 1. Non-Root User Execution
All containers run as non-root users for security:
- **Frontend Apps (Website/CMS)**: `nextjs:nodejs` (UID 1001:GID 1001)
- **Backend Services**: `appuser:appgroup` (UID 1001:GID 1001)
- **Go Services**: `nonroot:nonroot` (distroless default)

### 2. Minimal Base Images
- **Frontend Apps**: `node:22-alpine` (minimal Alpine Linux)
- **Backend**: `alpine:3.20` (minimal Alpine Linux)
- **Go Services**: `gcr.io/distroless/static-debian12:nonroot` (Google distroless)

### 3. Security Build Flags
Go services built with security hardening:
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-s -w -extldflags \"-static\"" \
  -a -installsuffix cgo \
  -trimpath
```

### 4. Multi-Stage Builds
All Dockerfiles use multi-stage builds to:
- Minimize final image size
- Remove build tools from production images
- Separate build and runtime dependencies

### 5. File Permissions
- All files copied with proper ownership (`--chown=user:group`)
- Directories created with appropriate permissions
- No world-writable files or directories

### 6. Signal Handling
All containers use `dumb-init` for proper signal handling and zombie process reaping.

### 7. Health Checks
Production containers include health checks with appropriate timeouts and retry logic.

## Security Scanning

### Container Vulnerability Scanning
Use the following commands to scan for vulnerabilities:

```bash
# Scan Node.js containers
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image saas-platform/website:latest

# Scan Go containers
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image saas-platform/backend:latest
```

### Dependency Scanning
```bash
# Scan npm dependencies
pnpm audit --audit-level moderate

# Scan Go dependencies
go list -json -deps ./... | nancy sleuth
```

## Security Best Practices Checklist

- [x] Non-root user execution
- [x] Minimal base images (Alpine/Distroless)
- [x] Multi-stage builds
- [x] Security build flags for Go
- [x] Proper file permissions
- [x] Signal handling with dumb-init
- [x] Health checks
- [x] No unnecessary packages
- [x] Static binary compilation
- [x] Stripped binaries (-s -w flags)

## Compliance

This configuration follows:
- NIST Container Security Guidelines
- CIS Docker Benchmark
- OWASP Container Security Top 10
- Docker Security Best Practices
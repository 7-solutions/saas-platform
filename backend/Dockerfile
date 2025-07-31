# Multi-stage optimized Dockerfile for Go Backend
# Stage 1: Base - Common Go environment
FROM golang:1.24-alpine AS base

# Install essential build dependencies
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata

# Set working directory
WORKDIR /app

# Stage 2: Dependencies - Download and cache Go modules
FROM base AS deps

# Copy go module files for optimal layer caching
COPY go.mod go.sum ./

# Download dependencies with module cache mount for faster builds
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download && go mod verify

# Stage 3: Builder - Build the application
FROM base AS builder

# Copy cached modules from deps stage
COPY --from=deps /go/pkg/mod /go/pkg/mod

# Copy go module files
COPY go.mod go.sum ./

# Copy source code
COPY . .

# Build the application with optimizations and build cache
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -trimpath \
    -o main ./cmd/api

# Stage 4: Runner - Minimal production runtime
FROM alpine:3.20 AS runner

# Install only essential runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    dumb-init && \
    # Create non-root user for security
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser --ingroup appgroup

# Set working directory
WORKDIR /app

# Copy binary from builder stage with proper ownership
COPY --from=builder --chown=appuser:appgroup /app/main .

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/logs && \
    chown -R appuser:appgroup /app

# Security: Switch to non-root user
USER appuser

# Expose ports (gRPC and HTTP gateway)
EXPOSE 8080 9090

# Environment variables
ENV GIN_MODE=release \
    GO_ENV=production

# Health check with minimal overhead
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["./main"]
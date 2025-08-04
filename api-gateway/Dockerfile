# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /src

# Enable reproducible builds metadata
ARG VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

# Do NOT copy go.work into the image; each module builds independently in Docker
COPY api-gateway/go.mod api-gateway/go.mod
COPY shared/go-logger shared/go-logger
COPY shared/go-metrics shared/go-metrics
COPY shared/go-jwt shared/go-jwt
COPY api-gateway api-gateway

WORKDIR /src/api-gateway
# Build with cache mounts, static binary, security hardening, and metadata
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -ldflags="-s -w -extldflags \"-static\" -X main.version=${VERSION} -X main.commit=${GIT_SHA} -X main.date=${BUILD_TIME}" \
      -a -installsuffix cgo \
      -trimpath \
      -o /out/api-gateway ./cmd

# Runtime stage (distroless static - most minimal and secure)
FROM gcr.io/distroless/static-debian12:nonroot
ENV SERVICE_NAME=api-gateway
WORKDIR /app
COPY --from=builder /out/api-gateway /app/api-gateway
EXPOSE 8080 9090
USER nonroot:nonroot
ENTRYPOINT ["/app/api-gateway"]
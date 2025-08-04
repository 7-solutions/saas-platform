# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /src

# Build this module independently; do not bring go.work into image
COPY services/auth/go.mod services/auth/go.mod
COPY shared/go-logger shared/go-logger
COPY shared/go-metrics shared/go-metrics
COPY shared/go-jwt shared/go-jwt
COPY services/auth services/auth

WORKDIR /src/services/auth
# Build with security hardening flags
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags \"-static\"" \
    -a -installsuffix cgo \
    -trimpath \
    -o /out/auth ./cmd

# Runtime stage
FROM gcr.io/distroless/base-debian12:nonroot
ENV SERVICE_NAME=auth
WORKDIR /app
COPY --from=builder /out/auth /app/auth
EXPOSE 8101 9101 9100
USER nonroot:nonroot
ENTRYPOINT ["/app/auth"]
# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /src

# Build this module independently; do not bring go.work into image
COPY services/content/go.mod services/content/go.mod
COPY shared/go-logger shared/go-logger
COPY shared/go-metrics shared/go-metrics
COPY shared/go-jwt shared/go-jwt
COPY services/content services/content

WORKDIR /src/services/content
# Build with security hardening flags
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags \"-static\"" \
    -a -installsuffix cgo \
    -trimpath \
    -o /out/content ./cmd

# Runtime stage
FROM gcr.io/distroless/base-debian12:nonroot
ENV SERVICE_NAME=content
WORKDIR /app
COPY --from=builder /out/content /app/content
EXPOSE 8102 9102 9100
USER nonroot:nonroot
ENTRYPOINT ["/app/content"]
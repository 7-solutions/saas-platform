# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /src

# Build this module independently; do not bring go.work into image
COPY services/media/go.mod services/media/go.mod
COPY shared/go-logger shared/go-logger
COPY shared/go-metrics shared/go-metrics
COPY shared/go-jwt shared/go-jwt
COPY services/media services/media

WORKDIR /src/services/media
# Build with security hardening flags
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags \"-static\"" \
    -a -installsuffix cgo \
    -trimpath \
    -o /out/media ./cmd

# Runtime stage
FROM gcr.io/distroless/base-debian12:nonroot
ENV SERVICE_NAME=media
WORKDIR /app
COPY --from=builder /out/media /app/media
EXPOSE 8103 9103 9100
USER nonroot:nonroot
ENTRYPOINT ["/app/media"]
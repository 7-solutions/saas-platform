# Multi-stage optimized Dockerfile for Website App
# Stage 1: Base - Common dependencies and tools
FROM node:22-alpine AS base

# Install only essential system dependencies
RUN apk add --no-cache \
    libc6-compat \
    dumb-init && \
    # Enable corepack and prepare pnpm
    corepack enable && \
    corepack prepare pnpm@9.15.0 --activate

# Set working directory
WORKDIR /app

# Create non-root user early for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Stage 2: Dependencies - Install packages with optimal caching
FROM base AS deps

# Copy package configuration files for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/website/package.json ./apps/website/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with BuildKit cache mount and fetch optimization
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --prefer-offline

# Stage 3: Builder - Build the application
FROM base AS builder

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/website/node_modules ./apps/website/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Build the application with Next.js optimizations
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Optional build metadata
ARG VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

# Build packages first, then website
RUN pnpm build --filter=@saas-platform/ui && \
    pnpm build --filter=@saas-platform/shared && \
    pnpm build --filter=@saas-platform/website

# Stage 4: Runner - Minimal production runtime
FROM node:22-alpine AS runner

# Install only runtime essentials
RUN apk add --no-cache \
    dumb-init && \
    # Create non-root user
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/static ./apps/website/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/public ./apps/website/public

# Security: Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment variables for production
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

# Health check with minimal overhead
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/website/server.js"]
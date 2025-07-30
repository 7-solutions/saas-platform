# Production Dockerfile for Website
FROM node:22-alpine AS base

# Install dependencies and enable corepack for pnpm
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev && \
    corepack enable && \
    corepack prepare pnpm@9.15.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* ./
COPY apps/website/package.json ./apps/website/
COPY packages/*/package.json ./packages/*/

# Install production dependencies only with BuildKit cache mount
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy package files first
COPY package.json pnpm-lock.yaml* ./
COPY apps/website/package.json ./apps/website/
COPY packages/*/package.json ./packages/*/

# Install all dependencies (including dev) with BuildKit cache mount
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code (after dependencies for better caching)
COPY . .

# Build the application with optimizations
RUN pnpm build --filter=website && \
    pnpm prune --prod

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -G nodejs

# Copy built application
COPY --from=builder /app/apps/website/.next/standalone ./
COPY --from=builder /app/apps/website/.next/static ./apps/website/.next/static
COPY --from=builder /app/apps/website/public ./apps/website/public

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "apps/website/server.js"]
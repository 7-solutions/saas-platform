# Next.js 15.4.5 Upgrade & Docker Optimization Plan

## 📊 Current State Analysis

### Current Versions
- **Next.js**: 14.2.30 → Target: 15.4.5
- **React**: 18.2.0 → Target: 18.3.1 (React 19 compatibility)
- **Node.js**: 24-slim (Docker)
- **pnpm**: 8.15.0 → Target: 9.15.0
- **Tailwind CSS**: 4.1.11 (causing PostCSS issues)
- **TypeScript**: 5.3.0 → Target: 5.7.2

### Current Issues Identified
1. **CSS not loading** - Tailwind v4 PostCSS configuration issues
2. **Container failures** - Next.js binary not found in containers
3. **Workspace conflicts** - pnpm workspace configuration issues
4. **Outdated dependencies** - Multiple packages need updates
5. **Docker inefficiencies** - Large build contexts, no layer optimization

## 🎯 Upgrade Strategy

### Phase 1: Dependency Updates & Compatibility
**Priority: HIGH | Duration: 2-3 hours**

#### 1.1 Core Framework Updates
```json
{
  "next": "^15.4.5",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1"
}
```

#### 1.2 Build Tool Updates
```json
{
  "typescript": "^5.7.2",
  "turbo": "^2.3.0",
  "pnpm": "^9.15.0",
  "@types/node": "^22.10.0"
}
```

#### 1.3 CSS Framework Stabilization
```json
{
  "tailwindcss": "^3.4.17",
  "@tailwindcss/forms": "^0.5.9",
  "autoprefixer": "^10.4.20",
  "postcss": "^8.5.11"
}
```

### Phase 2: Next.js 15 Configuration Updates
**Priority: HIGH | Duration: 1-2 hours**

#### 2.1 Next.js Config Modernization
- Update `next.config.js` for v15 compatibility
- Enable new performance optimizations
- Configure React Compiler (if stable)
- Update image optimization settings

#### 2.2 App Router Enhancements
- Leverage new caching strategies
- Implement Partial Prerendering (PPR)
- Update metadata API usage
- Optimize loading patterns

#### 2.3 TypeScript Configuration
- Update `tsconfig.json` for Next.js 15
- Enable new TypeScript features
- Update path mappings
- Configure strict mode enhancements

### Phase 3: Docker Optimization
**Priority: MEDIUM | Duration: 2-3 hours**

#### 3.1 Multi-stage Build Optimization
```dockerfile
# Optimized Dockerfile structure
FROM node:22-alpine AS base
FROM base AS deps
FROM base AS builder  
FROM base AS runner
```

#### 3.2 Layer Caching Improvements
- Separate dependency installation layers
- Optimize COPY instructions order
- Implement .dockerignore optimization
- Use BuildKit features

#### 3.3 Container Size Reduction
- Use Alpine Linux base images
- Remove unnecessary packages
- Implement distroless final stage
- Optimize node_modules handling

### Phase 4: Performance & Security Enhancements
**Priority: MEDIUM | Duration: 1-2 hours**

#### 4.1 Build Performance
- Implement Turbo caching
- Optimize pnpm workspace configuration
- Enable parallel builds
- Configure build output optimization

#### 4.2 Security Hardening
- Update vulnerable dependencies
- Implement security headers
- Configure CSP policies
- Add dependency scanning

## 🔧 Implementation Steps

### Step 1: Prepare Environment
```bash
# Backup current state
git checkout -b nextjs-15-upgrade
docker-compose down
cp pnpm-lock.yaml pnpm-lock.yaml.backup
```

### Step 2: Update Package Manager
```bash
# Update pnpm globally
npm install -g pnpm@9.15.0
# Update package.json packageManager field
```

### Step 3: Update Dependencies (Staged Approach)

#### 3.1 Core Dependencies
```bash
# Root package.json updates
pnpm add -D typescript@^5.7.2 turbo@^2.3.0 @types/node@^22.10.0

# Website app updates  
pnpm --filter website add next@^15.4.5 react@^18.3.1 react-dom@^18.3.1
pnpm --filter website add -D @types/react@^18.3.12 @types/react-dom@^18.3.1

# CMS app updates
pnpm --filter cms add next@^15.4.5 react@^18.3.1 react-dom@^18.3.1
pnpm --filter cms add -D @types/react@^18.3.12 @types/react-dom@^18.3.1
```

#### 3.2 CSS Framework Stabilization
```bash
# Remove Tailwind v4 (causing issues)
pnpm --filter website remove @tailwindcss/postcss tailwindcss
pnpm --filter cms remove @tailwindcss/postcss tailwindcss

# Install stable Tailwind v3
pnpm --filter website add -D tailwindcss@^3.4.17 @tailwindcss/forms@^0.5.9
pnpm --filter cms add -D tailwindcss@^3.4.17 @tailwindcss/forms@^0.5.9
```

### Step 4: Configuration Updates

#### 4.1 Next.js Configuration
```javascript
// apps/website/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@saas-platform/ui', '@saas-platform/shared'],
  experimental: {
    ppr: 'incremental', // Partial Prerendering
    reactCompiler: false, // Enable when stable
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/uploads/**',
      },
    ],
  },
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
};
```

#### 4.2 PostCSS Configuration Fix
```javascript
// apps/website/postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Step 5: Docker Optimization

#### 5.1 Optimized Dockerfile
```dockerfile
# apps/website/Dockerfile.dev
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/website/package.json ./apps/website/
COPY packages/*/package.json ./packages/*/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build --filter=website

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/static ./apps/website/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/public ./apps/website/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/website/server.js"]
```

#### 5.2 Enhanced .dockerignore
```
# Development files
.git
.gitignore
README.md
Dockerfile*
.dockerignore

# Dependencies
node_modules
npm-debug.log*
.pnpm-debug.log*

# Build outputs
.next
out
dist
build

# Environment files
.env*
!.env.example

# IDE files
.vscode
.idea
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Testing
coverage
.nyc_output
test-results
playwright-report

# Misc
*.log
*.tgz
*.tar.gz
```

### Step 6: Testing & Validation

#### 6.1 Build Testing
```bash
# Test local builds
pnpm build
pnpm type-check
pnpm lint

# Test Docker builds
docker-compose build --no-cache
docker-compose up -d
```

#### 6.2 Performance Testing
```bash
# Run performance tests
pnpm test:e2e
curl -o /dev/null -s -w "%{time_total}\n" http://localhost:3000
```

## 🚨 Breaking Changes & Migration Notes

### Next.js 15 Breaking Changes
1. **Minimum Node.js version**: 18.18.0+ (we're using 22)
2. **React 19 compatibility**: Optional, staying with React 18.3.1
3. **Caching behavior changes**: Review and update caching strategies
4. **TypeScript strict mode**: May require code updates

### CSS Framework Changes
1. **Tailwind v4 → v3**: Revert to stable version
2. **PostCSS configuration**: Simplified setup
3. **Build process**: More reliable compilation

### Docker Changes
1. **Multi-stage optimization**: Smaller final images
2. **Layer caching**: Faster rebuilds
3. **Security improvements**: Non-root user, minimal attack surface

## 📈 Expected Benefits

### Performance Improvements
- **Build time**: 30-50% faster with optimized Docker layers
- **Bundle size**: 10-15% smaller with Next.js 15 optimizations
- **Runtime performance**: 5-10% improvement with new caching
- **Development experience**: Faster hot reloads and builds

### Reliability Improvements
- **CSS loading**: Fixed Tailwind compilation issues
- **Container stability**: Resolved Next.js binary issues
- **Dependency management**: Cleaner workspace configuration
- **Type safety**: Enhanced TypeScript support

### Security Improvements
- **Updated dependencies**: Latest security patches
- **Container hardening**: Non-root user, minimal base image
- **Build security**: Reduced attack surface

## 🎯 Success Metrics

### Technical Metrics
- [ ] All containers start successfully
- [ ] CSS loads correctly on all pages
- [ ] Build time < 2 minutes (currently ~5 minutes)
- [ ] Bundle size reduction measurable
- [ ] Zero TypeScript errors
- [ ] All tests passing

### User Experience Metrics
- [ ] Page load time < 1 second
- [ ] Hot reload time < 500ms
- [ ] No visual regressions
- [ ] Mobile responsiveness maintained

## 🔄 Rollback Plan

### Quick Rollback
```bash
git checkout main
docker-compose down
docker-compose up --build -d
```

### Dependency Rollback
```bash
cp pnpm-lock.yaml.backup pnpm-lock.yaml
pnpm install
```

### Container Rollback
```bash
docker-compose down
docker system prune -f
git checkout main -- apps/*/Dockerfile*
docker-compose up --build -d
```

## 📅 Timeline

### Day 1 (4-6 hours)
- [ ] Phase 1: Dependency Updates
- [ ] Phase 2: Next.js Configuration
- [ ] Initial testing and validation

### Day 2 (3-4 hours)  
- [ ] Phase 3: Docker Optimization
- [ ] Phase 4: Performance Enhancements
- [ ] Comprehensive testing

### Day 3 (1-2 hours)
- [ ] Final validation
- [ ] Performance benchmarking
- [ ] Documentation updates

**Total Estimated Time: 8-12 hours**

## 🤝 Next Steps

1. **Review and approve** this plan
2. **Schedule maintenance window** for the upgrade
3. **Create feature branch** for the work
4. **Begin Phase 1** with dependency updates
5. **Test incrementally** after each phase
6. **Document any issues** encountered
7. **Update team** on progress and changes

---

*This plan prioritizes stability and performance while minimizing downtime and breaking changes.*
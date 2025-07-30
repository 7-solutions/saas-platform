# SaaS Startup Platform

A comprehensive SaaS & Tech Startup platform built with modern technologies including Next.js, Go, gRPC, and CouchDB.

## Architecture

- **Frontend**: Next.js with TypeScript, Tailwind CSS, and shadcn/ui
- **Backend**: Go with gRPC and REST API via gRPC Gateway
- **Database**: CouchDB for document storage
- **Development**: Docker for containerization
- **Monorepo**: Turborepo for build orchestration

## Project Structure

```
├── apps/
│   ├── website/          # Public-facing Next.js website
│   └── cms/              # Content management system
├── packages/
│   ├── ui/               # Shared UI components
│   └── shared/           # Shared utilities and types
├── backend/              # Go gRPC API server
├── scripts/              # Development and database scripts
└── docker-compose.yml    # Container orchestration
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Go 1.21+
- Docker and Docker Compose

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd saas-startup-platform
   pnpm setup
   ```

2. **Start development environment**:
   ```bash
   pnpm dev:containers
   ```

3. **Initialize database**:
   ```bash
   pnpm db:init
   ```

## Production Deployment

For production deployment instructions, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).

Quick production deployment:
```bash
# Configure environment
cp .env.production.example .env.production
# Edit .env.production with your values

# Deploy to production
./scripts/deploy-production.sh
```
   ```

4. **Access applications**:
   - Public Website: http://localhost:3000
   - CMS Dashboard: http://localhost:3001
   - API Documentation: http://localhost:8080/docs
   - CouchDB Admin: http://localhost:5984/_utils

## Development Commands

### Container Management
- `pnpm containers:up` - Start all services
- `pnpm containers:down` - Stop all services
- `pnpm containers:logs` - View service logs
- `pnpm containers:build` - Rebuild containers
- `pnpm containers:clean` - Clean up containers and volumes

### Development
- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all applications
- `pnpm lint` - Run linting across all packages
- `pnpm lint:fix` - Fix linting issues
- `pnpm test` - Run all tests
- `pnpm type-check` - Run TypeScript type checking

### Database
- `pnpm db:init` - Initialize database with design documents
- `pnpm db:reset` - Reset database to clean state

### Utilities
- `pnpm format` - Format code with Prettier
- `pnpm clean` - Clean build artifacts
- `pnpm reset` - Complete reset of project and containers

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Development Workflow

1. **Start containers**: `pnpm containers:up`
2. **Initialize database**: `pnpm db:init`
3. **Start development**: `pnpm dev`
4. **Make changes** - Hot reloading is enabled for all services
5. **Run tests**: `pnpm test`
6. **Build for production**: `pnpm build`

## Services

### Public Website (Port 3000)
- Next.js application for public-facing website
- Server-side rendering and static generation
- Responsive design with Tailwind CSS

### CMS Dashboard (Port 3001)
- Next.js application for content management
- Authentication with NextAuth.js
- Rich text editor for content creation

### Backend API (Port 8080/9090)
- Go gRPC server with REST gateway
- JWT authentication
- CouchDB integration

### CouchDB (Port 5984)
- Document database for content storage
- Admin interface available at /_utils
- Automatic view creation and indexing

## Troubleshooting

### Container Issues
- Check container status: `docker ps`
- View logs: `pnpm containers:logs`
- Rebuild containers: `pnpm containers:build`

### Database Issues
- Reset database: `pnpm db:reset`
- Check CouchDB health: `curl http://localhost:5984/_up`

### Build Issues
- Clean and rebuild: `pnpm reset`
- Check TypeScript: `pnpm type-check`

## Contributing

1. Follow the established code style
2. Run tests before committing
3. Use conventional commit messages
4. Update documentation as needed

## License

[Your License Here]
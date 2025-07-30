# Backend API

This is the Go backend API for the SaaS Startup Platform, built with gRPC and gRPC Gateway.

## Architecture

- **gRPC Services**: Core business logic implemented as gRPC services
- **gRPC Gateway**: Automatic REST API generation from gRPC definitions
- **Protocol Buffers**: Type-safe API definitions and code generation
- **Middleware**: Authentication, logging, and CORS support

## Services

### Auth Service (`/auth/v1`)
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/validate` - Token validation
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

### Content Service (`/content/v1`)
- `GET /api/v1/pages` - List pages (public)
- `GET /api/v1/pages/{id}` - Get page by ID (public)
- `POST /api/v1/pages` - Create page (requires auth)
- `PUT /api/v1/pages/{id}` - Update page (requires auth)
- `DELETE /api/v1/pages/{id}` - Delete page (requires auth)

### Media Service (`/media/v1`)
- `GET /api/v1/media` - List files (requires auth)
- `GET /api/v1/media/{id}` - Get file info (requires auth)
- `POST /api/v1/media/upload` - Upload file (requires auth)
- `PUT /api/v1/media/{id}` - Update file metadata (requires auth)
- `DELETE /api/v1/media/{id}` - Delete file (requires auth)

## Development

### Prerequisites
- Go 1.21+
- Protocol Buffers compiler (`protoc`)
- gRPC Go plugins

### Building
```bash
# Generate protobuf code
./scripts/generate-proto.sh

# Build the API server
go build -o bin/api ./cmd/api

# Run the server
./bin/api
```

### Environment Variables
- `GRPC_PORT`: gRPC server port (default: 9090)
- `HTTP_PORT`: HTTP gateway port (default: 8080)

## Project Structure

```
backend/
├── cmd/api/           # Main application entry point
├── internal/
│   ├── server/        # Server setup and middleware
│   └── services/      # gRPC service implementations
├── proto/             # Protocol buffer definitions
├── gen/               # Generated protobuf code
├── scripts/           # Build and utility scripts
└── third_party/       # Third-party protobuf definitions
```

## Features Implemented

✅ Go module structure with proper dependencies  
✅ Protocol Buffer schemas for Auth, Content, and Media services  
✅ Generated Go gRPC server and client code  
✅ Basic gRPC server setup with middleware  
✅ gRPC Gateway for REST API exposure  
✅ Authentication middleware with JWT placeholder  
✅ Logging middleware for request tracking  
✅ CORS middleware for web client support  
✅ Placeholder service implementations  

## Next Steps

The current implementation provides a solid foundation with placeholder service methods. Future tasks will implement:

- CouchDB repository layer for data persistence
- JWT token generation and validation
- File upload and storage handling
- Input validation and error handling
- Comprehensive testing suite
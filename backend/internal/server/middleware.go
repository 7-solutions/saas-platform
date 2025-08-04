package server

import (
	"context"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/7-solutions/saas-platformbackend/internal/utils/auth"
	"github.com/7-solutions/saas-platformbackend/internal/utils/logger"
)

// LoggingInterceptor logs gRPC requests with structured logging
func LoggingInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	start := time.Now()

	// Add request ID to context for tracing
	requestID := generateRequestID()
	ctx = context.WithValue(ctx, "request_id", requestID)

	// Call the handler
	resp, err := handler(ctx, req)

	// Log the request with structured logging
	duration := time.Since(start)
	statusCode := 200
	if err != nil {
		if st, ok := status.FromError(err); ok {
			statusCode = int(st.Code())
		} else {
			statusCode = 500
		}
	}

	logger.LogRequest(ctx, "gRPC", info.FullMethod, duration, statusCode, err)

	return resp, err
}

// PanicRecoveryInterceptor recovers from panics and logs them
func PanicRecoveryInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
	defer func() {
		if r := recover(); r != nil {
			logger.LogPanic(ctx, r, "gRPC handler panic")
			err = status.Errorf(codes.Internal, "internal server error")
		}
	}()

	return handler(ctx, req)
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString generates a random string of given length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// AuthInterceptor handles authentication for protected endpoints
func AuthInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	// Skip authentication for login and public endpoints
	if isPublicEndpoint(info.FullMethod) {
		return handler(ctx, req)
	}

	// Extract token from metadata
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "missing metadata")
	}

	authHeader := md.Get("authorization")
	if len(authHeader) == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "missing authorization header")
	}

	// Extract token from Bearer header
	token, err := auth.ExtractTokenFromHeader(authHeader[0])
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid authorization header: %v", err)
	}

	// Validate JWT token
	claims, err := auth.ValidateToken(token)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}

	// Add user info to context
	ctx = context.WithValue(ctx, "user_id", claims.UserID)
	ctx = context.WithValue(ctx, "user_email", claims.Email)
	ctx = context.WithValue(ctx, "user_role", claims.Role)
	ctx = context.WithValue(ctx, "user_name", claims.Username)

	return handler(ctx, req)
}

// AuthorizeRole creates an interceptor that checks if user has required role
func AuthorizeRole(requiredRole string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Skip authorization for public endpoints
		if isPublicEndpoint(info.FullMethod) {
			return handler(ctx, req)
		}

		// Get user role from context (set by AuthInterceptor)
		userRole, ok := ctx.Value("user_role").(string)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "user role not found in context")
		}

		// Check if user has required role
		if !hasRequiredRole(userRole, requiredRole) {
			return nil, status.Errorf(codes.PermissionDenied, "insufficient permissions: required %s, got %s", requiredRole, userRole)
		}

		return handler(ctx, req)
	}
}

// hasRequiredRole checks if user role meets the requirement
func hasRequiredRole(userRole, requiredRole string) bool {
	// Define role hierarchy: admin > editor > viewer
	roleHierarchy := map[string]int{
		"admin":  3,
		"editor": 2,
		"viewer": 1,
	}

	userLevel, userExists := roleHierarchy[userRole]
	requiredLevel, requiredExists := roleHierarchy[requiredRole]

	if !userExists || !requiredExists {
		return false
	}

	return userLevel >= requiredLevel
}

// GetUserFromContext extracts user information from context
func GetUserFromContext(ctx context.Context) (userID, email, role, name string, ok bool) {
	userID, ok1 := ctx.Value("user_id").(string)
	email, ok2 := ctx.Value("user_email").(string)
	role, ok3 := ctx.Value("user_role").(string)
	name, ok4 := ctx.Value("user_name").(string)

	return userID, email, role, name, ok1 && ok2 && ok3 && ok4
}

// RequireAdmin checks if the user is an admin
func RequireAdmin(ctx context.Context) error {
	userRole, ok := ctx.Value("user_role").(string)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "user role not found in context")
	}

	if userRole != "admin" {
		return status.Errorf(codes.PermissionDenied, "admin role required")
	}

	return nil
}

// RequireEditor checks if the user is at least an editor
func RequireEditor(ctx context.Context) error {
	userRole, ok := ctx.Value("user_role").(string)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "user role not found in context")
	}

	if !hasRequiredRole(userRole, "editor") {
		return status.Errorf(codes.PermissionDenied, "editor role or higher required")
	}

	return nil
}

// isPublicEndpoint checks if an endpoint requires authentication
func isPublicEndpoint(method string) bool {
	publicEndpoints := []string{
		"/auth.v1.AuthService/Login",
		"/content.v1.ContentService/GetPage",
		"/content.v1.ContentService/ListPages",
		"/contact.v1.ContactService/SubmitContactForm",
	}

	for _, endpoint := range publicEndpoints {
		if method == endpoint {
			return true
		}
	}
	return false
}

// getEndpointRoleRequirement returns the minimum role required for an endpoint
func getEndpointRoleRequirement(method string) string {
	// Define role requirements for different endpoints
	roleRequirements := map[string]string{
		// Auth endpoints
		"/auth.v1.AuthService/ValidateToken": "viewer",
		"/auth.v1.AuthService/RefreshToken":  "viewer",
		"/auth.v1.AuthService/Logout":        "viewer",

		// Content endpoints
		"/content.v1.ContentService/CreatePage": "editor",
		"/content.v1.ContentService/UpdatePage": "editor",
		"/content.v1.ContentService/DeletePage": "admin",

		// Media endpoints
		"/media.v1.MediaService/UploadFile": "editor",
		"/media.v1.MediaService/DeleteFile": "editor",
	}

	if role, exists := roleRequirements[method]; exists {
		return role
	}

	// Default to viewer role for authenticated endpoints
	return "viewer"
}

// corsMiddleware adds CORS headers for HTTP requests
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

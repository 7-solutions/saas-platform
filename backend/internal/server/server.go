package server

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/saas-startup-platform/backend/gen/auth/v1"
	contactv1 "github.com/saas-startup-platform/backend/gen/contact/v1"
	contentv1 "github.com/saas-startup-platform/backend/gen/content/v1"
	mediav1 "github.com/saas-startup-platform/backend/gen/media/v1"
	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/repository"
	"github.com/saas-startup-platform/backend/internal/services"
	"github.com/saas-startup-platform/backend/internal/utils/logger"
	"github.com/saas-startup-platform/backend/internal/utils/metrics"
)

// Server represents the gRPC server
type Server struct {
	grpcServer     *grpc.Server
	httpServer     *http.Server
	metricsServer  *http.Server
	dbClient       *database.Client
	authSvc        *services.AuthService
	contentSvc     *services.ContentService
	mediaSvc       *services.MediaService
	contactSvc     *services.ContactService
	alertingSvc    *services.AlertingService
	errorHandler   *ErrorHandler
	healthChecker  *HealthChecker
	metrics        *metrics.Metrics
}

// NewServer creates a new server instance
func NewServer() (*Server, error) {
	// Initialize database client
	dbConfig := database.Config{
		URL:      getEnvOrDefault("COUCHDB_URL", "http://localhost:5984"),
		Username: getEnvOrDefault("COUCHDB_USERNAME", "admin"),
		Password: getEnvOrDefault("COUCHDB_PASSWORD", "password"),
		Database: getEnvOrDefault("COUCHDB_DATABASE", "saas_platform"),
	}
	
	dbClient, err := database.NewClient(dbConfig)
	if err != nil {
		return nil, err
	}

	// Setup database views
	ctx := context.Background()
	if err := dbClient.SetupViews(ctx); err != nil {
		log.Printf("Warning: Failed to setup database views: %v", err)
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(dbClient)
	pageRepo := repository.NewPageRepository(dbClient)
	blogRepo := repository.NewBlogRepository(dbClient)
	mediaRepo := repository.NewMediaRepository(dbClient)
	contactRepo := repository.NewContactRepository(dbClient)

	// Initialize email service
	emailSvc := services.NewEmailService()

	// Initialize services with repositories
	authSvc := services.NewAuthService(userRepo)
	contentSvc := services.NewContentService(pageRepo, blogRepo)
	mediaSvc := services.NewMediaService(mediaRepo)
	contactSvc := services.NewContactService(contactRepo, emailSvc)
	errorSvc := services.NewErrorReportingService(dbClient)
	
	// Initialize alerting service
	webhookURL := getEnvOrDefault("ALERT_WEBHOOK_URL", "http://localhost:8080/api/v1/alerts/webhook")
	alertingSvc := services.NewAlertingService(webhookURL, emailSvc)

	// Initialize logger
	logger.InitGlobalLogger(logger.Config{
		Service: "saas-platform-api",
		Level:   logger.LogLevel(getEnvOrDefault("LOG_LEVEL", "INFO")),
		Format:  "json",
	})

	// Initialize metrics
	metrics.InitGlobalMetrics()
	metricsInstance := metrics.GetGlobalMetrics()

	// Create gRPC server with middleware
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			PanicRecoveryInterceptor,
			LoggingInterceptor,
			AuthInterceptor,
		),
	)

	// Register services
	authv1.RegisterAuthServiceServer(grpcServer, authSvc)
	contentv1.RegisterContentServiceServer(grpcServer, contentSvc)
	mediav1.RegisterMediaServiceServer(grpcServer, mediaSvc)
	contactv1.RegisterContactServiceServer(grpcServer, contactSvc)

	server := &Server{
		grpcServer:  grpcServer,
		dbClient:    dbClient,
		authSvc:     authSvc,
		contentSvc:  contentSvc,
		mediaSvc:    mediaSvc,
		contactSvc:  contactSvc,
		alertingSvc: alertingSvc,
		metrics:     metricsInstance,
	}

	// Initialize error handler
	server.errorHandler = NewErrorHandler(errorSvc)
	
	// Initialize health checker
	version := getEnvOrDefault("APP_VERSION", "1.0.0")
	server.healthChecker = NewHealthChecker(server, version)

	// Start system metrics collection
	metricsCtx := context.Background()
	metrics.StartSystemMetricsCollection(metricsCtx)

	return server, nil
}

// StartGRPC starts the gRPC server
func (s *Server) StartGRPC(port string) error {
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return err
	}

	log.Printf("Starting gRPC server on port %s", port)
	return s.grpcServer.Serve(lis)
}

// StartHTTP starts the HTTP gateway server
func (s *Server) StartHTTP(grpcPort, httpPort string) error {
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Create gRPC Gateway mux
	mux := runtime.NewServeMux()

	// gRPC server endpoint
	grpcEndpoint := "localhost:" + grpcPort
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	// Register service handlers
	err := authv1.RegisterAuthServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts)
	if err != nil {
		return err
	}

	err = contentv1.RegisterContentServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts)
	if err != nil {
		return err
	}

	err = mediav1.RegisterMediaServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts)
	if err != nil {
		return err
	}

	err = contactv1.RegisterContactServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts)
	if err != nil {
		return err
	}

	// Create HTTP mux with additional endpoints
	httpMux := http.NewServeMux()
	
	// Add gRPC Gateway
	httpMux.Handle("/api/v1/", mux)
	
	// Add health check endpoints
	httpMux.HandleFunc("/health", s.healthChecker.HandleHealthCheck)
	httpMux.HandleFunc("/health/live", s.healthChecker.HandleLivenessProbe)
	httpMux.HandleFunc("/health/ready", s.healthChecker.HandleReadinessProbe)
	
	// Add error reporting endpoints
	httpMux.HandleFunc("/api/v1/errors/report", s.errorHandler.HandleErrorReport)
	httpMux.HandleFunc("/api/v1/errors/stats", s.errorHandler.HandleErrorStats)
	
	// Add alerting endpoints
	httpMux.HandleFunc("/api/v1/alerts/webhook", s.alertingSvc.HandleAlertWebhook)

	// Create HTTP server with metrics middleware
	s.httpServer = &http.Server{
		Addr:    ":" + httpPort,
		Handler: corsMiddleware(s.metrics.HTTPMiddleware(httpMux)),
	}

	log.Printf("Starting HTTP gateway server on port %s", httpPort)
	return s.httpServer.ListenAndServe()
}

// StartMetrics starts the metrics server
func (s *Server) StartMetrics(port string) error {
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", s.metrics.MetricsHandler())
	
	s.metricsServer = &http.Server{
		Addr:    ":" + port,
		Handler: metricsMux,
	}
	
	log.Printf("Starting metrics server on port %s", port)
	return s.metricsServer.ListenAndServe()
}

// Stop gracefully stops the server
func (s *Server) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
	if s.httpServer != nil {
		s.httpServer.Close()
	}
	if s.metricsServer != nil {
		s.metricsServer.Close()
	}
	if s.dbClient != nil {
		s.dbClient.Close()
	}
}



// getEnvOrDefault returns environment variable value or default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
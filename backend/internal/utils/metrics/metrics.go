package metrics

import (
	"context"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all application metrics
type Metrics struct {
	// HTTP metrics
	HTTPRequestsTotal     *prometheus.CounterVec
	HTTPRequestDuration   *prometheus.HistogramVec
	HTTPRequestsInFlight  prometheus.Gauge

	// gRPC metrics
	GRPCRequestsTotal     *prometheus.CounterVec
	GRPCRequestDuration   *prometheus.HistogramVec
	GRPCRequestsInFlight  prometheus.Gauge

	// Database metrics
	DatabaseConnectionsActive prometheus.Gauge
	DatabaseQueriesTotal      *prometheus.CounterVec
	DatabaseQueryDuration     *prometheus.HistogramVec

	// Authentication metrics
	AuthLoginAttemptsTotal    *prometheus.CounterVec
	AuthTokenValidationsTotal *prometheus.CounterVec

	// Business metrics
	PagesTotal        prometheus.Gauge
	MediaFilesTotal   prometheus.Gauge
	UsersTotal        prometheus.Gauge
	ContactFormsTotal *prometheus.CounterVec

	// System metrics
	ProcessMemoryBytes    prometheus.Gauge
	ProcessCPUUsage       prometheus.Gauge
	GoroutinesActive      prometheus.Gauge
}

// NewMetrics creates a new metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		// HTTP metrics
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "path"},
		),
		HTTPRequestsInFlight: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "http_requests_in_flight",
				Help: "Number of HTTP requests currently being processed",
			},
		),

		// gRPC metrics
		GRPCRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grpc_requests_total",
				Help: "Total number of gRPC requests",
			},
			[]string{"service", "method", "status"},
		),
		GRPCRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grpc_request_duration_seconds",
				Help:    "gRPC request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method"},
		),
		GRPCRequestsInFlight: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "grpc_requests_in_flight",
				Help: "Number of gRPC requests currently being processed",
			},
		),

		// Database metrics
		DatabaseConnectionsActive: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "database_connections_active",
				Help: "Number of active database connections",
			},
		),
		DatabaseQueriesTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "database_queries_total",
				Help: "Total number of database queries",
			},
			[]string{"operation", "status"},
		),
		DatabaseQueryDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "database_query_duration_seconds",
				Help:    "Database query duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"operation"},
		),

		// Authentication metrics
		AuthLoginAttemptsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "auth_login_attempts_total",
				Help: "Total number of login attempts",
			},
			[]string{"status"},
		),
		AuthTokenValidationsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "auth_token_validations_total",
				Help: "Total number of token validations",
			},
			[]string{"status"},
		),

		// Business metrics
		PagesTotal: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "pages_total",
				Help: "Total number of pages in the system",
			},
		),
		MediaFilesTotal: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "media_files_total",
				Help: "Total number of media files in the system",
			},
		),
		UsersTotal: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "users_total",
				Help: "Total number of users in the system",
			},
		),
		ContactFormsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "contact_forms_total",
				Help: "Total number of contact form submissions",
			},
			[]string{"status"},
		),

		// System metrics
		ProcessMemoryBytes: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "saas_process_memory_bytes",
				Help: "Process memory usage in bytes",
			},
		),
		ProcessCPUUsage: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "saas_process_cpu_usage_percent",
				Help: "CPU usage percentage",
			},
		),
		GoroutinesActive: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "saas_goroutines_active",
				Help: "Number of active goroutines",
			},
		),
	}
}

// RecordHTTPRequest records HTTP request metrics
func (m *Metrics) RecordHTTPRequest(method, path string, statusCode int, duration time.Duration) {
	status := strconv.Itoa(statusCode)
	m.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
	m.HTTPRequestDuration.WithLabelValues(method, path).Observe(duration.Seconds())
}

// RecordGRPCRequest records gRPC request metrics
func (m *Metrics) RecordGRPCRequest(service, method, status string, duration time.Duration) {
	m.GRPCRequestsTotal.WithLabelValues(service, method, status).Inc()
	m.GRPCRequestDuration.WithLabelValues(service, method).Observe(duration.Seconds())
}

// RecordDatabaseQuery records database query metrics
func (m *Metrics) RecordDatabaseQuery(operation, status string, duration time.Duration) {
	m.DatabaseQueriesTotal.WithLabelValues(operation, status).Inc()
	m.DatabaseQueryDuration.WithLabelValues(operation).Observe(duration.Seconds())
}

// RecordLoginAttempt records login attempt metrics
func (m *Metrics) RecordLoginAttempt(success bool) {
	status := "failed"
	if success {
		status = "success"
	}
	m.AuthLoginAttemptsTotal.WithLabelValues(status).Inc()
}

// RecordTokenValidation records token validation metrics
func (m *Metrics) RecordTokenValidation(success bool) {
	status := "failed"
	if success {
		status = "success"
	}
	m.AuthTokenValidationsTotal.WithLabelValues(status).Inc()
}

// RecordContactFormSubmission records contact form submission metrics
func (m *Metrics) RecordContactFormSubmission(success bool) {
	status := "failed"
	if success {
		status = "success"
	}
	m.ContactFormsTotal.WithLabelValues(status).Inc()
}

// UpdateBusinessMetrics updates business-related metrics
func (m *Metrics) UpdateBusinessMetrics(pages, mediaFiles, users int) {
	m.PagesTotal.Set(float64(pages))
	m.MediaFilesTotal.Set(float64(mediaFiles))
	m.UsersTotal.Set(float64(users))
}

// HTTPMiddleware returns HTTP middleware for metrics collection
func (m *Metrics) HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		m.HTTPRequestsInFlight.Inc()
		defer m.HTTPRequestsInFlight.Dec()

		// Wrap response writer to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		next.ServeHTTP(wrapped, r)
		
		duration := time.Since(start)
		m.RecordHTTPRequest(r.Method, r.URL.Path, wrapped.statusCode, duration)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// MetricsHandler returns the Prometheus metrics handler
func (m *Metrics) MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// Global metrics instance
var globalMetrics *Metrics

// InitGlobalMetrics initializes the global metrics instance
func InitGlobalMetrics() {
	globalMetrics = NewMetrics()
}

// GetGlobalMetrics returns the global metrics instance
func GetGlobalMetrics() *Metrics {
	if globalMetrics == nil {
		globalMetrics = NewMetrics()
	}
	return globalMetrics
}

// StartSystemMetricsCollection starts collecting system metrics
func StartSystemMetricsCollection(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				collectSystemMetrics()
			}
		}
	}()
}

// collectSystemMetrics collects system-level metrics
func collectSystemMetrics() {
	metrics := GetGlobalMetrics()
	
	// Update goroutines count
	metrics.GoroutinesActive.Set(float64(runtime.NumGoroutine()))
	
	// Update memory metrics
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	metrics.ProcessMemoryBytes.Set(float64(m.Alloc))
	
	// Note: For production, you might want to use a proper system metrics library
	// like gopsutil to collect CPU metrics and more detailed system information
}
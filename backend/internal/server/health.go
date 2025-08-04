package server

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/utils/logger"
	"github.com/7-solutions/saas-platformbackend/internal/utils/metrics"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusDegraded  HealthStatus = "degraded"
)

// HealthCheck represents a single health check
type HealthCheck struct {
	Name        string                 `json:"name"`
	Status      HealthStatus           `json:"status"`
	Message     string                 `json:"message,omitempty"`
	Duration    string                 `json:"duration"`
	LastChecked time.Time              `json:"last_checked"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// HealthResponse represents the overall health response
type HealthResponse struct {
	Status    HealthStatus  `json:"status"`
	Timestamp time.Time     `json:"timestamp"`
	Version   string        `json:"version"`
	Uptime    string        `json:"uptime"`
	Checks    []HealthCheck `json:"checks"`
	System    SystemInfo    `json:"system"`
}

// SystemInfo represents system information
type SystemInfo struct {
	Goroutines  int    `json:"goroutines"`
	MemoryUsage uint64 `json:"memory_usage_bytes"`
	CPUCount    int    `json:"cpu_count"`
	GoVersion   string `json:"go_version"`
}

// HealthChecker manages health checks
type HealthChecker struct {
	server    *Server
	startTime time.Time
	version   string
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(server *Server, version string) *HealthChecker {
	return &HealthChecker{
		server:    server,
		startTime: time.Now(),
		version:   version,
	}
}

// HandleHealthCheck handles the main health check endpoint
func (hc *HealthChecker) HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	start := time.Now()

	// Perform all health checks
	checks := hc.performHealthChecks(ctx)

	// Determine overall status
	overallStatus := hc.determineOverallStatus(checks)

	// Collect system information
	systemInfo := hc.collectSystemInfo()

	response := HealthResponse{
		Status:    overallStatus,
		Timestamp: time.Now().UTC(),
		Version:   hc.version,
		Uptime:    time.Since(hc.startTime).String(),
		Checks:    checks,
		System:    systemInfo,
	}

	// Set appropriate HTTP status code
	statusCode := http.StatusOK
	if overallStatus == HealthStatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	} else if overallStatus == HealthStatusDegraded {
		statusCode = http.StatusPartialContent
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Error("Failed to encode health check response", err)
	}

	// Record metrics
	duration := time.Since(start)
	metrics.GetGlobalMetrics().RecordHTTPRequest(r.Method, r.URL.Path, statusCode, duration)
}

// HandleLivenessProbe handles Kubernetes liveness probe
func (hc *HealthChecker) HandleLivenessProbe(w http.ResponseWriter, r *http.Request) {
	// Simple liveness check - just return 200 if the service is running
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"alive","timestamp":"` + time.Now().UTC().Format(time.RFC3339) + `"}`))
}

// HandleReadinessProbe handles Kubernetes readiness probe
func (hc *HealthChecker) HandleReadinessProbe(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check critical dependencies for readiness
	checks := []HealthCheck{
		hc.checkDatabase(ctx),
	}

	// If any critical check fails, service is not ready
	for _, check := range checks {
		if check.Status == HealthStatusUnhealthy {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":        "not_ready",
				"timestamp":     time.Now().UTC().Format(time.RFC3339),
				"failed_checks": []string{check.Name},
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ready","timestamp":"` + time.Now().UTC().Format(time.RFC3339) + `"}`))
}

// performHealthChecks performs all health checks
func (hc *HealthChecker) performHealthChecks(ctx context.Context) []HealthCheck {
	return []HealthCheck{
		hc.checkDatabase(ctx),
		hc.checkMemoryUsage(),
		hc.checkGoroutines(),
		hc.checkDiskSpace(),
	}
}

// checkDatabase checks database connectivity
func (hc *HealthChecker) checkDatabase(ctx context.Context) HealthCheck {
	start := time.Now()

	check := HealthCheck{
		Name:        "database",
		LastChecked: start,
	}

	if err := hc.server.dbClient.Ping(ctx); err != nil {
		check.Status = HealthStatusUnhealthy
		check.Message = "Database connection failed: " + err.Error()
	} else {
		check.Status = HealthStatusHealthy
		check.Message = "Database connection successful"
	}

	check.Duration = time.Since(start).String()
	return check
}

// checkMemoryUsage checks memory usage
func (hc *HealthChecker) checkMemoryUsage() HealthCheck {
	start := time.Now()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	check := HealthCheck{
		Name:        "memory",
		LastChecked: start,
		Duration:    time.Since(start).String(),
		Details: map[string]interface{}{
			"alloc_mb":       m.Alloc / 1024 / 1024,
			"total_alloc_mb": m.TotalAlloc / 1024 / 1024,
			"sys_mb":         m.Sys / 1024 / 1024,
			"num_gc":         m.NumGC,
		},
	}

	// Consider unhealthy if using more than 1GB
	if m.Alloc > 1024*1024*1024 {
		check.Status = HealthStatusDegraded
		check.Message = "High memory usage detected"
	} else {
		check.Status = HealthStatusHealthy
		check.Message = "Memory usage normal"
	}

	return check
}

// checkGoroutines checks goroutine count
func (hc *HealthChecker) checkGoroutines() HealthCheck {
	start := time.Now()

	goroutines := runtime.NumGoroutine()

	check := HealthCheck{
		Name:        "goroutines",
		LastChecked: start,
		Duration:    time.Since(start).String(),
		Details: map[string]interface{}{
			"count": goroutines,
		},
	}

	// Consider degraded if more than 1000 goroutines
	if goroutines > 1000 {
		check.Status = HealthStatusDegraded
		check.Message = "High goroutine count detected"
	} else {
		check.Status = HealthStatusHealthy
		check.Message = "Goroutine count normal"
	}

	return check
}

// checkDiskSpace checks available disk space
func (hc *HealthChecker) checkDiskSpace() HealthCheck {
	start := time.Now()

	check := HealthCheck{
		Name:        "disk_space",
		LastChecked: start,
		Duration:    time.Since(start).String(),
		Status:      HealthStatusHealthy,
		Message:     "Disk space check not implemented",
		Details: map[string]interface{}{
			"note": "Disk space monitoring requires platform-specific implementation",
		},
	}

	// TODO: Implement actual disk space checking using syscalls or external library
	// For now, just return healthy status

	return check
}

// determineOverallStatus determines the overall health status
func (hc *HealthChecker) determineOverallStatus(checks []HealthCheck) HealthStatus {
	hasUnhealthy := false
	hasDegraded := false

	for _, check := range checks {
		switch check.Status {
		case HealthStatusUnhealthy:
			hasUnhealthy = true
		case HealthStatusDegraded:
			hasDegraded = true
		}
	}

	if hasUnhealthy {
		return HealthStatusUnhealthy
	}
	if hasDegraded {
		return HealthStatusDegraded
	}
	return HealthStatusHealthy
}

// collectSystemInfo collects system information
func (hc *HealthChecker) collectSystemInfo() SystemInfo {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return SystemInfo{
		Goroutines:  runtime.NumGoroutine(),
		MemoryUsage: m.Alloc,
		CPUCount:    runtime.NumCPU(),
		GoVersion:   runtime.Version(),
	}
}

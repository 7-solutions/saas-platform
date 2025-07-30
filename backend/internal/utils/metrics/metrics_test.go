package metrics

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGlobalMetricsInitialization(t *testing.T) {
	// Test that we can get global metrics without panicking
	metrics := GetGlobalMetrics()
	
	if metrics == nil {
		t.Fatal("GetGlobalMetrics() returned nil")
	}
	
	if metrics.HTTPRequestsTotal == nil {
		t.Error("HTTPRequestsTotal metric not initialized")
	}
	
	if metrics.HTTPRequestDuration == nil {
		t.Error("HTTPRequestDuration metric not initialized")
	}
}

func TestRecordHTTPRequest(t *testing.T) {
	metrics := GetGlobalMetrics()
	
	// Record a test HTTP request - this should not panic
	metrics.RecordHTTPRequest("GET", "/test", 200, 100*time.Millisecond)
	
	// Test different status codes
	metrics.RecordHTTPRequest("POST", "/api/test", 201, 50*time.Millisecond)
	metrics.RecordHTTPRequest("GET", "/error", 500, 200*time.Millisecond)
}

func TestHTTPMiddleware(t *testing.T) {
	metrics := GetGlobalMetrics()
	
	// Create a test handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	
	// Wrap with metrics middleware
	wrappedHandler := metrics.HTTPMiddleware(handler)
	
	// Create test request
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	
	// Execute request
	wrappedHandler.ServeHTTP(w, req)
	
	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	if w.Body.String() != "OK" {
		t.Errorf("Expected body 'OK', got %s", w.Body.String())
	}
}

func TestMetricsHandler(t *testing.T) {
	metrics := GetGlobalMetrics()
	
	// Get metrics handler
	handler := metrics.MetricsHandler()
	
	// Create test request
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	
	// Execute request
	handler.ServeHTTP(w, req)
	
	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	// Check that response contains prometheus metrics
	body := w.Body.String()
	if body == "" {
		t.Error("Metrics endpoint returned empty response")
	}
}

func TestGlobalMetrics(t *testing.T) {
	// Get global metrics (should already be initialized from previous tests)
	metrics := GetGlobalMetrics()
	
	if metrics == nil {
		t.Fatal("GetGlobalMetrics() returned nil")
	}
	
	// Test that we get the same instance
	metrics2 := GetGlobalMetrics()
	if metrics != metrics2 {
		t.Error("GetGlobalMetrics() should return the same instance")
	}
}
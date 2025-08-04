package server

import (
	"encoding/json"
	"net/http"

	"github.com/7-solutions/saas-platformbackend/internal/services"
	"github.com/7-solutions/saas-platformbackend/internal/utils/logger"
)

// ErrorHandler handles HTTP error reporting endpoints
type ErrorHandler struct {
	errorService *services.ErrorReportingService
	logger       *logger.Logger
}

// NewErrorHandler creates a new error handler
func NewErrorHandler(errorService *services.ErrorReportingService) *ErrorHandler {
	return &ErrorHandler{
		errorService: errorService,
		logger:       logger.GetGlobalLogger(),
	}
}

// HandleErrorReport handles POST /api/v1/errors/report
func (h *ErrorHandler) HandleErrorReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Parse request body
	var req services.ErrorReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.LogError(ctx, err, "Failed to decode error report request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set user agent from header if not provided
	if req.UserAgent == "" {
		req.UserAgent = r.Header.Get("User-Agent")
	}

	// Process the error report
	if err := h.errorService.HandleErrorReport(ctx, req); err != nil {
		h.logger.LogError(ctx, err, "Failed to process error report")
		http.Error(w, "Failed to process error report", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Error report received",
	})
}

// HandleErrorStats handles GET /api/v1/errors/stats
func (h *ErrorHandler) HandleErrorStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// This endpoint would require admin authentication
	// For now, we'll just return basic stats
	stats, err := h.errorService.GetErrorStats(ctx, 0)
	if err != nil {
		h.logger.LogError(ctx, err, "Failed to get error stats")
		http.Error(w, "Failed to get error stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

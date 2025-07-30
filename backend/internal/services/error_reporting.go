package services

import (
	"context"
	"fmt"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/utils/logger"
)

// ErrorReport represents an error report from the client
type ErrorReport struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Message       string                 `json:"message"`
	Stack         string                 `json:"stack,omitempty"`
	URL           string                 `json:"url"`
	UserAgent     string                 `json:"user_agent"`
	UserID        string                 `json:"user_id,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
	Critical      bool                   `json:"critical,omitempty"`
	AdditionalData map[string]interface{} `json:"additional_data,omitempty"`
}

// ErrorReportingService handles error reporting and notifications
type ErrorReportingService struct {
	dbClient *database.Client
	logger   *logger.Logger
}

// NewErrorReportingService creates a new error reporting service
func NewErrorReportingService(dbClient *database.Client) *ErrorReportingService {
	return &ErrorReportingService{
		dbClient: dbClient,
		logger:   logger.GetGlobalLogger(),
	}
}

// ReportError stores an error report and sends notifications if needed
func (s *ErrorReportingService) ReportError(ctx context.Context, report ErrorReport) error {
	// Generate ID if not provided
	if report.ID == "" {
		report.ID = fmt.Sprintf("error_%d_%s", time.Now().Unix(), generateRandomID())
	}

	// Set timestamp if not provided
	if report.Timestamp.IsZero() {
		report.Timestamp = time.Now()
	}

	// Store error in database
	if err := s.storeError(ctx, report); err != nil {
		s.logger.LogError(ctx, err, "Failed to store error report", "error_id", report.ID)
		return err
	}

	// Log the error
	s.logError(ctx, report)

	// Send notifications for critical errors
	if report.Critical || s.shouldNotify(report) {
		if err := s.sendNotification(ctx, report); err != nil {
			s.logger.LogError(ctx, err, "Failed to send error notification", "error_id", report.ID)
		}
	}

	return nil
}

// ReportBatchErrors handles multiple error reports
func (s *ErrorReportingService) ReportBatchErrors(ctx context.Context, reports []ErrorReport) error {
	for _, report := range reports {
		if err := s.ReportError(ctx, report); err != nil {
			s.logger.LogError(ctx, err, "Failed to process error report in batch", "error_id", report.ID)
		}
	}
	return nil
}

// GetErrorReports retrieves error reports with pagination
func (s *ErrorReportingService) GetErrorReports(ctx context.Context, limit, offset int, filters map[string]interface{}) ([]ErrorReport, error) {
	// This would query the database for error reports
	// Implementation depends on your database schema
	return nil, fmt.Errorf("not implemented")
}

// GetErrorStats returns error statistics
func (s *ErrorReportingService) GetErrorStats(ctx context.Context, timeRange time.Duration) (map[string]interface{}, error) {
	// This would calculate error statistics
	// Implementation depends on your requirements
	return map[string]interface{}{
		"total_errors":    0,
		"critical_errors": 0,
		"error_rate":      0.0,
	}, nil
}

// storeError stores the error report in the database
func (s *ErrorReportingService) storeError(ctx context.Context, report ErrorReport) error {
	// Convert to CouchDB document
	doc := map[string]interface{}{
		"type":            "error_report",
		"error_type":      report.Type,
		"message":         report.Message,
		"stack":           report.Stack,
		"url":             report.URL,
		"user_agent":      report.UserAgent,
		"user_id":         report.UserID,
		"session_id":      report.SessionID,
		"timestamp":       report.Timestamp,
		"critical":        report.Critical,
		"additional_data": report.AdditionalData,
		"created_at":      time.Now(),
	}

	_, err := s.dbClient.Put(ctx, fmt.Sprintf("error:%s", report.ID), doc)
	return err
}

// logError logs the error using structured logging
func (s *ErrorReportingService) logError(ctx context.Context, report ErrorReport) {
	fields := []interface{}{
		"error_id", report.ID,
		"error_type", report.Type,
		"url", report.URL,
		"user_agent", report.UserAgent,
		"critical", report.Critical,
	}

	if report.UserID != "" {
		fields = append(fields, "reported_user_id", report.UserID)
	}

	if report.SessionID != "" {
		fields = append(fields, "session_id", report.SessionID)
	}

	if report.Critical {
		s.logger.Error("Critical client error reported", nil, fields...)
	} else {
		s.logger.Info("Client error reported", fields...)
	}
}

// shouldNotify determines if an error should trigger notifications
func (s *ErrorReportingService) shouldNotify(report ErrorReport) bool {
	// Notify for certain error types
	criticalTypes := []string{
		"global_error",
		"cms_global_error",
		"network_error",
	}

	for _, criticalType := range criticalTypes {
		if report.Type == criticalType {
			return true
		}
	}

	// Notify for errors affecting multiple users (would need rate limiting logic)
	// This is a simplified version
	return false
}

// sendNotification sends error notifications to administrators
func (s *ErrorReportingService) sendNotification(ctx context.Context, report ErrorReport) error {
	// In a real implementation, this would:
	// 1. Send email notifications to administrators
	// 2. Send Slack/Discord notifications
	// 3. Create tickets in issue tracking systems
	// 4. Send push notifications to admin mobile apps

	s.logger.Info("Error notification sent", 
		"error_id", report.ID,
		"error_type", report.Type,
		"critical", report.Critical,
	)

	// For now, just log the notification
	// You would integrate with your preferred notification service here
	return nil
}

// generateRandomID generates a random ID for error reports
func generateRandomID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano()%1000000)
}

// ErrorReportRequest represents the HTTP request for error reporting
type ErrorReportRequest struct {
	Type           string                 `json:"type"`
	Message        string                 `json:"message"`
	Stack          string                 `json:"stack,omitempty"`
	URL            string                 `json:"url"`
	UserAgent      string                 `json:"user_agent"`
	UserID         string                 `json:"user_id,omitempty"`
	SessionID      string                 `json:"session_id,omitempty"`
	Critical       bool                   `json:"critical,omitempty"`
	AdditionalData map[string]interface{} `json:"additional_data,omitempty"`
	Errors         []ErrorReportRequest   `json:"errors,omitempty"` // For batch requests
}

// HandleErrorReport handles HTTP error reporting requests
func (s *ErrorReportingService) HandleErrorReport(ctx context.Context, req ErrorReportRequest) error {
	// Handle batch requests
	if len(req.Errors) > 0 {
		reports := make([]ErrorReport, len(req.Errors))
		for i, errReq := range req.Errors {
			reports[i] = ErrorReport{
				Type:           errReq.Type,
				Message:        errReq.Message,
				Stack:          errReq.Stack,
				URL:            errReq.URL,
				UserAgent:      errReq.UserAgent,
				UserID:         errReq.UserID,
				SessionID:      errReq.SessionID,
				Critical:       errReq.Critical,
				AdditionalData: errReq.AdditionalData,
			}
		}
		return s.ReportBatchErrors(ctx, reports)
	}

	// Handle single error report
	report := ErrorReport{
		Type:           req.Type,
		Message:        req.Message,
		Stack:          req.Stack,
		URL:            req.URL,
		UserAgent:      req.UserAgent,
		UserID:         req.UserID,
		SessionID:      req.SessionID,
		Critical:       req.Critical,
		AdditionalData: req.AdditionalData,
	}

	return s.ReportError(ctx, report)
}
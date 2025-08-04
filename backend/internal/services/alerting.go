package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/utils/logger"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	AlertSeverityInfo     AlertSeverity = "info"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityCritical AlertSeverity = "critical"
)

// Alert represents an alert to be sent
type Alert struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Severity    AlertSeverity          `json:"severity"`
	Service     string                 `json:"service"`
	Timestamp   time.Time              `json:"timestamp"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// AlertWebhookPayload represents the payload sent to webhook endpoints
type AlertWebhookPayload struct {
	Version           string            `json:"version"`
	GroupKey          string            `json:"groupKey"`
	TruncatedAlerts   int               `json:"truncatedAlerts"`
	Status            string            `json:"status"`
	Receiver          string            `json:"receiver"`
	GroupLabels       map[string]string `json:"groupLabels"`
	CommonLabels      map[string]string `json:"commonLabels"`
	CommonAnnotations map[string]string `json:"commonAnnotations"`
	ExternalURL       string            `json:"externalURL"`
	Alerts            []Alert           `json:"alerts"`
}

// AlertingService handles alert management and delivery
type AlertingService struct {
	webhookURL   string
	emailService *EmailService
	logger       *logger.Logger
	alertHistory []Alert // In production, this should be persisted
}

// NewAlertingService creates a new alerting service
func NewAlertingService(webhookURL string, emailService *EmailService) *AlertingService {
	return &AlertingService{
		webhookURL:   webhookURL,
		emailService: emailService,
		logger:       logger.GetGlobalLogger().WithFields(map[string]interface{}{"service": "alerting"}),
		alertHistory: make([]Alert, 0),
	}
}

// SendAlert sends an alert through configured channels
func (s *AlertingService) SendAlert(ctx context.Context, alert Alert) error {
	alert.Timestamp = time.Now().UTC()

	// Store alert in history
	s.alertHistory = append(s.alertHistory, alert)

	// Log the alert
	s.logger.WithContext(ctx).Info("Sending alert",
		"alert_id", alert.ID,
		"severity", alert.Severity,
		"title", alert.Title,
	)

	// Send through different channels based on severity
	switch alert.Severity {
	case AlertSeverityCritical:
		if err := s.sendWebhookAlert(ctx, alert); err != nil {
			s.logger.WithContext(ctx).Error("Failed to send webhook alert", err)
		}
		if err := s.sendEmailAlert(ctx, alert); err != nil {
			s.logger.WithContext(ctx).Error("Failed to send email alert", err)
		}
	case AlertSeverityWarning:
		if err := s.sendWebhookAlert(ctx, alert); err != nil {
			s.logger.WithContext(ctx).Error("Failed to send webhook alert", err)
		}
	case AlertSeverityInfo:
		// Only log info alerts
		s.logger.WithContext(ctx).Info("Info alert", "details", alert.Details)
	}

	return nil
}

// SendDatabaseConnectionAlert sends a database connection alert
func (s *AlertingService) SendDatabaseConnectionAlert(ctx context.Context, err error) {
	alert := Alert{
		ID:          fmt.Sprintf("db-connection-%d", time.Now().Unix()),
		Title:       "Database Connection Failed",
		Description: fmt.Sprintf("Failed to connect to database: %v", err),
		Severity:    AlertSeverityCritical,
		Service:     "database",
		Labels: map[string]string{
			"alertname": "DatabaseConnectionFailed",
			"service":   "database",
		},
		Annotations: map[string]string{
			"summary":     "Database connection failed",
			"description": fmt.Sprintf("Database connection has failed: %v", err),
		},
		Details: map[string]interface{}{
			"error": err.Error(),
		},
	}

	s.SendAlert(ctx, alert)
}

// SendHighErrorRateAlert sends a high error rate alert
func (s *AlertingService) SendHighErrorRateAlert(ctx context.Context, errorRate float64, service string) {
	alert := Alert{
		ID:          fmt.Sprintf("high-error-rate-%s-%d", service, time.Now().Unix()),
		Title:       "High Error Rate Detected",
		Description: fmt.Sprintf("Error rate of %.2f%% detected in %s service", errorRate*100, service),
		Severity:    AlertSeverityWarning,
		Service:     service,
		Labels: map[string]string{
			"alertname": "HighErrorRate",
			"service":   service,
		},
		Annotations: map[string]string{
			"summary":     "High error rate detected",
			"description": fmt.Sprintf("Error rate is %.2f%% for %s service", errorRate*100, service),
		},
		Details: map[string]interface{}{
			"error_rate": errorRate,
			"threshold":  0.05, // 5%
		},
	}

	s.SendAlert(ctx, alert)
}

// SendServiceDownAlert sends a service down alert
func (s *AlertingService) SendServiceDownAlert(ctx context.Context, serviceName string) {
	alert := Alert{
		ID:          fmt.Sprintf("service-down-%s-%d", serviceName, time.Now().Unix()),
		Title:       "Service Down",
		Description: fmt.Sprintf("Service %s is not responding", serviceName),
		Severity:    AlertSeverityCritical,
		Service:     serviceName,
		Labels: map[string]string{
			"alertname": "ServiceDown",
			"service":   serviceName,
		},
		Annotations: map[string]string{
			"summary":     fmt.Sprintf("Service %s is down", serviceName),
			"description": fmt.Sprintf("Service %s has been down for more than 1 minute", serviceName),
		},
	}

	s.SendAlert(ctx, alert)
}

// SendHighMemoryUsageAlert sends a high memory usage alert
func (s *AlertingService) SendHighMemoryUsageAlert(ctx context.Context, memoryUsageMB float64) {
	alert := Alert{
		ID:          fmt.Sprintf("high-memory-%d", time.Now().Unix()),
		Title:       "High Memory Usage",
		Description: fmt.Sprintf("Memory usage is %.2f MB", memoryUsageMB),
		Severity:    AlertSeverityWarning,
		Service:     "system",
		Labels: map[string]string{
			"alertname": "HighMemoryUsage",
			"service":   "system",
		},
		Annotations: map[string]string{
			"summary":     "High memory usage detected",
			"description": fmt.Sprintf("Memory usage is %.2f MB", memoryUsageMB),
		},
		Details: map[string]interface{}{
			"memory_usage_mb": memoryUsageMB,
			"threshold_mb":    500,
		},
	}

	s.SendAlert(ctx, alert)
}

// sendWebhookAlert sends alert via webhook
func (s *AlertingService) sendWebhookAlert(ctx context.Context, alert Alert) error {
	if s.webhookURL == "" {
		return fmt.Errorf("webhook URL not configured")
	}

	payload := AlertWebhookPayload{
		Version:           "4",
		GroupKey:          alert.Labels["alertname"],
		Status:            "firing",
		Receiver:          "webhook",
		GroupLabels:       alert.Labels,
		CommonLabels:      alert.Labels,
		CommonAnnotations: alert.Annotations,
		ExternalURL:       "http://localhost:9093",
		Alerts:            []Alert{alert},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// sendEmailAlert sends alert via email
func (s *AlertingService) sendEmailAlert(ctx context.Context, alert Alert) error {
	if s.emailService == nil {
		return fmt.Errorf("email service not configured")
	}

	subject := fmt.Sprintf("[%s] %s", alert.Severity, alert.Title)
	body := fmt.Sprintf(`
Alert: %s
Severity: %s
Service: %s
Time: %s

Description: %s

Labels:
%s

Annotations:
%s
`,
		alert.Title,
		alert.Severity,
		alert.Service,
		alert.Timestamp.Format(time.RFC3339),
		alert.Description,
		formatMap(alert.Labels),
		formatMap(alert.Annotations),
	)

	// Send to admin email (this should be configurable)
	return s.emailService.SendEmail(ctx, "admin@saas-platform.com", subject, body)
}

// formatMap formats a map for display in email
func formatMap(m map[string]string) string {
	var result string
	for k, v := range m {
		result += fmt.Sprintf("  %s: %s\n", k, v)
	}
	return result
}

// HandleAlertWebhook handles incoming alert webhooks from Prometheus AlertManager
func (s *AlertingService) HandleAlertWebhook(w http.ResponseWriter, r *http.Request) {
	var payload AlertWebhookPayload

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		s.logger.Error("Failed to decode alert webhook payload", err)
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Process each alert in the payload
	for _, alert := range payload.Alerts {
		s.logger.WithContext(ctx).Info("Received alert webhook",
			"alert_id", alert.ID,
			"status", payload.Status,
			"title", alert.Title,
		)

		// Store alert in history
		s.alertHistory = append(s.alertHistory, alert)

		// You can add custom processing logic here
		// For example, update dashboard, send to external systems, etc.
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// GetAlertHistory returns recent alert history
func (s *AlertingService) GetAlertHistory(limit int) []Alert {
	if limit <= 0 || limit > len(s.alertHistory) {
		return s.alertHistory
	}

	// Return the most recent alerts
	start := len(s.alertHistory) - limit
	return s.alertHistory[start:]
}

// GetAlertStats returns alert statistics
func (s *AlertingService) GetAlertStats() map[string]interface{} {
	stats := map[string]interface{}{
		"total_alerts": len(s.alertHistory),
		"by_severity":  make(map[AlertSeverity]int),
		"by_service":   make(map[string]int),
	}

	severityStats := stats["by_severity"].(map[AlertSeverity]int)
	serviceStats := stats["by_service"].(map[string]int)

	for _, alert := range s.alertHistory {
		severityStats[alert.Severity]++
		serviceStats[alert.Service]++
	}

	return stats
}

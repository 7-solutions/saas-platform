package services

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"os"
	"strings"

	"github.com/saas-startup-platform/backend/internal/models"
)

// EmailService handles email notifications
type EmailService struct {
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	fromEmail    string
	fromName     string
	adminEmail   string
}

// NewEmailService creates a new email service
func NewEmailService() *EmailService {
	return &EmailService{
		smtpHost:     getEnvOrDefault("SMTP_HOST", "localhost"),
		smtpPort:     getEnvOrDefault("SMTP_PORT", "587"),
		smtpUsername: getEnvOrDefault("SMTP_USERNAME", ""),
		smtpPassword: getEnvOrDefault("SMTP_PASSWORD", ""),
		fromEmail:    getEnvOrDefault("FROM_EMAIL", "noreply@saasplatform.com"),
		fromName:     getEnvOrDefault("FROM_NAME", "SaaS Platform"),
		adminEmail:   getEnvOrDefault("ADMIN_EMAIL", "admin@saasplatform.com"),
	}
}

// SendContactNotification sends an email notification for new contact submissions
func (s *EmailService) SendContactNotification(submission *models.ContactSubmission) error {
	if s.adminEmail == "" {
		log.Println("Admin email not configured, skipping email notification")
		return nil
	}

	// Prepare email content
	subject := fmt.Sprintf("New Contact Form Submission from %s", submission.Name)
	
	// Create HTML email body
	htmlBody, err := s.generateContactNotificationHTML(submission)
	if err != nil {
		return fmt.Errorf("failed to generate email HTML: %w", err)
	}

	// Create plain text email body
	textBody := s.generateContactNotificationText(submission)

	// Send email
	return s.sendEmail(s.adminEmail, subject, textBody, htmlBody)
}

// SendContactConfirmation sends a confirmation email to the person who submitted the form
func (s *EmailService) SendContactConfirmation(submission *models.ContactSubmission) error {
	subject := "Thank you for contacting us"
	
	// Create HTML email body
	htmlBody, err := s.generateContactConfirmationHTML(submission)
	if err != nil {
		return fmt.Errorf("failed to generate confirmation email HTML: %w", err)
	}

	// Create plain text email body
	textBody := s.generateContactConfirmationText(submission)

	// Send email
	return s.sendEmail(submission.Email, subject, textBody, htmlBody)
}

// sendEmail sends an email using SMTP
func (s *EmailService) sendEmail(to, subject, textBody, htmlBody string) error {
	if s.smtpHost == "localhost" || s.smtpUsername == "" {
		// Log email instead of sending in development
		log.Printf("Email would be sent to %s with subject: %s\nBody: %s", to, subject, textBody)
		return nil
	}

	// Create message
	message := s.createMIMEMessage(to, subject, textBody, htmlBody)

	// Set up authentication
	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)

	// Send email
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)
	err := smtp.SendMail(addr, auth, s.fromEmail, []string{to}, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("Email sent successfully to %s", to)
	return nil
}

// createMIMEMessage creates a MIME message with both text and HTML parts
func (s *EmailService) createMIMEMessage(to, subject, textBody, htmlBody string) string {
	boundary := "boundary123456789"
	
	var message strings.Builder
	
	// Headers
	message.WriteString(fmt.Sprintf("From: %s <%s>\r\n", s.fromName, s.fromEmail))
	message.WriteString(fmt.Sprintf("To: %s\r\n", to))
	message.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	message.WriteString("MIME-Version: 1.0\r\n")
	message.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=%s\r\n", boundary))
	message.WriteString("\r\n")
	
	// Text part
	message.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	message.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	message.WriteString("\r\n")
	message.WriteString(textBody)
	message.WriteString("\r\n")
	
	// HTML part
	message.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	message.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	message.WriteString("\r\n")
	message.WriteString(htmlBody)
	message.WriteString("\r\n")
	
	// End boundary
	message.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	
	return message.String()
}

// generateContactNotificationHTML generates HTML email for admin notification
func (s *EmailService) generateContactNotificationHTML(submission *models.ContactSubmission) (string, error) {
	tmpl := `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>New Contact Form Submission</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .message { background-color: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>New Contact Form Submission</h2>
            <p>You have received a new message through your website contact form.</p>
        </div>
        
        <div class="field">
            <div class="label">Name:</div>
            <div class="value">{{.Name}}</div>
        </div>
        
        <div class="field">
            <div class="label">Email:</div>
            <div class="value">{{.Email}}</div>
        </div>
        
        {{if .Company}}
        <div class="field">
            <div class="label">Company:</div>
            <div class="value">{{.Company}}</div>
        </div>
        {{end}}
        
        <div class="field">
            <div class="label">Message:</div>
            <div class="message">{{.Message}}</div>
        </div>
        
        <div class="field">
            <div class="label">Submitted:</div>
            <div class="value">{{.CreatedAt.Format "January 2, 2006 at 3:04 PM"}}</div>
        </div>
        
        {{if .IPAddress}}
        <div class="field">
            <div class="label">IP Address:</div>
            <div class="value">{{.IPAddress}}</div>
        </div>
        {{end}}
        
        <div class="footer">
            <p>This email was automatically generated by your SaaS Platform contact form.</p>
        </div>
    </div>
</body>
</html>`

	t, err := template.New("notification").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, submission)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// generateContactNotificationText generates plain text email for admin notification
func (s *EmailService) generateContactNotificationText(submission *models.ContactSubmission) string {
	var text strings.Builder
	
	text.WriteString("New Contact Form Submission\n")
	text.WriteString("============================\n\n")
	text.WriteString(fmt.Sprintf("Name: %s\n", submission.Name))
	text.WriteString(fmt.Sprintf("Email: %s\n", submission.Email))
	
	if submission.Company != "" {
		text.WriteString(fmt.Sprintf("Company: %s\n", submission.Company))
	}
	
	text.WriteString(fmt.Sprintf("Submitted: %s\n", submission.CreatedAt.Format("January 2, 2006 at 3:04 PM")))
	
	if submission.IPAddress != "" {
		text.WriteString(fmt.Sprintf("IP Address: %s\n", submission.IPAddress))
	}
	
	text.WriteString("\nMessage:\n")
	text.WriteString("--------\n")
	text.WriteString(submission.Message)
	text.WriteString("\n\n")
	text.WriteString("This email was automatically generated by your SaaS Platform contact form.")
	
	return text.String()
}

// generateContactConfirmationHTML generates HTML confirmation email for the submitter
func (s *EmailService) generateContactConfirmationHTML(submission *models.ContactSubmission) (string, error) {
	tmpl := `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Thank you for contacting us</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; text-align: center; }
        .content { margin-bottom: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Thank you for contacting us!</h2>
        </div>
        
        <div class="content">
            <p>Hi {{.Name}},</p>
            
            <p>Thank you for reaching out to us through our website. We have received your message and will get back to you as soon as possible.</p>
            
            <p>Here's a copy of your message for your records:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; margin: 20px 0;">{{.Message}}</div>
            
            <p>We typically respond within 24 hours during business days. If your inquiry is urgent, please feel free to call us directly.</p>
            
            <p>Best regards,<br>
            The SaaS Platform Team</p>
        </div>
        
        <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>`

	t, err := template.New("confirmation").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, submission)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// generateContactConfirmationText generates plain text confirmation email for the submitter
func (s *EmailService) generateContactConfirmationText(submission *models.ContactSubmission) string {
	var text strings.Builder
	
	text.WriteString(fmt.Sprintf("Hi %s,\n\n", submission.Name))
	text.WriteString("Thank you for reaching out to us through our website. We have received your message and will get back to you as soon as possible.\n\n")
	text.WriteString("Here's a copy of your message for your records:\n\n")
	text.WriteString("--------\n")
	text.WriteString(submission.Message)
	text.WriteString("\n--------\n\n")
	text.WriteString("We typically respond within 24 hours during business days. If your inquiry is urgent, please feel free to call us directly.\n\n")
	text.WriteString("Best regards,\n")
	text.WriteString("The SaaS Platform Team\n\n")
	text.WriteString("This is an automated confirmation email. Please do not reply to this message.")
	
	return text.String()
}

// SendEmail sends a simple email (public method for alerting service)
func (s *EmailService) SendEmail(ctx context.Context, to, subject, body string) error {
	return s.sendEmail(to, subject, body, "")
}

// getEnvOrDefault returns environment variable value or default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
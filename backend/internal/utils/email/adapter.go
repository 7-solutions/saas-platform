package email

import (
	"context"
	"fmt"
	"log"
	"time"
)

// TODO: Move this interface to backend/internal/ports when canonical ports are added.
type EmailSender interface {
	// Send sends an email. For now, it's a stub that logs and returns nil.
	Send(ctx context.Context, to string, subject string, body string) error
}

// EmailSMTP is a minimal SMTP/provider stub adapter.
// TODO: Wire real SMTP/provider client and credentials.
type EmailSMTP struct {
	host     string
	port     int
	username string
	password string
	from     string
	timeout  time.Duration
}

// NewEmailSMTP constructs a new EmailSMTP adapter.
func NewEmailSMTP(host string, port int, username, password, from string) *EmailSMTP {
	return &EmailSMTP{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		timeout:  5 * time.Second,
	}
}

// Send currently logs the outgoing message and returns nil.
// TODO: Implement SMTP/provider call respecting ctx cancellation and timeouts.
func (e *EmailSMTP) Send(ctx context.Context, to string, subject string, body string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	log.Printf("EmailSMTP: send to=%s subject=%q len(body)=%d", to, subject, len(body))
	_ = fmt.Sprintf // keep fmt imported if logging changes
	return nil
}
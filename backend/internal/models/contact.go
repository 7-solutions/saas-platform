package models

import (
	"time"
)

// ContactSubmission represents a contact form submission document in CouchDB
type ContactSubmission struct {
	ID        string    `json:"_id,omitempty"`
	Rev       string    `json:"_rev,omitempty"`
	Type      string    `json:"type"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Company   string    `json:"company,omitempty"`
	Message   string    `json:"message"`
	IPAddress string    `json:"ip_address,omitempty"`
	UserAgent string    `json:"user_agent,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ContactStatus constants
const (
	ContactStatusNew     = "new"
	ContactStatusRead    = "read"
	ContactStatusReplied = "replied"
	ContactStatusSpam    = "spam"
)

// NewContactSubmission creates a new contact submission with default values
func NewContactSubmission(name, email, company, message, ipAddress, userAgent string) *ContactSubmission {
	now := time.Now()
	return &ContactSubmission{
		Type:      "contact_submission",
		Name:      name,
		Email:     email,
		Company:   company,
		Message:   message,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Status:    ContactStatusNew,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// MarkAsRead updates the status to read and updates the timestamp
func (c *ContactSubmission) MarkAsRead() {
	c.Status = ContactStatusRead
	c.UpdatedAt = time.Now()
}

// MarkAsReplied updates the status to replied and updates the timestamp
func (c *ContactSubmission) MarkAsReplied() {
	c.Status = ContactStatusReplied
	c.UpdatedAt = time.Now()
}

// MarkAsSpam updates the status to spam and updates the timestamp
func (c *ContactSubmission) MarkAsSpam() {
	c.Status = ContactStatusSpam
	c.UpdatedAt = time.Now()
}
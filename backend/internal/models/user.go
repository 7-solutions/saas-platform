package models

import (
	"time"
)

// User represents a user document in CouchDB
type User struct {
	ID           string    `json:"_id"`
	Rev          string    `json:"_rev,omitempty"`
	Type         string    `json:"type"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	Role         string    `json:"role"`
	Profile      Profile   `json:"profile"`
	CreatedAt    time.Time `json:"created_at"`
	LastLogin    time.Time `json:"last_login,omitempty"`
}

// Profile represents user profile information
type Profile struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
}

// UserRole constants
const (
	UserRoleAdmin  = "admin"
	UserRoleEditor = "editor"
	UserRoleViewer = "viewer"
)

// NewUser creates a new user with default values
func NewUser(email, passwordHash, role string) *User {
	now := time.Now()
	return &User{
		ID:           "user:" + email,
		Type:         "user",
		Email:        email,
		PasswordHash: passwordHash,
		Role:         role,
		Profile:      Profile{},
		CreatedAt:    now,
	}
}
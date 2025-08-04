package ports

import (
	"context"
	"time"
)

// ==========================
// temporary domain structs for ports
// NOTE: These are thin internal models to decouple ports from sqlc models.
// They can be moved to a central domain package in a future refactor.
// ==========================

type User struct {
	ID           string
	Email        string
	Name         *string
	PasswordHash *string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type ContactStatus string

const (
	ContactStatusNew        ContactStatus = "new"
	ContactStatusInProgress ContactStatus = "in_progress"
	ContactStatusResolved   ContactStatus = "resolved"
	ContactStatusSpam       ContactStatus = "spam"
)

type ContactSubmission struct {
	ID        string
	Email     string
	Name      *string
	Subject   *string
	Message   string
	Status    ContactStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ListOptions provides common pagination knobs.
// Kept minimal for now; can be replaced by shared types later.
type ListOptions struct {
	Limit  int32
	Offset int32
}

// PaginationInfo is a thin struct describing list paging results.
type PaginationInfo struct {
	Limit     int32
	Offset    int32
	NextToken string // reserved for future use; not wired yet
}

// ==========================
// Ports (interfaces)
// ==========================

// UsersRepository defines required operations for users storage.
// Keep minimal: lookup, list, create.
type UsersRepository interface {
	GetByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context, opt ListOptions) ([]*User, error)
	Create(ctx context.Context, u *User) error
}

// ContactRepository defines operations for contact submissions storage.
type ContactRepository interface {
	CreateSubmission(ctx context.Context, s *ContactSubmission) (*ContactSubmission, error)
	GetSubmission(ctx context.Context, id string) (*ContactSubmission, error)
	UpdateSubmission(ctx context.Context, s *ContactSubmission) (*ContactSubmission, error)
	DeleteSubmission(ctx context.Context, id string) error
	ListSubmissions(ctx context.Context, opt ListOptions) ([]*ContactSubmission, *PaginationInfo, error)
	ListByStatus(ctx context.Context, status ContactStatus) ([]*ContactSubmission, error)
	CountByStatus(ctx context.Context, status ContactStatus) (int64, error)
	Search(ctx context.Context, query string, opt ListOptions) ([]*ContactSubmission, error)
}

// UnitOfWork abstracts transactional execution. Implementations should
// attach a tx-bound sqlc Queries instance to the provided context so that
// downstream adapters reuse the transaction.
type UnitOfWork interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}
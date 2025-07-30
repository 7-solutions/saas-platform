package repository

import (
	"context"
	"errors"

	"github.com/saas-startup-platform/backend/internal/models"
)

// Common repository errors
var (
	ErrNotFound = errors.New("resource not found")
)

// PageRepository defines the interface for page data access
type PageRepository interface {
	Create(ctx context.Context, page *models.Page) error
	GetByID(ctx context.Context, id string) (*models.Page, error)
	GetBySlug(ctx context.Context, slug string) (*models.Page, error)
	Update(ctx context.Context, page *models.Page) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options ListOptions) ([]*models.Page, error)
	ListByStatus(ctx context.Context, status string, options ListOptions) ([]*models.Page, error)
	Search(ctx context.Context, query string, options ListOptions) ([]*models.Page, error)
}

// UserRepository defines the interface for user data access
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByID(ctx context.Context, id string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options ListOptions) ([]*models.User, error)
	ListByRole(ctx context.Context, role string, options ListOptions) ([]*models.User, error)
}

// MediaRepository defines the interface for media data access
type MediaRepository interface {
	Create(ctx context.Context, media *models.Media) error
	GetByID(ctx context.Context, id string) (*models.Media, error)
	GetByFilename(ctx context.Context, filename string) (*models.Media, error)
	Update(ctx context.Context, media *models.Media) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options ListOptions) ([]*models.Media, error)
	ListByUploader(ctx context.Context, uploaderID string, options ListOptions) ([]*models.Media, error)
}

// BlogRepository defines the interface for blog post data access
type BlogRepository interface {
	Create(ctx context.Context, post *models.BlogPost) error
	GetByID(ctx context.Context, id string) (*models.BlogPost, error)
	GetBySlug(ctx context.Context, slug string) (*models.BlogPost, error)
	Update(ctx context.Context, post *models.BlogPost) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options ListOptions) ([]*models.BlogPost, error)
	ListByStatus(ctx context.Context, status string, options ListOptions) ([]*models.BlogPost, error)
	ListByAuthor(ctx context.Context, author string, options ListOptions) ([]*models.BlogPost, error)
	ListByCategory(ctx context.Context, category string, options ListOptions) ([]*models.BlogPost, error)
	ListByTag(ctx context.Context, tag string, options ListOptions) ([]*models.BlogPost, error)
	Search(ctx context.Context, query string, options ListOptions) ([]*models.BlogPost, error)
	GetCategories(ctx context.Context) ([]*models.BlogCategory, error)
	GetTags(ctx context.Context) ([]*models.BlogTag, error)
	GetPublishedPosts(ctx context.Context, options ListOptions) ([]*models.BlogPost, error)
}

// ContactRepository defines the interface for contact submission data access
type ContactRepository interface {
	CreateContactSubmission(ctx context.Context, submission *models.ContactSubmission) (*models.ContactSubmission, error)
	GetContactSubmission(ctx context.Context, id string) (*models.ContactSubmission, error)
	UpdateContactSubmission(ctx context.Context, submission *models.ContactSubmission) (*models.ContactSubmission, error)
	DeleteContactSubmission(ctx context.Context, id, rev string) error
	ListContactSubmissions(ctx context.Context, opts ListOptions) ([]*models.ContactSubmission, *PaginationInfo, error)
	GetContactSubmissionsByStatus(ctx context.Context, status string) ([]*models.ContactSubmission, error)
}

// ListOptions defines options for listing operations
type ListOptions struct {
	Limit  int
	Skip   int
	SortBy string
	Order  string // "asc" or "desc"
	Status string // For filtering by status
	Search string // For search functionality
}

// PaginationInfo contains pagination metadata
type PaginationInfo struct {
	TotalCount    int
	HasMore       bool
	NextPageToken string
}

// DefaultListOptions returns default listing options
func DefaultListOptions() ListOptions {
	return ListOptions{
		Limit:  50,
		Skip:   0,
		SortBy: "created_at",
		Order:  "desc",
	}
}
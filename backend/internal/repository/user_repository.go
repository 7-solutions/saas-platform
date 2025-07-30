package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

// userRepository implements UserRepository interface
type userRepository struct {
	client *database.Client
}

// NewUserRepository creates a new user repository
func NewUserRepository(client *database.Client) UserRepository {
	return &userRepository{
		client: client,
	}
}

// Create creates a new user document
func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = "user:" + user.Email
	}
	user.Type = "user"
	user.CreatedAt = time.Now()

	_, err := r.client.Put(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetByID retrieves a user by their ID
func (r *userRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	err := r.client.Get(ctx, id, &user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetByEmail retrieves a user by their email using a view
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	result, err := r.client.Query(ctx, "users", "by_email", map[string]interface{}{
		"key":          email,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query user by email: %w", err)
	}

	if len(result.Rows) == 0 {
		return nil, fmt.Errorf("user not found with email: %s", email)
	}

	var user models.User
	if err := json.Unmarshal(result.Rows[0].Doc, &user); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user document: %w", err)
	}

	return &user, nil
}

// Update updates an existing user document
func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	_, err := r.client.Put(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// Delete deletes a user document
func (r *userRepository) Delete(ctx context.Context, id string) error {
	// First get the document to obtain the revision
	var user models.User
	err := r.client.Get(ctx, id, &user)
	if err != nil {
		return fmt.Errorf("failed to get user for deletion: %w", err)
	}

	err = r.client.Delete(ctx, id, user.Rev)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// List retrieves all users with pagination
func (r *userRepository) List(ctx context.Context, options ListOptions) ([]*models.User, error) {
	result, err := r.client.Query(ctx, "users", "all", map[string]interface{}{
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	var users []*models.User
	for _, row := range result.Rows {
		var user models.User
		if err := json.Unmarshal(row.Doc, &user); err != nil {
			return nil, fmt.Errorf("failed to unmarshal user document: %w", err)
		}
		users = append(users, &user)
	}

	return users, nil
}

// ListByRole retrieves users by role with pagination
func (r *userRepository) ListByRole(ctx context.Context, role string, options ListOptions) ([]*models.User, error) {
	result, err := r.client.Query(ctx, "users", "by_role", map[string]interface{}{
		"key":          role,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list users by role: %w", err)
	}

	var users []*models.User
	for _, row := range result.Rows {
		var user models.User
		if err := json.Unmarshal(row.Doc, &user); err != nil {
			return nil, fmt.Errorf("failed to unmarshal user document: %w", err)
		}
		users = append(users, &user)
	}

	return users, nil
}
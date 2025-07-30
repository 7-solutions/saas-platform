package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

// contactRepository implements ContactRepository interface
type contactRepository struct {
	client *database.Client
}

// NewContactRepository creates a new contact repository
func NewContactRepository(client *database.Client) ContactRepository {
	return &contactRepository{
		client: client,
	}
}

// CreateContactSubmission creates a new contact submission
func (r *contactRepository) CreateContactSubmission(ctx context.Context, submission *models.ContactSubmission) (*models.ContactSubmission, error) {
	// Generate ID if not provided
	if submission.ID == "" {
		submission.ID = fmt.Sprintf("contact:%d", time.Now().UnixNano())
	}

	doc, err := r.client.Put(ctx, submission.ID, submission)
	if err != nil {
		return nil, fmt.Errorf("failed to create contact submission: %w", err)
	}

	submission.Rev = doc.Rev
	return submission, nil
}

// GetContactSubmission retrieves a contact submission by ID
func (r *contactRepository) GetContactSubmission(ctx context.Context, id string) (*models.ContactSubmission, error) {
	var submission models.ContactSubmission
	err := r.client.Get(ctx, id, &submission)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get contact submission: %w", err)
	}

	return &submission, nil
}

// UpdateContactSubmission updates an existing contact submission
func (r *contactRepository) UpdateContactSubmission(ctx context.Context, submission *models.ContactSubmission) (*models.ContactSubmission, error) {
	submission.UpdatedAt = time.Now()
	
	doc, err := r.client.Put(ctx, submission.ID, submission)
	if err != nil {
		return nil, fmt.Errorf("failed to update contact submission: %w", err)
	}

	submission.Rev = doc.Rev
	return submission, nil
}

// DeleteContactSubmission deletes a contact submission
func (r *contactRepository) DeleteContactSubmission(ctx context.Context, id, rev string) error {
	err := r.client.Delete(ctx, id, rev)
	if err != nil {
		return fmt.Errorf("failed to delete contact submission: %w", err)
	}
	return nil
}

// ListContactSubmissions lists contact submissions with filtering and pagination
func (r *contactRepository) ListContactSubmissions(ctx context.Context, opts ListOptions) ([]*models.ContactSubmission, *PaginationInfo, error) {
	// Set up query options
	queryOpts := map[string]interface{}{
		"include_docs": true,
		"descending":   true, // Most recent first
	}

	// Add pagination
	if opts.Limit > 0 {
		queryOpts["limit"] = opts.Limit
	}
	if opts.Skip > 0 {
		queryOpts["skip"] = opts.Skip
	}

	// Execute query
	result, err := r.client.Query(ctx, "contact_submissions", "by_created_at", queryOpts)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query contact submissions: %w", err)
	}

	var submissions []*models.ContactSubmission
	for _, row := range result.Rows {
		var submission models.ContactSubmission
		if err := json.Unmarshal(row.Doc, &submission); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal contact submission: %w", err)
		}

		// Apply status filter if specified
		if opts.Status != "" && submission.Status != opts.Status {
			continue
		}

		// Apply search filter if specified
		if opts.Search != "" {
			searchLower := strings.ToLower(opts.Search)
			if !strings.Contains(strings.ToLower(submission.Name), searchLower) &&
				!strings.Contains(strings.ToLower(submission.Email), searchLower) &&
				!strings.Contains(strings.ToLower(submission.Company), searchLower) &&
				!strings.Contains(strings.ToLower(submission.Message), searchLower) {
				continue
			}
		}

		submissions = append(submissions, &submission)
	}

	// Get total count for pagination
	totalCount, err := r.getContactSubmissionsCount(ctx, opts)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get total count: %w", err)
	}

	paginationInfo := &PaginationInfo{
		TotalCount: totalCount,
		HasMore:    len(submissions) == opts.Limit && opts.Skip+opts.Limit < totalCount,
	}

	if paginationInfo.HasMore {
		paginationInfo.NextPageToken = strconv.Itoa(opts.Skip + opts.Limit)
	}

	return submissions, paginationInfo, nil
}

// getContactSubmissionsCount gets the total count of contact submissions
func (r *contactRepository) getContactSubmissionsCount(ctx context.Context, opts ListOptions) (int, error) {
	// Use a reduce view to get count
	result, err := r.client.Query(ctx, "contact_submissions", "count", map[string]interface{}{
		"reduce": true,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to query contact submissions count: %w", err)
	}

	if len(result.Rows) == 0 {
		return 0, nil
	}

	// The value should be an integer for _count reduce
	if count, ok := result.Rows[0].Value.(float64); ok {
		return int(count), nil
	}

	return 0, nil
}

// GetContactSubmissionsByStatus gets contact submissions by status
func (r *contactRepository) GetContactSubmissionsByStatus(ctx context.Context, status string) ([]*models.ContactSubmission, error) {
	result, err := r.client.Query(ctx, "contact_submissions", "by_status", map[string]interface{}{
		"key":          status,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query contact submissions by status: %w", err)
	}

	var submissions []*models.ContactSubmission
	for _, row := range result.Rows {
		var submission models.ContactSubmission
		if err := json.Unmarshal(row.Doc, &submission); err != nil {
			return nil, fmt.Errorf("failed to unmarshal contact submission: %w", err)
		}
		submissions = append(submissions, &submission)
	}

	return submissions, nil
}
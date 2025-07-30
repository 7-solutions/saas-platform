package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

// pageRepository implements PageRepository interface
type pageRepository struct {
	client *database.Client
}

// NewPageRepository creates a new page repository
func NewPageRepository(client *database.Client) PageRepository {
	return &pageRepository{
		client: client,
	}
}

// Create creates a new page document
func (r *pageRepository) Create(ctx context.Context, page *models.Page) error {
	if page.ID == "" {
		page.ID = "page:" + page.Slug
	}
	page.Type = "page"
	page.CreatedAt = time.Now()
	page.UpdatedAt = page.CreatedAt

	_, err := r.client.Put(ctx, page.ID, page)
	if err != nil {
		return fmt.Errorf("failed to create page: %w", err)
	}

	return nil
}

// GetByID retrieves a page by its ID
func (r *pageRepository) GetByID(ctx context.Context, id string) (*models.Page, error) {
	var page models.Page
	err := r.client.Get(ctx, id, &page)
	if err != nil {
		return nil, fmt.Errorf("failed to get page: %w", err)
	}

	return &page, nil
}

// GetBySlug retrieves a page by its slug using a view
func (r *pageRepository) GetBySlug(ctx context.Context, slug string) (*models.Page, error) {
	result, err := r.client.Query(ctx, "pages", "by_slug", map[string]interface{}{
		"key":          slug,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query page by slug: %w", err)
	}

	if len(result.Rows) == 0 {
		return nil, fmt.Errorf("page not found with slug: %s", slug)
	}

	var page models.Page
	if err := json.Unmarshal(result.Rows[0].Doc, &page); err != nil {
		return nil, fmt.Errorf("failed to unmarshal page document: %w", err)
	}

	return &page, nil
}

// Update updates an existing page document
func (r *pageRepository) Update(ctx context.Context, page *models.Page) error {
	page.UpdatedAt = time.Now()

	_, err := r.client.Put(ctx, page.ID, page)
	if err != nil {
		return fmt.Errorf("failed to update page: %w", err)
	}

	return nil
}

// Delete deletes a page document
func (r *pageRepository) Delete(ctx context.Context, id string) error {
	// First get the document to obtain the revision
	var page models.Page
	err := r.client.Get(ctx, id, &page)
	if err != nil {
		return fmt.Errorf("failed to get page for deletion: %w", err)
	}

	err = r.client.Delete(ctx, id, page.Rev)
	if err != nil {
		return fmt.Errorf("failed to delete page: %w", err)
	}

	return nil
}

// List retrieves all pages with pagination
func (r *pageRepository) List(ctx context.Context, options ListOptions) ([]*models.Page, error) {
	result, err := r.client.Query(ctx, "pages", "all", map[string]interface{}{
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pages: %w", err)
	}

	var pages []*models.Page
	for _, row := range result.Rows {
		var page models.Page
		if err := json.Unmarshal(row.Doc, &page); err != nil {
			return nil, fmt.Errorf("failed to unmarshal page document: %w", err)
		}
		pages = append(pages, &page)
	}

	return pages, nil
}

// ListByStatus retrieves pages by status with pagination
func (r *pageRepository) ListByStatus(ctx context.Context, status string, options ListOptions) ([]*models.Page, error) {
	result, err := r.client.Query(ctx, "pages", "by_status", map[string]interface{}{
		"key":          status,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pages by status: %w", err)
	}

	var pages []*models.Page
	for _, row := range result.Rows {
		var page models.Page
		if err := json.Unmarshal(row.Doc, &page); err != nil {
			return nil, fmt.Errorf("failed to unmarshal page document: %w", err)
		}
		pages = append(pages, &page)
	}

	return pages, nil
}

// Search searches for pages by query string
func (r *pageRepository) Search(ctx context.Context, query string, options ListOptions) ([]*models.Page, error) {
	// For now, we'll implement a simple search by getting all pages and filtering
	// In a production system, you might want to use CouchDB's full-text search capabilities
	allPages, err := r.List(ctx, ListOptions{
		Limit: 1000, // Get more pages for searching
		Skip:  0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get pages for search: %w", err)
	}

	var matchingPages []*models.Page
	queryLower := strings.ToLower(query)

	for _, page := range allPages {
		if r.pageMatchesQuery(page, queryLower) {
			matchingPages = append(matchingPages, page)
		}
	}

	// Apply pagination to results
	start := options.Skip
	end := start + options.Limit
	if start >= len(matchingPages) {
		return []*models.Page{}, nil
	}
	if end > len(matchingPages) {
		end = len(matchingPages)
	}

	return matchingPages[start:end], nil
}

func (r *pageRepository) pageMatchesQuery(page *models.Page, query string) bool {
	// Search in title
	if strings.Contains(strings.ToLower(page.Title), query) {
		return true
	}

	// Search in slug
	if strings.Contains(strings.ToLower(page.Slug), query) {
		return true
	}

	// Search in meta
	if strings.Contains(strings.ToLower(page.Meta.Title), query) {
		return true
	}
	if strings.Contains(strings.ToLower(page.Meta.Description), query) {
		return true
	}

	// Search in content blocks
	for _, block := range page.Content.Blocks {
		for _, value := range block.Data {
			if valueStr, ok := value.(string); ok {
				if strings.Contains(strings.ToLower(valueStr), query) {
					return true
				}
			}
		}
	}

	return false
}
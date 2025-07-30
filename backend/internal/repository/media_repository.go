package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

// mediaRepository implements MediaRepository interface
type mediaRepository struct {
	client *database.Client
}

// NewMediaRepository creates a new media repository
func NewMediaRepository(client *database.Client) MediaRepository {
	return &mediaRepository{
		client: client,
	}
}

// Create creates a new media document
func (r *mediaRepository) Create(ctx context.Context, media *models.Media) error {
	if media.ID == "" {
		media.ID = "media:" + media.Filename
	}
	media.Type = "media"
	media.CreatedAt = time.Now()

	_, err := r.client.Put(ctx, media.ID, media)
	if err != nil {
		return fmt.Errorf("failed to create media: %w", err)
	}

	return nil
}

// GetByID retrieves a media document by its ID
func (r *mediaRepository) GetByID(ctx context.Context, id string) (*models.Media, error) {
	var media models.Media
	err := r.client.Get(ctx, id, &media)
	if err != nil {
		return nil, fmt.Errorf("failed to get media: %w", err)
	}

	return &media, nil
}

// GetByFilename retrieves a media document by its filename using a view
func (r *mediaRepository) GetByFilename(ctx context.Context, filename string) (*models.Media, error) {
	result, err := r.client.Query(ctx, "media", "by_filename", map[string]interface{}{
		"key":          filename,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query media by filename: %w", err)
	}

	if len(result.Rows) == 0 {
		return nil, fmt.Errorf("media not found with filename: %s", filename)
	}

	var media models.Media
	if err := json.Unmarshal(result.Rows[0].Doc, &media); err != nil {
		return nil, fmt.Errorf("failed to unmarshal media document: %w", err)
	}

	return &media, nil
}

// Update updates an existing media document
func (r *mediaRepository) Update(ctx context.Context, media *models.Media) error {
	_, err := r.client.Put(ctx, media.ID, media)
	if err != nil {
		return fmt.Errorf("failed to update media: %w", err)
	}

	return nil
}

// Delete deletes a media document
func (r *mediaRepository) Delete(ctx context.Context, id string) error {
	// First get the document to obtain the revision
	var media models.Media
	err := r.client.Get(ctx, id, &media)
	if err != nil {
		return fmt.Errorf("failed to get media for deletion: %w", err)
	}

	err = r.client.Delete(ctx, id, media.Rev)
	if err != nil {
		return fmt.Errorf("failed to delete media: %w", err)
	}

	return nil
}

// List retrieves all media documents with pagination
func (r *mediaRepository) List(ctx context.Context, options ListOptions) ([]*models.Media, error) {
	result, err := r.client.Query(ctx, "media", "all", map[string]interface{}{
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list media: %w", err)
	}

	var mediaList []*models.Media
	for _, row := range result.Rows {
		var media models.Media
		if err := json.Unmarshal(row.Doc, &media); err != nil {
			return nil, fmt.Errorf("failed to unmarshal media document: %w", err)
		}
		mediaList = append(mediaList, &media)
	}

	return mediaList, nil
}

// ListByUploader retrieves media documents by uploader with pagination
func (r *mediaRepository) ListByUploader(ctx context.Context, uploaderID string, options ListOptions) ([]*models.Media, error) {
	result, err := r.client.Query(ctx, "media", "by_uploader", map[string]interface{}{
		"key":          uploaderID,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"include_docs": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list media by uploader: %w", err)
	}

	var mediaList []*models.Media
	for _, row := range result.Rows {
		var media models.Media
		if err := json.Unmarshal(row.Doc, &media); err != nil {
			return nil, fmt.Errorf("failed to unmarshal media document: %w", err)
		}
		mediaList = append(mediaList, &media)
	}

	return mediaList, nil
}
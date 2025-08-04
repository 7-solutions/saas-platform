package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/saas-startup-platform/backend/internal/database"
	db "github.com/saas-startup-platform/backend/internal/database/sqlc"
	"github.com/saas-startup-platform/backend/internal/models"
)

// MediaRepository defines the contract for media storage backends.
type MediaRepository interface {
	Create(ctx context.Context, media *models.Media) error
	GetByID(ctx context.Context, id string) (*models.Media, error)
	GetByFilename(ctx context.Context, filename string) (*models.Media, error)
	Update(ctx context.Context, media *models.Media) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options ListOptions) ([]*models.Media, error)
	ListByUploader(ctx context.Context, uploaderID string, options ListOptions) ([]*models.Media, error)
}

type mediaRepository struct {
client *database.Client
}

func NewMediaRepository(client *database.Client) MediaRepository {
return &mediaRepository{
	client: client,
}
}

type mediaRepositorySQL struct {
q *db.Queries
}

// Ensure SQL repo implements interface at compile time
var _ MediaRepository = (*mediaRepositorySQL)(nil)

// Ensure legacy repo implements interface at compile time
var _ MediaRepository = (*mediaRepository)(nil)

func NewMediaRepositorySQL(c *database.PostgresClient) MediaRepository {
return &mediaRepositorySQL{
	q: database.NewQueriesFromClient(c),
}
}

// Create creates a new media document (CouchDB)
func (r *mediaRepository) Create(ctx context.Context, media *models.Media) error {
	if media.ID == "" {
		media.ID = "media:" + media.Filename
	}
	media.Type = "media"
	// maintain created timestamp for CouchDB docs
	if media.CreatedAt.IsZero() {
		media.CreatedAt = time.Now()
	}

	_, err := r.client.Put(ctx, media.ID, media)
	if err != nil {
		return fmt.Errorf("failed to create media: %w", err)
	}

	return nil
}

func (r *mediaRepositorySQL) Create(ctx context.Context, m *models.Media) error {
if m.ID == "" {
	m.ID = "media:" + m.Filename
}
m.Type = "media"

row, err := r.q.InsertMedia(ctx, db.InsertMediaParams{
	Filename:   m.Filename,
	Path:       "", // not exposed in outward model
	MimeType:   m.MimeType,
	SizeBytes:  0, // not exposed in outward model
	UploaderID: pgtype.UUID{Valid: false},
})
if err != nil {
	lo := strings.ToLower(err.Error())
	if strings.Contains(lo, "unique") && strings.Contains(lo, "filename") {
		return fmt.Errorf("failed to create media: filename already exists")
	}
	return fmt.Errorf("failed to create media: %w", err)
}
m.CreatedAt = row.CreatedAt.Time
return nil
}

func (r *mediaRepository) GetByID(ctx context.Context, id string) (*models.Media, error) {
var media models.Media
err := r.client.Get(ctx, id, &media)
if err != nil {
	return nil, fmt.Errorf("failed to get media: %w", err)
}

return &media, nil
}

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

// GetByFilename retrieves media by filename (PostgreSQL)
func (r *mediaRepositorySQL) GetByFilename(ctx context.Context, filename string) (*models.Media, error) {
	row, err := r.q.GetMediaByFilename(ctx, filename)
	if err != nil {
		return nil, fmt.Errorf("failed to get media by filename: %w", err)
	}
	m := &models.Media{
		ID:        "media:" + row.Filename,
		Type:      "media",
		Filename:  row.Filename,
		MimeType:  row.MimeType,
		CreatedAt: row.CreatedAt.Time,
	}
	return m, nil
}

// Update updates an existing media document (CouchDB)
func (r *mediaRepository) Update(ctx context.Context, media *models.Media) error {
	_, err := r.client.Upsert(ctx, media.ID, media)
	if err != nil {
		return fmt.Errorf("failed to update media: %w", err)
	}

	return nil
}

// Update updates existing media (PostgreSQL)
func (r *mediaRepositorySQL) Update(ctx context.Context, m *models.Media) error {
	row, err := r.q.GetMediaByFilename(ctx, m.Filename)
	if err != nil {
		return fmt.Errorf("failed to resolve media by filename: %w", err)
	}

	updated, err := r.q.UpdateMedia(ctx, db.UpdateMediaParams{
		ID:   row.ID,
		Path: row.Path, // unchanged
		MimeType: func() string {
			if m.MimeType != "" {
				return m.MimeType
			}
			return row.MimeType
		}(),
		SizeBytes: row.SizeBytes, // unchanged
	})
	if err != nil {
		return fmt.Errorf("failed to update media: %w", err)
	}

	m.CreatedAt = updated.CreatedAt.Time
	return nil
}

// Delete deletes a media document (CouchDB)
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

// Delete deletes media (PostgreSQL). Accepts "media:{filename}" or raw filename.
func (r *mediaRepositorySQL) Delete(ctx context.Context, id string) error {
	filename := strings.TrimPrefix(id, "media:")
	row, err := r.q.GetMediaByFilename(ctx, filename)
	if err != nil {
		return fmt.Errorf("failed to resolve media by filename for delete: %w", err)
	}
	if err := r.q.DeleteMediaByID(ctx, row.ID); err != nil {
		return fmt.Errorf("failed to delete media: %w", err)
	}
	return nil
}

// List retrieves all media documents with pagination (CouchDB)
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

// List returns paginated list of media (PostgreSQL) ordered by created_at desc
func (r *mediaRepositorySQL) List(ctx context.Context, options ListOptions) ([]*models.Media, error) {
	rows, err := r.q.ListMediaAll(ctx, db.ListMediaAllParams{
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list media: %w", err)
	}
	out := make([]*models.Media, 0, len(rows))
	for _, row := range rows {
		out = append(out, &models.Media{
			ID:        "media:" + row.Filename,
			Type:      "media",
			Filename:  row.Filename,
			MimeType:  row.MimeType,
			CreatedAt: row.CreatedAt.Time,
		})
	}
	return out, nil
}

// ListByUploader lists media by uploader (PostgreSQL)
func (r *mediaRepositorySQL) ListByUploader(ctx context.Context, uploaderID string, options ListOptions) ([]*models.Media, error) {
	var uid pgtype.UUID
	uid.Valid = false
	if uploaderID != "" {
		if err := uid.Scan(uploaderID); err != nil {
			return nil, fmt.Errorf("invalid uploader id: %w", err)
		}
		uid.Valid = true
	}
	rows, err := r.q.ListMediaByUploader(ctx, db.ListMediaByUploaderParams{
		UploaderID: uid,
		Limit:      int32(options.Limit),
		Offset:     int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list media by uploader: %w", err)
	}
	out := make([]*models.Media, 0, len(rows))
	for _, row := range rows {
		out = append(out, &models.Media{
			ID:        "media:" + row.Filename,
			Type:      "media",
			Filename:  row.Filename,
			MimeType:  row.MimeType,
			CreatedAt: row.CreatedAt.Time,
		})
	}
	return out, nil
}

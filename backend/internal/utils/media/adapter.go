package media

import (
	"context"
	"fmt"
	"time"

	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
)

// TODO: Move this interface to backend/internal/ports once canonical ports are added.
// MediaStorage describes basic media operations.
type MediaStorage interface {
	// Upload stores the content for a given key and returns a deterministic placeholder URL.
	// Uses io.Reader semantics conceptually; for now we take []byte to stay provider-agnostic.
	Upload(ctx context.Context, key string, content []byte, contentType string) (string, error)
	// Delete removes an object by key.
	Delete(ctx context.Context, key string) error
	// GenerateSignedURL returns a time-limited URL for the given key and operation.
	GenerateSignedURL(ctx context.Context, key string, operation string, expiresIn time.Duration) (string, error)
}

// MediaStorageS3Adapter is a minimal placeholder S3/GCS-style adapter.
// TODO: Wire real S3/GCS client, endpoint, and credentials.
type MediaStorageS3Adapter struct {
	bucket   string
	endpoint string
	region   string
	accessID string
	secret   string
	// TODO: client any // placeholder for SDK client
	// Keep no-op/placeholder behavior for now.
}

// NewMediaStorageS3 constructs the adapter with placeholders for endpoint/creds.
func NewMediaStorageS3(bucket, endpoint, region, accessID, secret string) *MediaStorageS3Adapter {
	return &MediaStorageS3Adapter{
		bucket:   bucket,
		endpoint: endpoint,
		region:   region,
		accessID: accessID,
		secret:   secret,
	}
}

// Upload stores content bytes for the provided key.
// Returns a deterministic placeholder URL. Wraps errors with context if any occur.
func (a *MediaStorageS3Adapter) Upload(ctx context.Context, key string, content []byte, contentType string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// TODO: Implement actual upload using provider SDK with ctx; respect cancellation/timeouts.
	// For now, simulate success and return deterministic placeholder URL.
	url := fmt.Sprintf("https://%s/%s/%s", a.endpoint, a.bucket, key)
	return url, nil
}

// Delete removes an object identified by key.
func (a *MediaStorageS3Adapter) Delete(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	// TODO: Implement actual delete via provider SDK; map not-found to appErr.ErrNotFound.
	// Placeholder: assume it exists and is deleted.
	_ = key
	return nil
}

// GenerateSignedURL returns a placeholder signed URL with expiry seconds embedded.
func (a *MediaStorageS3Adapter) GenerateSignedURL(ctx context.Context, key string, operation string, expiresIn time.Duration) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// Validate operation minimally.
	switch operation {
	case "GET", "PUT", "DELETE":
	default:
		// Normalize to conflict for unsupported operation
		return "", appErr.ErrConflict
	}

	// TODO: Use SDK presigners to generate signed URL honoring ctx and expiresIn.
	url := fmt.Sprintf("https://%s/%s/%s?op=%s&exp=%d", a.endpoint, a.bucket, key, operation, int64(expiresIn.Seconds()))
	return url, nil
}

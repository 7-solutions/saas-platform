package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMediaRepository_Create(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	media := CreateTestMedia("test-image.jpg", "user:admin@example.com")
	
	err := repo.Create(ctx, media)
	require.NoError(t, err)

	// Verify the media was created
	assert.NotEmpty(t, media.ID)
	assert.Equal(t, "media", media.Type)
	assert.False(t, media.CreatedAt.IsZero())
}

func TestMediaRepository_GetByID(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create a test media
	originalMedia := CreateTestMedia("test-image.jpg", "user:admin@example.com")
	err := repo.Create(ctx, originalMedia)
	require.NoError(t, err)

	// Retrieve the media
	retrievedMedia, err := repo.GetByID(ctx, originalMedia.ID)
	require.NoError(t, err)

	assert.Equal(t, originalMedia.ID, retrievedMedia.ID)
	assert.Equal(t, originalMedia.Filename, retrievedMedia.Filename)
	assert.Equal(t, originalMedia.MimeType, retrievedMedia.MimeType)
	assert.Equal(t, originalMedia.Type, retrievedMedia.Type)
}

func TestMediaRepository_GetByID_NotFound(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	_, err := repo.GetByID(ctx, "media:nonexistent.jpg")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestMediaRepository_GetByFilename(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create a test media
	originalMedia := CreateTestMedia("test-image.jpg", "user:admin@example.com")
	err := repo.Create(ctx, originalMedia)
	require.NoError(t, err)


	// Retrieve the media by filename
	retrievedMedia, err := repo.GetByFilename(ctx, "test-image.jpg")
	require.NoError(t, err)

	assert.Equal(t, originalMedia.ID, retrievedMedia.ID)
	assert.Equal(t, originalMedia.Filename, retrievedMedia.Filename)
}

func TestMediaRepository_Update(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create a test media
	media := CreateTestMedia("test-image.jpg", "user:admin@example.com")
	err := repo.Create(ctx, media)
	require.NoError(t, err)

	// Get the latest version to get the revision
	latestMedia, err := repo.GetByID(ctx, media.ID)
	require.NoError(t, err)

	// Update the media
	latestMedia.AltText = "Updated alt text"
	
	err = repo.Update(ctx, latestMedia)
	require.NoError(t, err)

	// Verify the update
	updatedMedia, err := repo.GetByID(ctx, latestMedia.ID)
	require.NoError(t, err)

	assert.Equal(t, "Updated alt text", updatedMedia.AltText)
}

func TestMediaRepository_Delete(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create a test media
	media := CreateTestMedia("test-image.jpg", "user:admin@example.com")
	err := repo.Create(ctx, media)
	require.NoError(t, err)

	// Delete the media
	err = repo.Delete(ctx, media.ID)
	require.NoError(t, err)

	// Verify the media is deleted
	_, err = repo.GetByID(ctx, media.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestMediaRepository_List(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create test media
	media1 := CreateTestMedia("image1.jpg", "user:admin@example.com")
	media2 := CreateTestMedia("image2.jpg", "user:admin@example.com")
	
	err := repo.Create(ctx, media1)
	require.NoError(t, err)
	
	err = repo.Create(ctx, media2)
	require.NoError(t, err)


	// List media
	options := DefaultListOptions()
	mediaList, err := repo.List(ctx, options)
	require.NoError(t, err)

	assert.Len(t, mediaList, 2)
}

func TestMediaRepository_ListByUploader(t *testing.T) {
	_ = SetupTestDB(t)

	client := SetupTestPGClient(t)
	repo := NewMediaRepositorySQL(client)
	ctx := context.Background()

	// Create test media with different uploaders
	media1 := CreateTestMedia("image1.jpg", "user:admin@example.com")
	media2 := CreateTestMedia("image2.jpg", "user:editor@example.com")
	media3 := CreateTestMedia("image3.jpg", "user:admin@example.com")
	
	err := repo.Create(ctx, media1)
	require.NoError(t, err)
	
	err = repo.Create(ctx, media2)
	require.NoError(t, err)
	
	err = repo.Create(ctx, media3)
	require.NoError(t, err)


	// List media by admin uploader
	options := DefaultListOptions()
	adminMedia, err := repo.ListByUploader(ctx, "user:admin@example.com", options)
	require.NoError(t, err)

	assert.Len(t, adminMedia, 2)
	for _, media := range adminMedia {
		assert.Equal(t, "user:admin@example.com", media.UploadedBy)
	}

	// List media by editor uploader
	editorMedia, err := repo.ListByUploader(ctx, "user:editor@example.com", options)
	require.NoError(t, err)

	assert.Len(t, editorMedia, 1)
	assert.Equal(t, "user:editor@example.com", editorMedia[0].UploadedBy)
}
package repository

import (
	"context"
	"testing"
	"time"

	"github.com/saas-startup-platform/backend/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPageRepository_Create(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	page := CreateTestPage("test-page", "Test Page")
	
	err := repo.Create(ctx, page)
	require.NoError(t, err)

	// Verify the page was created
	assert.NotEmpty(t, page.ID)
	assert.Equal(t, "page", page.Type)
	assert.False(t, page.CreatedAt.IsZero())
	assert.False(t, page.UpdatedAt.IsZero())
}

func TestPageRepository_GetByID(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Create a test page
	originalPage := CreateTestPage("test-page", "Test Page")
	err := repo.Create(ctx, originalPage)
	require.NoError(t, err)

	// Retrieve the page
	retrievedPage, err := repo.GetByID(ctx, originalPage.ID)
	require.NoError(t, err)

	assert.Equal(t, originalPage.ID, retrievedPage.ID)
	assert.Equal(t, originalPage.Title, retrievedPage.Title)
	assert.Equal(t, originalPage.Slug, retrievedPage.Slug)
	assert.Equal(t, originalPage.Type, retrievedPage.Type)
}

func TestPageRepository_GetByID_NotFound(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	_, err := repo.GetByID(ctx, "page:nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestPageRepository_GetBySlug(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/pages", "by_slug")

	// Create a test page
	originalPage := CreateTestPage("test-page", "Test Page")
	err := repo.Create(ctx, originalPage)
	require.NoError(t, err)

	// Wait a bit for the view to update
	time.Sleep(100 * time.Millisecond)

	// Retrieve the page by slug
	retrievedPage, err := repo.GetBySlug(ctx, "test-page")
	require.NoError(t, err)

	assert.Equal(t, originalPage.ID, retrievedPage.ID)
	assert.Equal(t, originalPage.Slug, retrievedPage.Slug)
}

func TestPageRepository_Update(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Create a test page
	page := CreateTestPage("test-page", "Test Page")
	err := repo.Create(ctx, page)
	require.NoError(t, err)

	originalUpdatedAt := page.UpdatedAt

	// Get the latest version to get the revision
	latestPage, err := repo.GetByID(ctx, page.ID)
	require.NoError(t, err)

	// Update the page
	latestPage.Title = "Updated Test Page"
	time.Sleep(10 * time.Millisecond) // Ensure different timestamp
	
	err = repo.Update(ctx, latestPage)
	require.NoError(t, err)

	// Verify the update
	updatedPage, err := repo.GetByID(ctx, latestPage.ID)
	require.NoError(t, err)

	assert.Equal(t, "Updated Test Page", updatedPage.Title)
	assert.True(t, updatedPage.UpdatedAt.After(originalUpdatedAt))
}

func TestPageRepository_Delete(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Create a test page
	page := CreateTestPage("test-page", "Test Page")
	err := repo.Create(ctx, page)
	require.NoError(t, err)

	// Delete the page
	err = repo.Delete(ctx, page.ID)
	require.NoError(t, err)

	// Verify the page is deleted
	_, err = repo.GetByID(ctx, page.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestPageRepository_List(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/pages", "all")

	// Create test pages
	page1 := CreateTestPage("page-1", "Page 1")
	page2 := CreateTestPage("page-2", "Page 2")
	
	err := repo.Create(ctx, page1)
	require.NoError(t, err)
	
	err = repo.Create(ctx, page2)
	require.NoError(t, err)

	// Wait for views to update
	time.Sleep(100 * time.Millisecond)

	// List pages
	options := DefaultListOptions()
	pages, err := repo.List(ctx, options)
	require.NoError(t, err)

	assert.Len(t, pages, 2)
}

func TestPageRepository_ListByStatus(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewPageRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/pages", "by_status")

	// Create test pages with different statuses
	page1 := CreateTestPage("page-1", "Page 1")
	page1.Status = models.PageStatusPublished
	
	page2 := CreateTestPage("page-2", "Page 2")
	page2.Status = models.PageStatusDraft
	
	err := repo.Create(ctx, page1)
	require.NoError(t, err)
	
	err = repo.Create(ctx, page2)
	require.NoError(t, err)

	// Wait for views to update
	time.Sleep(100 * time.Millisecond)

	// List published pages
	options := DefaultListOptions()
	publishedPages, err := repo.ListByStatus(ctx, models.PageStatusPublished, options)
	require.NoError(t, err)

	assert.Len(t, publishedPages, 1)
	assert.Equal(t, models.PageStatusPublished, publishedPages[0].Status)

	// List draft pages
	draftPages, err := repo.ListByStatus(ctx, models.PageStatusDraft, options)
	require.NoError(t, err)

	assert.Len(t, draftPages, 1)
	assert.Equal(t, models.PageStatusDraft, draftPages[0].Status)
}
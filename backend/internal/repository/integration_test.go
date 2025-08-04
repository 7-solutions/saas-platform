package repository

import (
	"context"
	"testing"

	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRepositoryIntegration tests the basic CRUD operations for all repositories
func TestRepositoryIntegration(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	ctx := context.Background()

	// Test User Repository
	t.Run("UserRepository", func(t *testing.T) {
		userRepo := NewUserRepository(client)

		// Create user
		user := CreateTestUser("integration@example.com", models.UserRoleAdmin)
		err := userRepo.Create(ctx, user)
		require.NoError(t, err)

		// Get user
		retrievedUser, err := userRepo.GetByID(ctx, user.ID)
		require.NoError(t, err)
		assert.Equal(t, user.Email, retrievedUser.Email)

		// Update user
		retrievedUser.Profile.Name = "Integration Test User"
		err = userRepo.Update(ctx, retrievedUser)
		require.NoError(t, err)

		// Verify update
		updatedUser, err := userRepo.GetByID(ctx, user.ID)
		require.NoError(t, err)
		assert.Equal(t, "Integration Test User", updatedUser.Profile.Name)

		// Delete user
		err = userRepo.Delete(ctx, user.ID)
		require.NoError(t, err)

		// Verify deletion
		_, err = userRepo.GetByID(ctx, user.ID)
		assert.Error(t, err)
	})

	// Test Page Repository
	t.Run("PageRepository", func(t *testing.T) {
		pageRepo := NewPageRepository(client)

		// Create page
		page := CreateTestPage("integration-test", "Integration Test Page")
		err := pageRepo.Create(ctx, page)
		require.NoError(t, err)

		// Get page
		retrievedPage, err := pageRepo.GetByID(ctx, page.ID)
		require.NoError(t, err)
		assert.Equal(t, page.Title, retrievedPage.Title)

		// Update page
		retrievedPage.Title = "Updated Integration Test Page"
		err = pageRepo.Update(ctx, retrievedPage)
		require.NoError(t, err)

		// Verify update
		updatedPage, err := pageRepo.GetByID(ctx, page.ID)
		require.NoError(t, err)
		assert.Equal(t, "Updated Integration Test Page", updatedPage.Title)

		// Delete page
		err = pageRepo.Delete(ctx, page.ID)
		require.NoError(t, err)

		// Verify deletion
		_, err = pageRepo.GetByID(ctx, page.ID)
		assert.Error(t, err)
	})

	// Test Media Repository
	t.Run("MediaRepository", func(t *testing.T) {
		mediaRepo := NewMediaRepository(client)

		// Create media
		media := CreateTestMedia("integration-test.jpg", "user:admin@example.com")
		err := mediaRepo.Create(ctx, media)
		require.NoError(t, err)

		// Get media
		retrievedMedia, err := mediaRepo.GetByID(ctx, media.ID)
		require.NoError(t, err)
		assert.Equal(t, media.Filename, retrievedMedia.Filename)

		// Update media
		retrievedMedia.AltText = "Integration test image"
		err = mediaRepo.Update(ctx, retrievedMedia)
		require.NoError(t, err)

		// Verify update
		updatedMedia, err := mediaRepo.GetByID(ctx, media.ID)
		require.NoError(t, err)
		assert.Equal(t, "Integration test image", updatedMedia.AltText)

		// Delete media
		err = mediaRepo.Delete(ctx, media.ID)
		require.NoError(t, err)

		// Verify deletion
		_, err = mediaRepo.GetByID(ctx, media.ID)
		assert.Error(t, err)
	})
}

// TestDatabaseConnection tests that the database connection is working
func TestDatabaseConnection(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	ctx := context.Background()

	// Test ping
	err := client.Ping(ctx)
	assert.NoError(t, err)
}

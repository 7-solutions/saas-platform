package repository

import (
	"context"
	"testing"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserRepository_Create(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	user := CreateTestUser("test@example.com", models.UserRoleAdmin)

	err := repo.Create(ctx, user)
	require.NoError(t, err)

	// Verify the user was created
	assert.NotEmpty(t, user.ID)
	assert.Equal(t, "user", user.Type)
	assert.False(t, user.CreatedAt.IsZero())
}

func TestUserRepository_GetByID(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Create a test user
	originalUser := CreateTestUser("test@example.com", models.UserRoleAdmin)
	err := repo.Create(ctx, originalUser)
	require.NoError(t, err)

	// Retrieve the user
	retrievedUser, err := repo.GetByID(ctx, originalUser.ID)
	require.NoError(t, err)

	assert.Equal(t, originalUser.ID, retrievedUser.ID)
	assert.Equal(t, originalUser.Email, retrievedUser.Email)
	assert.Equal(t, originalUser.Role, retrievedUser.Role)
	assert.Equal(t, originalUser.Type, retrievedUser.Type)
}

func TestUserRepository_GetByID_NotFound(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	_, err := repo.GetByID(ctx, "user:nonexistent@example.com")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestUserRepository_GetByEmail(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/users", "by_email")

	// Create a test user
	originalUser := CreateTestUser("test@example.com", models.UserRoleAdmin)
	err := repo.Create(ctx, originalUser)
	require.NoError(t, err)

	// Wait a bit for the view to update
	time.Sleep(100 * time.Millisecond)

	// Retrieve the user by email
	retrievedUser, err := repo.GetByEmail(ctx, "test@example.com")
	require.NoError(t, err)

	assert.Equal(t, originalUser.ID, retrievedUser.ID)
	assert.Equal(t, originalUser.Email, retrievedUser.Email)
}

func TestUserRepository_Update(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Create a test user
	user := CreateTestUser("test@example.com", models.UserRoleAdmin)
	err := repo.Create(ctx, user)
	require.NoError(t, err)

	// Get the latest version to get the revision
	latestUser, err := repo.GetByID(ctx, user.ID)
	require.NoError(t, err)

	// Update the user
	latestUser.Profile.Name = "Updated Name"
	latestUser.Role = models.UserRoleEditor

	err = repo.Update(ctx, latestUser)
	require.NoError(t, err)

	// Verify the update
	updatedUser, err := repo.GetByID(ctx, latestUser.ID)
	require.NoError(t, err)

	assert.Equal(t, "Updated Name", updatedUser.Profile.Name)
	assert.Equal(t, models.UserRoleEditor, updatedUser.Role)
}

func TestUserRepository_Delete(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Create a test user
	user := CreateTestUser("test@example.com", models.UserRoleAdmin)
	err := repo.Create(ctx, user)
	require.NoError(t, err)

	// Delete the user
	err = repo.Delete(ctx, user.ID)
	require.NoError(t, err)

	// Verify the user is deleted
	_, err = repo.GetByID(ctx, user.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "document not found")
}

func TestUserRepository_List(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/users", "all")

	// Create test users
	user1 := CreateTestUser("user1@example.com", models.UserRoleAdmin)
	user2 := CreateTestUser("user2@example.com", models.UserRoleEditor)

	err := repo.Create(ctx, user1)
	require.NoError(t, err)

	err = repo.Create(ctx, user2)
	require.NoError(t, err)

	// Wait for views to update
	time.Sleep(100 * time.Millisecond)

	// List users
	options := DefaultListOptions()
	users, err := repo.List(ctx, options)
	require.NoError(t, err)

	assert.Len(t, users, 2)
}

func TestUserRepository_ListByRole(t *testing.T) {
	client := SetupTestDB(t)
	defer CleanupTestDB(t, client)

	repo := NewUserRepository(client)
	ctx := context.Background()

	// Wait for views to be available
	WaitForView(t, client, "_design/users", "by_role")

	// Create test users with different roles
	user1 := CreateTestUser("admin@example.com", models.UserRoleAdmin)
	user2 := CreateTestUser("editor@example.com", models.UserRoleEditor)
	user3 := CreateTestUser("admin2@example.com", models.UserRoleAdmin)

	err := repo.Create(ctx, user1)
	require.NoError(t, err)

	err = repo.Create(ctx, user2)
	require.NoError(t, err)

	err = repo.Create(ctx, user3)
	require.NoError(t, err)

	// Wait for views to update
	time.Sleep(100 * time.Millisecond)

	// List admin users
	options := DefaultListOptions()
	adminUsers, err := repo.ListByRole(ctx, models.UserRoleAdmin, options)
	require.NoError(t, err)

	assert.Len(t, adminUsers, 2)
	for _, user := range adminUsers {
		assert.Equal(t, models.UserRoleAdmin, user.Role)
	}

	// List editor users
	editorUsers, err := repo.ListByRole(ctx, models.UserRoleEditor, options)
	require.NoError(t, err)

	assert.Len(t, editorUsers, 1)
	assert.Equal(t, models.UserRoleEditor, editorUsers[0].Role)
}

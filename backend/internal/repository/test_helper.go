package repository

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
	"github.com/stretchr/testify/require"
)

// TestDBConfig holds test database configuration
type TestDBConfig struct {
	URL      string
	Username string
	Password string
	Database string
}

// DefaultTestDBConfig returns default test database configuration
func DefaultTestDBConfig() TestDBConfig {
	return TestDBConfig{
		URL:      "http://localhost:5984",
		Username: "admin",
		Password: "password",
		Database: "test_saas_platform",
	}
}

// SetupTestDB creates a test database client and sets up views
func SetupTestDB(t *testing.T) *database.Client {
	config := DefaultTestDBConfig()
	
	client, err := database.NewClient(database.Config{
		URL:      config.URL,
		Username: config.Username,
		Password: config.Password,
		Database: config.Database,
	})
	require.NoError(t, err, "Failed to create test database client")

	// Setup views with retry
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var setupErr error
	for i := 0; i < 3; i++ {
		setupErr = client.SetupViews(ctx)
		if setupErr == nil {
			break
		}
		time.Sleep(1 * time.Second)
	}
	
	if setupErr != nil {
		t.Logf("Warning: Failed to setup database views after retries: %v", setupErr)
	}

	return client
}

// CleanupTestDB cleans up the test database
func CleanupTestDB(t *testing.T, client *database.Client) {
	if client == nil {
		return
	}

	config := DefaultTestDBConfig()
	
	// Delete the test database
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Make HTTP request to delete the database
	httpClient := &http.Client{Timeout: 10 * time.Second}
	url := config.URL + "/" + config.Database
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		t.Logf("Failed to create delete request: %v", err)
		return
	}

	if config.Username != "" && config.Password != "" {
		req.SetBasicAuth(config.Username, config.Password)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		t.Logf("Failed to delete test database: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Logf("Failed to delete test database, status: %d", resp.StatusCode)
	}

	client.Close()
}

// CreateTestPage creates a test page for testing
func CreateTestPage(slug, title string) *models.Page {
	return models.NewPage(title, slug)
}

// CreateTestUser creates a test user for testing
func CreateTestUser(email, role string) *models.User {
	return models.NewUser(email, "hashed_password", role)
}

// CreateTestMedia creates a test media for testing
func CreateTestMedia(filename, uploader string) *models.Media {
	return models.NewMedia(filename, filename, "image/jpeg", uploader, 1024)
}

// WaitForView waits for a CouchDB view to be available
func WaitForView(t *testing.T, client *database.Client, designDoc, viewName string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// First ensure views are set up
	err := client.SetupViews(ctx)
	if err != nil {
		t.Logf("Warning: Failed to setup views: %v", err)
	}

	// Wait for view to be available
	for {
		select {
		case <-ctx.Done():
			t.Logf("Timeout waiting for view %s/%s to be available", designDoc, viewName)
			return // Don't fail the test, just log and continue
		default:
			_, err := client.Query(ctx, designDoc, viewName, map[string]interface{}{
				"limit": 1,
			})
			if err == nil {
				return
			}
			time.Sleep(200 * time.Millisecond)
		}
	}
}
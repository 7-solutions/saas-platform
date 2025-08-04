package services

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contentv1 "github.com/saas-startup-platform/backend/gen/content/v1"
	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/repository"
)

// minimal helper mirroring repository getenvDefault to avoid import cycle
func getenvDefaultForTests(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func setupContentServiceTest(t *testing.T) (*ContentService, func()) {
	// Create a unique database per test to avoid cross-test contamination
	dbName := getenvDefaultForTests("COUCHDB_DATABASE", "")
	if dbName == "" {
		dbName = fmt.Sprintf("test_saas_platform_services_%d", time.Now().UnixNano())
	}
	client, err := database.NewClient(database.Config{
		URL:      getenvDefaultForTests("COUCHDB_URL", "http://localhost:15984"),
		Username: getenvDefaultForTests("COUCHDB_USERNAME", "admin"),
		Password: getenvDefaultForTests("COUCHDB_PASSWORD", "adminpass"),
		Database: dbName,
	})
	require.NoError(t, err)

	// Setup views
	ctx := context.Background()
	err = client.SetupViews(ctx)
	require.NoError(t, err)

	// Create repositories
	pageRepo := repository.NewPageRepository(client)

	// Create service
	blogRepo := repository.NewBlogRepository(client)
	service := NewContentService(pageRepo, blogRepo)

	// Return cleanup function
	cleanup := func() {
		client.Close()
	}

	return service, cleanup
}

func TestContentService_CreatePage(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	tests := []struct {
		name    string
		request *contentv1.CreatePageRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid page creation",
			request: &contentv1.CreatePageRequest{
				Title: "Test Page",
				Slug:  "test-page",
				Content: &contentv1.PageContent{
					Blocks: []*contentv1.ContentBlock{
						{
							Type: "hero",
							Data: map[string]string{
								"title":    "Welcome",
								"subtitle": "Test page",
							},
						},
					},
				},
				Meta: &contentv1.PageMeta{
					Title:       "Test Page - Site",
					Description: "A test page",
					Keywords:    []string{"test", "page"},
				},
				Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
			},
			wantErr: false,
		},
		{
			name: "page creation without slug (auto-generated)",
			request: &contentv1.CreatePageRequest{
				Title: "Auto Slug Page",
				Content: &contentv1.PageContent{
					Blocks: []*contentv1.ContentBlock{},
				},
				Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
			},
			wantErr: false,
		},
		{
			name: "invalid page creation - empty title",
			request: &contentv1.CreatePageRequest{
				Title: "",
				Slug:  "empty-title",
			},
			wantErr: true,
			errMsg:  "title is required",
		},
		{
			name: "invalid page creation - title too long",
			request: &contentv1.CreatePageRequest{
				Title: string(make([]byte, 201)), // 201 characters
				Slug:  "long-title",
			},
			wantErr: true,
			errMsg:  "title must be less than 200 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			page, err := service.CreatePage(ctx, tt.request)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
				assert.Nil(t, page)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, page)
				assert.Equal(t, tt.request.Title, page.Title)
				assert.NotEmpty(t, page.Id)
				assert.NotEmpty(t, page.Slug)
				assert.NotNil(t, page.CreatedAt)
				assert.NotNil(t, page.UpdatedAt)

				// Verify slug generation if not provided
				if tt.request.Slug == "" {
					expectedSlug := service.generateSlug(tt.request.Title)
					assert.Equal(t, expectedSlug, page.Slug)
				}
			}
		})
	}
}

func TestContentService_GetPage(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test page first
	createReq := &contentv1.CreatePageRequest{
		Title: "Get Test Page",
		Slug:  "get-test-page",
		Content: &contentv1.PageContent{
			Blocks: []*contentv1.ContentBlock{
				{
					Type: "text",
					Data: map[string]string{"content": "Test content"},
				},
			},
		},
		Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
	}

	createdPage, err := service.CreatePage(ctx, createReq)
	require.NoError(t, err)

	tests := []struct {
		name    string
		pageID  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid page retrieval",
			pageID:  createdPage.Id,
			wantErr: false,
		},
		{
			name:    "invalid page retrieval - empty ID",
			pageID:  "",
			wantErr: true,
			errMsg:  "page ID is required",
		},
		{
			name:    "invalid page retrieval - non-existent ID",
			pageID:  "page:non-existent",
			wantErr: true,
			errMsg:  "page not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &contentv1.GetPageRequest{Id: tt.pageID}
			page, err := service.GetPage(ctx, req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
				assert.Nil(t, page)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, page)
				assert.Equal(t, tt.pageID, page.Id)
				assert.Equal(t, "Get Test Page", page.Title)
			}
		})
	}
}

func TestContentService_UpdatePage(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test page first
	createReq := &contentv1.CreatePageRequest{
		Title:  "Update Test Page",
		Slug:   "update-test-page",
		Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
	}

	createdPage, err := service.CreatePage(ctx, createReq)
	require.NoError(t, err)

	tests := []struct {
		name    string
		request *contentv1.UpdatePageRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid page update",
			request: &contentv1.UpdatePageRequest{
				Id:    createdPage.Id,
				Title: "Updated Test Page",
				Slug:  "updated-test-page",
				Content: &contentv1.PageContent{
					Blocks: []*contentv1.ContentBlock{
						{
							Type: "text",
							Data: map[string]string{"content": "Updated content"},
						},
					},
				},
				Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
			},
			wantErr: false,
		},
		{
			name: "invalid page update - empty ID",
			request: &contentv1.UpdatePageRequest{
				Id:    "",
				Title: "Updated Page",
			},
			wantErr: true,
			errMsg:  "page ID is required",
		},
		{
			name: "invalid page update - empty title",
			request: &contentv1.UpdatePageRequest{
				Id:    createdPage.Id,
				Title: "",
			},
			wantErr: true,
			errMsg:  "title is required",
		},
		{
			name: "invalid page update - non-existent page",
			request: &contentv1.UpdatePageRequest{
				Id:    "page:non-existent",
				Title: "Updated Page",
			},
			wantErr: true,
			errMsg:  "page not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			page, err := service.UpdatePage(ctx, tt.request)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
				assert.Nil(t, page)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, page)
				assert.Equal(t, tt.request.Id, page.Id)
				assert.Equal(t, tt.request.Title, page.Title)
				assert.Equal(t, tt.request.Status, page.Status)
			}
		})
	}
}

func TestContentService_DeletePage(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test page first
	createReq := &contentv1.CreatePageRequest{
		Title:  "Delete Test Page",
		Slug:   "delete-test-page",
		Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
	}

	createdPage, err := service.CreatePage(ctx, createReq)
	require.NoError(t, err)

	tests := []struct {
		name    string
		pageID  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid page deletion",
			pageID:  createdPage.Id,
			wantErr: false,
		},
		{
			name:    "invalid page deletion - empty ID",
			pageID:  "",
			wantErr: true,
			errMsg:  "page ID is required",
		},
		{
			name:    "invalid page deletion - non-existent page",
			pageID:  "page:non-existent",
			wantErr: true,
			errMsg:  "page not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &contentv1.DeletePageRequest{Id: tt.pageID}
			_, err := service.DeletePage(ctx, req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)

				// Verify page is actually deleted
				getReq := &contentv1.GetPageRequest{Id: tt.pageID}
				_, getErr := service.GetPage(ctx, getReq)
				assert.Error(t, getErr)
				assert.Contains(t, getErr.Error(), "page not found")
			}
		})
	}
}

func TestContentService_ListPages(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test pages
	testPages := []*contentv1.CreatePageRequest{
		{
			Title:  "Published Page 1",
			Slug:   "published-page-1",
			Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
		},
		{
			Title:  "Published Page 2",
			Slug:   "published-page-2",
			Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
		},
		{
			Title:  "Draft Page 1",
			Slug:   "draft-page-1",
			Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
		},
	}

	for _, pageReq := range testPages {
		_, err := service.CreatePage(ctx, pageReq)
		require.NoError(t, err)
	}

	tests := []struct {
		name           string
		request        *contentv1.ListPagesRequest
		expectedCount  int
		expectedStatus contentv1.PageStatus
	}{
		{
			name: "list all pages",
			request: &contentv1.ListPagesRequest{
				PageSize: 10,
			},
			expectedCount: 3,
		},
		{
			name: "list published pages only",
			request: &contentv1.ListPagesRequest{
				PageSize: 10,
				Status:   contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
			},
			expectedCount:  2,
			expectedStatus: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
		},
		{
			name: "list draft pages only",
			request: &contentv1.ListPagesRequest{
				PageSize: 10,
				Status:   contentv1.PageStatus_PAGE_STATUS_DRAFT,
			},
			expectedCount:  1,
			expectedStatus: contentv1.PageStatus_PAGE_STATUS_DRAFT,
		},
		{
			name: "list with pagination",
			request: &contentv1.ListPagesRequest{
				PageSize: 2,
			},
			expectedCount: 2,
		},
		{
			name: "search pages",
			request: &contentv1.ListPagesRequest{
				PageSize: 10,
				Search:   "Published",
			},
			expectedCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.ListPages(ctx, tt.request)

			assert.NoError(t, err)
			assert.NotNil(t, resp)
			assert.Len(t, resp.Pages, tt.expectedCount)

			// Check status filtering if specified
			if tt.expectedStatus != contentv1.PageStatus_PAGE_STATUS_UNSPECIFIED {
				for _, page := range resp.Pages {
					assert.Equal(t, tt.expectedStatus, page.Status)
				}
			}

			// Check pagination token
			if tt.request.PageSize > 0 && len(resp.Pages) == int(tt.request.PageSize) {
				// Should have next page token if we got a full page
				assert.NotEmpty(t, resp.NextPageToken)
			}
		})
	}
}

func TestContentService_SlugGeneration(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	tests := []struct {
		name     string
		title    string
		expected string
	}{
		{
			name:     "simple title",
			title:    "Hello World",
			expected: "hello-world",
		},
		{
			name:     "title with special characters",
			title:    "Hello, World! & More",
			expected: "hello-world-more",
		},
		{
			name:     "title with numbers",
			title:    "Page 123 Test",
			expected: "page-123-test",
		},
		{
			name:     "title with multiple spaces",
			title:    "Multiple   Spaces   Here",
			expected: "multiple-spaces-here",
		},
		{
			name:     "empty title",
			title:    "",
			expected: "page",
		},
		{
			name:     "title with only special characters",
			title:    "!@#$%^&*()",
			expected: "page",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.generateSlug(tt.title)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestContentService_SlugUniqueness(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a page with a specific slug
	createReq := &contentv1.CreatePageRequest{
		Title:  "Original Page",
		Slug:   "unique-slug",
		Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
	}

	_, err := service.CreatePage(ctx, createReq)
	require.NoError(t, err)

	// Try to create another page with the same slug
	duplicateReq := &contentv1.CreatePageRequest{
		Title:  "Duplicate Page",
		Slug:   "unique-slug",
		Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
	}

	_, err = service.CreatePage(ctx, duplicateReq)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestContentService_ContentSanitization(t *testing.T) {
	service, cleanup := setupContentServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a page with potentially dangerous content
	createReq := &contentv1.CreatePageRequest{
		Title: "Sanitization Test",
		Slug:  "sanitization-test",
		Content: &contentv1.PageContent{
			Blocks: []*contentv1.ContentBlock{
				{
					Type: "text",
					Data: map[string]string{
						"content": "<script>alert('xss')</script>Hello World",
					},
				},
			},
		},
		Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
	}

	page, err := service.CreatePage(ctx, createReq)
	require.NoError(t, err)

	// Verify content is sanitized
	assert.NotNil(t, page.Content)
	assert.Len(t, page.Content.Blocks, 1)
	
	block := page.Content.Blocks[0]
	content := block.Data["content"]
	
	// Should be HTML escaped
	assert.Contains(t, content, "&lt;script&gt;")
	assert.Contains(t, content, "&lt;/script&gt;")
	assert.NotContains(t, content, "<script>")
}
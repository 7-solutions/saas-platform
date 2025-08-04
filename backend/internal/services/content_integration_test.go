package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contentv1 "github.com/7-solutions/saas-platformbackend/gen/content/v1"
	"github.com/7-solutions/saas-platformbackend/internal/repository"
)

// TestContentServiceIntegration tests the content service with real database operations
func TestContentServiceIntegration(t *testing.T) {
	// Setup test database
	client := repository.SetupTestDB(t)
	defer repository.CleanupTestDB(t, client)

	// Create repositories
	pageRepo := repository.NewPageRepository(client)
	blogRepo := repository.NewBlogRepository(client)

	// Create service
	service := NewContentService(pageRepo, blogRepo)

	ctx := context.Background()

	// Test complete workflow: Create -> Get -> Update -> List -> Delete
	t.Run("complete_page_workflow", func(t *testing.T) {
		// 1. Create a page
		createReq := &contentv1.CreatePageRequest{
			Title: "Integration Test Page",
			Slug:  "integration-test-page",
			Content: &contentv1.PageContent{
				Blocks: []*contentv1.ContentBlock{
					{
						Type: "hero",
						Data: map[string]string{
							"title":    "Welcome to Integration Test",
							"subtitle": "This is a test page",
						},
					},
					{
						Type: "text",
						Data: map[string]string{
							"content": "This is the main content of the integration test page.",
						},
					},
				},
			},
			Meta: &contentv1.PageMeta{
				Title:       "Integration Test Page - SaaS Platform",
				Description: "A page created during integration testing",
				Keywords:    []string{"integration", "test", "page"},
			},
			Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
		}

		createdPage, err := service.CreatePage(ctx, createReq)
		require.NoError(t, err)
		assert.NotNil(t, createdPage)
		assert.Equal(t, "Integration Test Page", createdPage.Title)
		assert.Equal(t, "integration-test-page", createdPage.Slug)
		assert.Equal(t, contentv1.PageStatus_PAGE_STATUS_DRAFT, createdPage.Status)
		assert.NotEmpty(t, createdPage.Id)
		assert.NotNil(t, createdPage.CreatedAt)
		assert.NotNil(t, createdPage.UpdatedAt)

		// Verify content structure
		assert.NotNil(t, createdPage.Content)
		assert.Len(t, createdPage.Content.Blocks, 2)
		assert.Equal(t, "hero", createdPage.Content.Blocks[0].Type)
		assert.Equal(t, "Welcome to Integration Test", createdPage.Content.Blocks[0].Data["title"])

		// 2. Get the page
		getReq := &contentv1.GetPageRequest{Id: createdPage.Id}
		retrievedPage, err := service.GetPage(ctx, getReq)
		require.NoError(t, err)
		assert.Equal(t, createdPage.Id, retrievedPage.Id)
		assert.Equal(t, createdPage.Title, retrievedPage.Title)

		// 3. Update the page
		updateReq := &contentv1.UpdatePageRequest{
			Id:    createdPage.Id,
			Title: "Updated Integration Test Page",
			Slug:  "updated-integration-test-page",
			Content: &contentv1.PageContent{
				Blocks: []*contentv1.ContentBlock{
					{
						Type: "hero",
						Data: map[string]string{
							"title":    "Updated Welcome Message",
							"subtitle": "This page has been updated",
						},
					},
				},
			},
			Meta: &contentv1.PageMeta{
				Title:       "Updated Integration Test Page - SaaS Platform",
				Description: "An updated page from integration testing",
				Keywords:    []string{"updated", "integration", "test"},
			},
			Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
		}

		updatedPage, err := service.UpdatePage(ctx, updateReq)
		require.NoError(t, err)
		assert.Equal(t, "Updated Integration Test Page", updatedPage.Title)
		assert.Equal(t, "updated-integration-test-page", updatedPage.Slug)
		assert.Equal(t, contentv1.PageStatus_PAGE_STATUS_PUBLISHED, updatedPage.Status)

		// 4. List pages and verify our page is there
		listReq := &contentv1.ListPagesRequest{
			PageSize: 10,
		}
		listResp, err := service.ListPages(ctx, listReq)
		require.NoError(t, err)
		assert.NotNil(t, listResp)
		assert.GreaterOrEqual(t, len(listResp.Pages), 1)

		// Find our page in the list
		var foundPage *contentv1.Page
		for _, page := range listResp.Pages {
			if page.Id == updatedPage.Id {
				foundPage = page
				break
			}
		}
		assert.NotNil(t, foundPage, "Updated page should be found in the list")
		assert.Equal(t, "Updated Integration Test Page", foundPage.Title)

		// 5. List only published pages
		publishedListReq := &contentv1.ListPagesRequest{
			PageSize: 10,
			Status:   contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
		}
		publishedListResp, err := service.ListPages(ctx, publishedListReq)
		require.NoError(t, err)
		assert.NotNil(t, publishedListResp)

		// Verify all returned pages are published
		for _, page := range publishedListResp.Pages {
			assert.Equal(t, contentv1.PageStatus_PAGE_STATUS_PUBLISHED, page.Status)
		}

		// 6. Search for pages
		searchReq := &contentv1.ListPagesRequest{
			PageSize: 10,
			Search:   "Updated",
		}
		searchResp, err := service.ListPages(ctx, searchReq)
		require.NoError(t, err)
		assert.NotNil(t, searchResp)
		assert.GreaterOrEqual(t, len(searchResp.Pages), 1)

		// 7. Delete the page
		deleteReq := &contentv1.DeletePageRequest{Id: updatedPage.Id}
		_, err = service.DeletePage(ctx, deleteReq)
		require.NoError(t, err)

		// 8. Verify page is deleted
		_, err = service.GetPage(ctx, &contentv1.GetPageRequest{Id: updatedPage.Id})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "page not found")
	})

	// Test slug uniqueness
	t.Run("slug_uniqueness", func(t *testing.T) {
		// Create first page
		createReq1 := &contentv1.CreatePageRequest{
			Title:  "First Page",
			Slug:   "unique-slug",
			Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
		}
		page1, err := service.CreatePage(ctx, createReq1)
		require.NoError(t, err)

		// Try to create second page with same slug
		createReq2 := &contentv1.CreatePageRequest{
			Title:  "Second Page",
			Slug:   "unique-slug",
			Status: contentv1.PageStatus_PAGE_STATUS_DRAFT,
		}
		_, err = service.CreatePage(ctx, createReq2)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already exists")

		// Cleanup
		service.DeletePage(ctx, &contentv1.DeletePageRequest{Id: page1.Id})
	})

	// Test content sanitization
	t.Run("content_sanitization", func(t *testing.T) {
		createReq := &contentv1.CreatePageRequest{
			Title: "Sanitization Test",
			Slug:  "sanitization-test",
			Content: &contentv1.PageContent{
				Blocks: []*contentv1.ContentBlock{
					{
						Type: "text",
						Data: map[string]string{
							"content": "<script>alert('xss')</script>Safe content",
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
		content := page.Content.Blocks[0].Data["content"]
		assert.Contains(t, content, "&lt;script&gt;")
		assert.Contains(t, content, "&lt;/script&gt;")
		assert.NotContains(t, content, "<script>")
		assert.Contains(t, content, "Safe content")

		// Cleanup
		service.DeletePage(ctx, &contentv1.DeletePageRequest{Id: page.Id})
	})

	// Test pagination
	t.Run("pagination", func(t *testing.T) {
		// Create multiple pages
		var createdPages []*contentv1.Page
		for i := 0; i < 5; i++ {
			createReq := &contentv1.CreatePageRequest{
				Title:  fmt.Sprintf("Pagination Test Page %d", i+1),
				Slug:   fmt.Sprintf("pagination-test-page-%d", i+1),
				Status: contentv1.PageStatus_PAGE_STATUS_PUBLISHED,
			}
			page, err := service.CreatePage(ctx, createReq)
			require.NoError(t, err)
			createdPages = append(createdPages, page)
		}

		// Test pagination with page size 2
		listReq := &contentv1.ListPagesRequest{
			PageSize: 2,
		}
		listResp, err := service.ListPages(ctx, listReq)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(listResp.Pages), 2)

		// If we got a full page, there should be a next page token
		if len(listResp.Pages) == 2 {
			assert.NotEmpty(t, listResp.NextPageToken)

			// Test next page
			nextPageReq := &contentv1.ListPagesRequest{
				PageSize:  2,
				PageToken: listResp.NextPageToken,
			}
			nextPageResp, err := service.ListPages(ctx, nextPageReq)
			require.NoError(t, err)
			assert.NotNil(t, nextPageResp)
		}

		// Cleanup
		for _, page := range createdPages {
			service.DeletePage(ctx, &contentv1.DeletePageRequest{Id: page.Id})
		}
	})
}

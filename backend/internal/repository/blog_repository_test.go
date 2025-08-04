package repository

// Ensure views are indexed before queries in list tests

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

var _ = database.PostgresClient{} // compile-time import keeper; remove if unused later

func TestBlogRepository(t *testing.T) {
	ctx := context.Background()

	t.Run("Create and Get Blog Post", func(t *testing.T) {
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create a test blog post
		post := &models.BlogPost{
			ID:         "blog:test-post",
			Type:       "blog_post",
			Title:      "Test Blog Post",
			Slug:       "test-post",
			Excerpt:    "This is a test blog post excerpt",
			Content:    models.Content{Blocks: []models.ContentBlock{}},
			Meta:       models.Meta{Title: "Test Post", Description: "Test description"},
			Status:     models.PageStatusDraft,
			Author:     "test-author",
			Categories: []string{"Technology", "Testing"},
			Tags:       []string{"go", "testing", "blog"},
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		// Create the blog post
		err := repo.Create(ctx, post)
		require.NoError(t, err)

		// Get the blog post by ID
		retrievedPost, err := repo.GetByID(ctx, post.ID)
		require.NoError(t, err)
		assert.Equal(t, post.Title, retrievedPost.Title)
		assert.Equal(t, post.Slug, retrievedPost.Slug)
		assert.Equal(t, post.Author, retrievedPost.Author)
		assert.Equal(t, post.Categories, retrievedPost.Categories)
		assert.Equal(t, post.Tags, retrievedPost.Tags)
	})

	t.Run("Get Blog Post by Slug", func(t *testing.T) {
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create a test blog post
		post := &models.BlogPost{
			ID:        "blog:slug-test",
			Type:      "blog_post",
			Title:     "Slug Test Post",
			Slug:      "slug-test",
			Excerpt:   "Testing slug retrieval",
			Content:   models.Content{Blocks: []models.ContentBlock{}},
			Meta:      models.Meta{},
			Status:    models.PageStatusPublished,
			Author:    "test-author",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		err := repo.Create(ctx, post)
		require.NoError(t, err)

		// Get by slug
		retrievedPost, err := repo.GetBySlug(ctx, "slug-test")
		require.NoError(t, err)
		assert.Equal(t, post.Title, retrievedPost.Title)
		assert.Equal(t, post.Slug, retrievedPost.Slug)
	})

	t.Run("Update Blog Post", func(t *testing.T) {
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create a test blog post
		post := &models.BlogPost{
			ID:        "blog:update-test",
			Type:      "blog_post",
			Title:     "Original Title",
			Slug:      "update-test",
			Excerpt:   "Original excerpt",
			Content:   models.Content{Blocks: []models.ContentBlock{}},
			Meta:      models.Meta{},
			Status:    models.PageStatusDraft,
			Author:    "test-author",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		err := repo.Create(ctx, post)
		require.NoError(t, err)

		// Update the post
		post.Title = "Updated Title"
		post.Excerpt = "Updated excerpt"
		post.Status = models.PageStatusPublished
		post.SetPublished()

		err = repo.Update(ctx, post)
		require.NoError(t, err)

		// Verify the update
		retrievedPost, err := repo.GetByID(ctx, post.ID)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", retrievedPost.Title)
		assert.Equal(t, "Updated excerpt", retrievedPost.Excerpt)
		assert.Equal(t, models.PageStatusPublished, retrievedPost.Status)
		assert.NotNil(t, retrievedPost.PublishedAt)
	})

	t.Run("List Blog Posts by Status", func(t *testing.T) {
		// fresh DB per subtest
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create test blog posts with different statuses
		posts := []*models.BlogPost{
			{
				ID:        "blog:published-1",
				Type:      "blog_post",
				Title:     "Published Post 1",
				Slug:      "published-1",
				Status:    models.PageStatusPublished,
				Author:    "author-1",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        "blog:published-2",
				Type:      "blog_post",
				Title:     "Published Post 2",
				Slug:      "published-2",
				Status:    models.PageStatusPublished,
				Author:    "author-2",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        "blog:draft-1",
				Type:      "blog_post",
				Title:     "Draft Post 1",
				Slug:      "draft-1",
				Status:    models.PageStatusDraft,
				Author:    "author-1",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		}

		// Create all posts
		for _, post := range posts {
			err := repo.Create(ctx, post)
			require.NoError(t, err)
		}

		// No view indexing needed in Postgres

		// List published posts
		publishedPosts, err := repo.ListByStatus(ctx, models.PageStatusPublished, DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, publishedPosts, 2)

		// List draft posts
		draftPosts, err := repo.ListByStatus(ctx, models.PageStatusDraft, DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, draftPosts, 1)
	})

	t.Run("List Blog Posts by Category", func(t *testing.T) {
		// fresh DB per subtest
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create test blog posts with categories
		posts := []*models.BlogPost{
			{
				ID:         "blog:tech-1",
				Type:       "blog_post",
				Title:      "Tech Post 1",
				Slug:       "tech-1",
				Status:     models.PageStatusPublished,
				Author:     "tech-author",
				Categories: []string{"Technology", "Programming"},
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			},
			{
				ID:         "blog:tech-2",
				Type:       "blog_post",
				Title:      "Tech Post 2",
				Slug:       "tech-2",
				Status:     models.PageStatusPublished,
				Author:     "tech-author",
				Categories: []string{"Technology", "AI"},
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			},
			{
				ID:         "blog:business-1",
				Type:       "blog_post",
				Title:      "Business Post 1",
				Slug:       "business-1",
				Status:     models.PageStatusPublished,
				Author:     "business-author",
				Categories: []string{"Business", "Strategy"},
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			},
		}

		// Create all posts
		for _, post := range posts {
			err := repo.Create(ctx, post)
			require.NoError(t, err)
		}

		// No view indexing needed in Postgres

		// List posts by Technology category
		techPosts, err := repo.ListByCategory(ctx, "Technology", DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, techPosts, 2)

		// List posts by Business category
		businessPosts, err := repo.ListByCategory(ctx, "Business", DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, businessPosts, 1)
	})

	t.Run("List Blog Posts by Tag", func(t *testing.T) {
		// fresh DB per subtest
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create test blog posts with tags
		posts := []*models.BlogPost{
			{
				ID:        "blog:go-1",
				Type:      "blog_post",
				Title:     "Go Post 1",
				Slug:      "go-1",
				Status:    models.PageStatusPublished,
				Author:    "go-author",
				Tags:      []string{"go", "programming", "backend"},
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        "blog:go-2",
				Type:      "blog_post",
				Title:     "Go Post 2",
				Slug:      "go-2",
				Status:    models.PageStatusPublished,
				Author:    "go-author",
				Tags:      []string{"go", "microservices"},
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        "blog:js-1",
				Type:      "blog_post",
				Title:     "JavaScript Post 1",
				Slug:      "js-1",
				Status:    models.PageStatusPublished,
				Author:    "js-author",
				Tags:      []string{"javascript", "frontend", "react"},
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		}

		// Create all posts
		for _, post := range posts {
			err := repo.Create(ctx, post)
			require.NoError(t, err)
		}

		// No view indexing needed in Postgres

		// List posts by 'go' tag
		goPosts, err := repo.ListByTag(ctx, "go", DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, goPosts, 2)

		// List posts by 'javascript' tag
		jsPosts, err := repo.ListByTag(ctx, "javascript", DefaultListOptions())
		require.NoError(t, err)
		assert.Len(t, jsPosts, 1)
	})

	t.Run("Delete Blog Post", func(t *testing.T) {
		_ = SetupTestDB(t)
		client := SetupTestPGClient(t)
		repo := NewBlogRepositorySQL(client)

		// Create a test blog post
		post := &models.BlogPost{
			ID:        "blog:delete-test",
			Type:      "blog_post",
			Title:     "Delete Test Post",
			Slug:      "delete-test",
			Status:    models.PageStatusDraft,
			Author:    "test-author",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		err := repo.Create(ctx, post)
		require.NoError(t, err)

		// Verify it exists
		_, err = repo.GetByID(ctx, post.ID)
		require.NoError(t, err)

		// Delete the post
		err = repo.Delete(ctx, post.ID)
		require.NoError(t, err)

		// Verify it's deleted
		_, err = repo.GetByID(ctx, post.ID)
		assert.Error(t, err)
	})
}

func TestBlogPostModel(t *testing.T) {
	t.Run("NewBlogPost", func(t *testing.T) {
		post := models.NewBlogPost("Test Title", "test-slug", "test-author")
		
		assert.Equal(t, "blog:test-slug", post.ID)
		assert.Equal(t, "blog_post", post.Type)
		assert.Equal(t, "Test Title", post.Title)
		assert.Equal(t, "test-slug", post.Slug)
		assert.Equal(t, "test-author", post.Author)
		assert.Equal(t, models.PageStatusDraft, post.Status)
		assert.Empty(t, post.Categories)
		assert.Empty(t, post.Tags)
		assert.Nil(t, post.PublishedAt)
	})

	t.Run("IsPublished", func(t *testing.T) {
		post := models.NewBlogPost("Test", "test", "author")
		
		// Draft post should not be published
		assert.False(t, post.IsPublished())
		
		// Published post without published_at should not be published
		post.Status = models.PageStatusPublished
		assert.False(t, post.IsPublished())
		
		// Published post with future published_at should not be published
		futureTime := time.Now().Add(time.Hour)
		post.PublishedAt = &futureTime
		assert.False(t, post.IsPublished())
		
		// Published post with past published_at should be published
		pastTime := time.Now().Add(-time.Hour)
		post.PublishedAt = &pastTime
		assert.True(t, post.IsPublished())
	})

	t.Run("SetPublished", func(t *testing.T) {
		post := models.NewBlogPost("Test", "test", "author")
		
		post.SetPublished()
		
		assert.Equal(t, models.PageStatusPublished, post.Status)
		assert.NotNil(t, post.PublishedAt)
		assert.True(t, post.PublishedAt.Before(time.Now().Add(time.Second)))
	})

	t.Run("SetDraft", func(t *testing.T) {
		post := models.NewBlogPost("Test", "test", "author")
		post.SetPublished()
		
		// Verify it's published first
		assert.Equal(t, models.PageStatusPublished, post.Status)
		assert.NotNil(t, post.PublishedAt)
		
		post.SetDraft()
		
		assert.Equal(t, models.PageStatusDraft, post.Status)
		assert.Nil(t, post.PublishedAt)
	})
}
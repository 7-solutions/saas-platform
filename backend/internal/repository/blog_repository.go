package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/saas-startup-platform/backend/internal/database"
	"github.com/saas-startup-platform/backend/internal/models"
)

// blogRepository implements BlogRepository interface
type blogRepository struct {
	client *database.Client
}

// NewBlogRepository creates a new blog repository
func NewBlogRepository(client *database.Client) BlogRepository {
	return &blogRepository{
		client: client,
	}
}

// Create creates a new blog post
func (r *blogRepository) Create(ctx context.Context, post *models.BlogPost) error {
	if post.ID == "" {
		post.ID = "blog:" + post.Slug
	}
	post.Type = "blog_post"
	post.CreatedAt = time.Now()
	post.UpdatedAt = post.CreatedAt

	_, err := r.client.Put(ctx, post.ID, post)
	return err
}

// GetByID retrieves a blog post by ID
func (r *blogRepository) GetByID(ctx context.Context, id string) (*models.BlogPost, error) {
	var post models.BlogPost
	err := r.client.Get(ctx, id, &post)
	if err != nil {
		return nil, err
	}
	return &post, nil
}

// GetBySlug retrieves a blog post by slug
func (r *blogRepository) GetBySlug(ctx context.Context, slug string) (*models.BlogPost, error) {
	// Use the blog_posts/by_slug view
	result, err := r.client.Query(ctx, "blog_posts", "by_slug", map[string]interface{}{
		"key":          slug,
		"include_docs": true,
		"limit":        1,
	})
	if err != nil {
		return nil, err
	}

	if len(result.Rows) == 0 {
		return nil, fmt.Errorf("blog post not found")
	}

	var post models.BlogPost
	if err := json.Unmarshal(result.Rows[0].Doc, &post); err != nil {
		return nil, err
	}

	return &post, nil
}

// Update updates an existing blog post
func (r *blogRepository) Update(ctx context.Context, post *models.BlogPost) error {
	post.UpdatedAt = time.Now()
	_, err := r.client.Put(ctx, post.ID, post)
	return err
}

// Delete deletes a blog post
func (r *blogRepository) Delete(ctx context.Context, id string) error {
	// First get the document to get its revision
	var post models.BlogPost
	err := r.client.Get(ctx, id, &post)
	if err != nil {
		return err
	}
	
	return r.client.Delete(ctx, id, post.Rev)
}

// List retrieves all blog posts with pagination
func (r *blogRepository) List(ctx context.Context, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/all view
	result, err := r.client.Query(ctx, "blog_posts", "all", map[string]interface{}{
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// ListByStatus retrieves blog posts by status
func (r *blogRepository) ListByStatus(ctx context.Context, status string, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/by_status view
	result, err := r.client.Query(ctx, "blog_posts", "by_status", map[string]interface{}{
		"key":          status,
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// ListByAuthor retrieves blog posts by author
func (r *blogRepository) ListByAuthor(ctx context.Context, author string, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/by_author view
	result, err := r.client.Query(ctx, "blog_posts", "by_author", map[string]interface{}{
		"key":          author,
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// ListByCategory retrieves blog posts by category
func (r *blogRepository) ListByCategory(ctx context.Context, category string, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/by_category view
	result, err := r.client.Query(ctx, "blog_posts", "by_category", map[string]interface{}{
		"key":          category,
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// ListByTag retrieves blog posts by tag
func (r *blogRepository) ListByTag(ctx context.Context, tag string, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/by_tag view
	result, err := r.client.Query(ctx, "blog_posts", "by_tag", map[string]interface{}{
		"key":          tag,
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// Search searches blog posts by query
func (r *blogRepository) Search(ctx context.Context, query string, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/search view with full-text search
	searchQuery := strings.ToLower(query)
	
	result, err := r.client.Query(ctx, "blog_posts", "search", map[string]interface{}{
		"startkey":     searchQuery,
		"endkey":       searchQuery + "\ufff0",
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		posts = append(posts, &post)
	}

	return posts, nil
}

// GetCategories retrieves all blog categories with post counts
func (r *blogRepository) GetCategories(ctx context.Context) ([]*models.BlogCategory, error) {
	// Use the blog_posts/categories view with reduce
	result, err := r.client.Query(ctx, "blog_posts", "categories", map[string]interface{}{
		"group": true,
	})
	if err != nil {
		return nil, err
	}

	var categories []*models.BlogCategory
	for _, row := range result.Rows {
		if keyStr, ok := row.Key.(string); ok {
			if valueFloat, ok := row.Value.(float64); ok {
				categories = append(categories, &models.BlogCategory{
					Name:      keyStr,
					Slug:      strings.ToLower(strings.ReplaceAll(keyStr, " ", "-")),
					PostCount: int(valueFloat),
				})
			}
		}
	}

	return categories, nil
}

// GetTags retrieves all blog tags with post counts
func (r *blogRepository) GetTags(ctx context.Context) ([]*models.BlogTag, error) {
	// Use the blog_posts/tags view with reduce
	result, err := r.client.Query(ctx, "blog_posts", "tags", map[string]interface{}{
		"group": true,
	})
	if err != nil {
		return nil, err
	}

	var tags []*models.BlogTag
	for _, row := range result.Rows {
		if keyStr, ok := row.Key.(string); ok {
			if valueFloat, ok := row.Value.(float64); ok {
				tags = append(tags, &models.BlogTag{
					Name:      keyStr,
					Slug:      strings.ToLower(strings.ReplaceAll(keyStr, " ", "-")),
					PostCount: int(valueFloat),
				})
			}
		}
	}

	return tags, nil
}

// GetPublishedPosts retrieves only published blog posts
func (r *blogRepository) GetPublishedPosts(ctx context.Context, options ListOptions) ([]*models.BlogPost, error) {
	// Use the blog_posts/published view
	result, err := r.client.Query(ctx, "blog_posts", "published", map[string]interface{}{
		"include_docs": true,
		"limit":        options.Limit,
		"skip":         options.Skip,
		"descending":   options.Order == "desc",
	})
	if err != nil {
		return nil, err
	}

	var posts []*models.BlogPost
	for _, row := range result.Rows {
		var post models.BlogPost
		if err := json.Unmarshal(row.Doc, &post); err != nil {
			continue
		}
		
		// Double-check that the post is actually published
		if post.IsPublished() {
			posts = append(posts, &post)
		}
	}

	return posts, nil
}
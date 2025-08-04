package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/database"
	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/jackc/pgx/v5/pgtype"
)

// blogRepository implements BlogRepository interface (CouchDB - legacy)
type blogRepository struct {
	client *database.Client
}

// blogRepositorySQL implements BlogRepository interface (PostgreSQL/sqlc)
type blogRepositorySQL struct {
	q *db.Queries
}

// NewBlogRepository creates a new blog repository (CouchDB - legacy)
func NewBlogRepository(client *database.Client) BlogRepository {
	return &blogRepository{
		client: client,
	}
}

// NewBlogRepositorySQL creates a new SQL-backed blog repository using the Postgres client
func NewBlogRepositorySQL(c *database.PostgresClient) BlogRepository {
	return &blogRepositorySQL{
		q: database.NewQueriesFromClient(c),
	}
}

// Create creates a new blog post (CouchDB)
func (r *blogRepository) Create(ctx context.Context, post *models.BlogPost) error {
	if post.ID == "" {
		post.ID = "blog:" + post.Slug
	}
	post.Type = "blog_post"
	now := time.Now()
	post.CreatedAt = now
	post.UpdatedAt = now

	_, err := r.client.Put(ctx, post.ID, post)
	return err
}

// Create creates a new blog post (PostgreSQL)
func (r *blogRepositorySQL) Create(ctx context.Context, post *models.BlogPost) error {
	// Preserve outward semantics
	if post.ID == "" {
		post.ID = "blog:" + post.Slug
	}
	post.Type = "blog_post"
	now := time.Now()
	post.CreatedAt = now
	post.UpdatedAt = now

	// Content stored as JSONB; marshal
	contentJSON, err := json.Marshal(post.Content)
	if err != nil {
		return fmt.Errorf("failed to marshal content: %w", err)
	}

	row, err := r.q.InsertPost(ctx, db.InsertPostParams{
		Slug:    post.Slug,
		Title:   post.Title,
		Excerpt: nullableStringPtr(post.Excerpt),
		Content: string(contentJSON),
		Status:  post.Status,
		// AuthorID not represented in models; pass NULL
		AuthorID: pgtype.UUID{Valid: false},
		PublishedAt: func() pgtype.Timestamptz {
			if post.PublishedAt != nil {
				return pgtype.Timestamptz{Time: *post.PublishedAt, Valid: true}
			}
			return pgtype.Timestamptz{Valid: false}
		}(),
	})
	if err != nil {
		lo := strings.ToLower(err.Error())
		if strings.Contains(lo, "unique") && strings.Contains(lo, "slug") {
			return fmt.Errorf("failed to create blog post: slug already exists")
		}
		return fmt.Errorf("failed to create blog post: %w", err)
	}

	post.CreatedAt = row.CreatedAt.Time
	post.UpdatedAt = row.UpdatedAt.Time
	return nil
}

// Duplicate SQL Create removed (models.BlogPost does not have AuthorID field)

// GetByID retrieves a blog post by ID (CouchDB)
func (r *blogRepository) GetByID(ctx context.Context, id string) (*models.BlogPost, error) {
	var post models.BlogPost
	err := r.client.Get(ctx, id, &post)
	if err != nil {
		return nil, err
	}
	return &post, nil
}

// GetByID retrieves a blog post by legacy ID "blog:{slug}" (SQL)
func (r *blogRepositorySQL) GetByID(ctx context.Context, id string) (*models.BlogPost, error) {
	slug := strings.TrimPrefix(id, "blog:")
	return r.GetBySlug(ctx, slug)
}

// GetBySlug retrieves a blog post by slug (CouchDB)
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

// GetBySlug retrieves a blog post by slug (PostgreSQL)
func (r *blogRepositorySQL) GetBySlug(ctx context.Context, slug string) (*models.BlogPost, error) {
	row, err := r.q.GetPostBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("failed to get post by slug: %w", err)
	}

	var content models.Content
	_ = json.Unmarshal([]byte(row.Content), &content)

	post := &models.BlogPost{
		ID:          "blog:" + row.Slug,
		Type:        "blog_post",
		Title:       row.Title,
		Slug:        row.Slug,
		Excerpt:     derefString(row.Excerpt),
		Content:     content,
		Status:      string(row.Status),
		PublishedAt: nullableTimePtr(row.PublishedAt),
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
	return post, nil
}

// Update updates an existing blog post (CouchDB)
func (r *blogRepository) Update(ctx context.Context, post *models.BlogPost) error {
	post.UpdatedAt = time.Now()
	_, err := r.client.Upsert(ctx, post.ID, post)
	return err
}

// Update updates an existing blog post (PostgreSQL)
func (r *blogRepositorySQL) Update(ctx context.Context, post *models.BlogPost) error {
	// Resolve UUID via slug
	row, err := r.q.GetPostBySlug(ctx, post.Slug)
	if err != nil {
		return fmt.Errorf("failed to resolve post by slug for update: %w", err)
	}

	var slugPtr *string
	if post.Slug != "" {
		slugPtr = &post.Slug
	}
	var titlePtr *string
	if post.Title != "" {
		titlePtr = &post.Title
	}
	var excerptPtr *string
	if post.Excerpt != "" {
		excerptPtr = &post.Excerpt
	}
	var contentPtr *string
	if post.Content.Blocks != nil {
		if b, mErr := json.Marshal(post.Content); mErr == nil {
			s := string(b)
			contentPtr = &s
		}
	}
	var statusPtr *string
	if post.Status != "" {
		statusPtr = &post.Status
	}
	// Only published_at can be set from model; author is not represented in models.BlogPost
	var publishedAtPtr *time.Time = post.PublishedAt

	updated, err := r.q.UpdatePost(ctx, db.UpdatePostParams{
		ID: row.ID,
		Slug: func() string {
			if slugPtr != nil {
				return *slugPtr
			}
			return row.Slug
		}(),
		Title: func() string {
			if titlePtr != nil {
				return *titlePtr
			}
			return row.Title
		}(),
		Excerpt: excerptPtr,
		Content: func() string {
			if contentPtr != nil {
				return *contentPtr
			}
			return row.Content
		}(),
		Status: func() string {
			if statusPtr != nil {
				return *statusPtr
			}
			return row.Status
		}(),
		AuthorID: row.AuthorID, // unchanged (models has no author), keep existing
		PublishedAt: func() pgtype.Timestamptz {
			if publishedAtPtr != nil {
				return pgtype.Timestamptz{Time: *publishedAtPtr, Valid: true}
			}
			return pgtype.Timestamptz{Valid: false}
		}(),
	})
	if err != nil {
		return fmt.Errorf("failed to update blog post: %w", err)
	}
	post.UpdatedAt = updated.UpdatedAt.Time
	post.CreatedAt = updated.CreatedAt.Time
	return nil
}

// Delete deletes a blog post (CouchDB)
func (r *blogRepository) Delete(ctx context.Context, id string) error {
	// First get the document to get its revision
	var post models.BlogPost
	err := r.client.Get(ctx, id, &post)
	if err != nil {
		return err
	}
	return r.client.Delete(ctx, id, post.Rev)
}

// Delete deletes a blog post (PostgreSQL)
// Accepts "blog:{slug}" or raw slug
func (r *blogRepositorySQL) Delete(ctx context.Context, id string) error {
	slug := strings.TrimPrefix(id, "blog:")
	row, err := r.q.GetPostBySlug(ctx, slug)
	if err != nil {
		return fmt.Errorf("failed to resolve post by slug for delete: %w", err)
	}
	if err := r.q.DeletePostByID(ctx, row.ID); err != nil {
		return fmt.Errorf("failed to delete blog post: %w", err)
	}
	return nil
}

// List retrieves all blog posts with pagination (CouchDB)
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

// List retrieves all blog posts with pagination (PostgreSQL)
func (r *blogRepositorySQL) List(ctx context.Context, options ListOptions) ([]*models.BlogPost, error) {
	rows, err := r.q.ListPostsAll(ctx, db.ListPostsAllParams{
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list blog posts: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// ListByStatus retrieves blog posts by status (CouchDB)
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

// ListByStatus retrieves blog posts by status (PostgreSQL)
func (r *blogRepositorySQL) ListByStatus(ctx context.Context, status string, options ListOptions) ([]*models.BlogPost, error) {
	rows, err := r.q.ListPostsByStatus(ctx, db.ListPostsByStatusParams{
		Status: string(status),
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list posts by status: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// ListByAuthor retrieves blog posts by author (CouchDB)
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

// ListByAuthor retrieves blog posts by author (PostgreSQL)
func (r *blogRepositorySQL) ListByAuthor(ctx context.Context, authorID string, options ListOptions) ([]*models.BlogPost, error) {
	var uid pgtype.UUID
	uid.Valid = false
	if authorID != "" {
		if err := uid.Scan(authorID); err != nil {
			return nil, fmt.Errorf("invalid author id: %w", err)
		}
		uid.Valid = true
	}
	rows, err := r.q.ListPostsByAuthor(ctx, db.ListPostsByAuthorParams{
		AuthorID: uid,
		Limit:    int32(options.Limit),
		Offset:   int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list posts by author: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// ListByCategory retrieves blog posts by category (CouchDB)
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

// ListByCategory retrieves blog posts by category slug (PostgreSQL)
func (r *blogRepositorySQL) ListByCategory(ctx context.Context, categorySlug string, options ListOptions) ([]*models.BlogPost, error) {
	rows, err := r.q.ListPostsByCategorySlug(ctx, db.ListPostsByCategorySlugParams{
		Slug:   categorySlug,
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list posts by category: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// ListByTag retrieves blog posts by tag (CouchDB)
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

// ListByTag retrieves blog posts by tag slug (PostgreSQL)
func (r *blogRepositorySQL) ListByTag(ctx context.Context, tagSlug string, options ListOptions) ([]*models.BlogPost, error) {
	rows, err := r.q.ListPostsByTagSlug(ctx, db.ListPostsByTagSlugParams{
		Slug:   tagSlug,
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list posts by tag: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// Search searches blog posts by query (CouchDB)
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

// Search searches blog posts by query (PostgreSQL via tsquery)
func (r *blogRepositorySQL) Search(ctx context.Context, query string, options ListOptions) ([]*models.BlogPost, error) {
	tsq := makePrefixTsQuery(query)
	if tsq == "" {
		return []*models.BlogPost{}, nil
	}
	rows, err := r.q.SearchPosts(ctx, db.SearchPostsParams{
		ToTsquery: tsq,
		Limit:     int32(options.Limit),
		Offset:    int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search posts: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

// GetCategories retrieves all blog categories with post counts (CouchDB)
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

// GetCategories retrieves all blog categories with post counts (PostgreSQL)
func (r *blogRepositorySQL) GetCategories(ctx context.Context) ([]*models.BlogCategory, error) {
	rows, err := r.q.GetCategoryCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get category counts: %w", err)
	}
	cats := make([]*models.BlogCategory, 0, len(rows))
	for _, row := range rows {
		cats = append(cats, &models.BlogCategory{
			Slug:      row.Slug,
			Name:      row.Name,
			PostCount: int(row.Count),
		})
	}
	return cats, nil
}

// GetTags retrieves all blog tags with post counts (CouchDB)
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

// GetTags retrieves all blog tags with post counts (PostgreSQL)
func (r *blogRepositorySQL) GetTags(ctx context.Context) ([]*models.BlogTag, error) {
	rows, err := r.q.GetTagCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tag counts: %w", err)
	}
	tags := make([]*models.BlogTag, 0, len(rows))
	for _, row := range rows {
		tags = append(tags, &models.BlogTag{
			Slug:      row.Slug,
			Name:      row.Name,
			PostCount: int(row.Count),
		})
	}
	return tags, nil
}

// GetPublishedPosts retrieves only published blog posts (CouchDB)
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

// Helpers to map between sqlc pgtype and model types

// nullableStringPtr converts a plain string to *string, treating empty as nil
func nullableStringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// derefString converts *string to string with empty default
func derefString(ps *string) string {
	if ps == nil {
		return ""
	}
	return *ps
}

// nullableTimePtr converts pgtype.Timestamptz to *time.Time (nil when invalid)
func nullableTimePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}

// GetPublishedPosts retrieves only published blog posts (PostgreSQL)
func (r *blogRepositorySQL) GetPublishedPosts(ctx context.Context, options ListOptions) ([]*models.BlogPost, error) {
	rows, err := r.q.ListPublishedPosts(ctx, db.ListPublishedPostsParams{
		Limit:  int32(options.Limit),
		Offset: int32(options.Skip),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list published posts: %w", err)
	}
	posts := make([]*models.BlogPost, 0, len(rows))
	for _, row := range rows {
		var content models.Content
		_ = json.Unmarshal([]byte(row.Content), &content)
		posts = append(posts, &models.BlogPost{
			ID:          "blog:" + row.Slug,
			Type:        "blog_post",
			Title:       row.Title,
			Slug:        row.Slug,
			Excerpt:     derefString(row.Excerpt),
			Content:     content,
			Status:      string(row.Status),
			PublishedAt: nullableTimePtr(row.PublishedAt),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return posts, nil
}

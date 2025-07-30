package services

import (
	"context"
	"fmt"
	"html"
	"regexp"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	contentv1 "github.com/saas-startup-platform/backend/gen/content/v1"
	"github.com/saas-startup-platform/backend/internal/models"
	"github.com/saas-startup-platform/backend/internal/repository"
)

// ContentService implements the content service
type ContentService struct {
	contentv1.UnimplementedContentServiceServer
	pageRepo repository.PageRepository
	blogRepo repository.BlogRepository
}

// NewContentService creates a new content service
func NewContentService(pageRepo repository.PageRepository, blogRepo repository.BlogRepository) *ContentService {
	return &ContentService{
		pageRepo: pageRepo,
		blogRepo: blogRepo,
	}
}

// CreatePage creates a new page
func (s *ContentService) CreatePage(ctx context.Context, req *contentv1.CreatePageRequest) (*contentv1.Page, error) {
	// Validate input
	if err := s.validateCreatePageRequest(req); err != nil {
		return nil, err
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = s.generateSlug(req.Title)
	} else {
		slug = s.sanitizeSlug(slug)
	}

	// Check slug uniqueness
	if err := s.validateSlugUniqueness(ctx, slug, ""); err != nil {
		return nil, err
	}

	// Sanitize content
	sanitizedContent := s.sanitizeContent(req.Content)

	// Create page model
	page := &models.Page{
		ID:      "page:" + slug,
		Type:    "page",
		Title:   strings.TrimSpace(req.Title),
		Slug:    slug,
		Content: s.convertProtoContentToModel(sanitizedContent),
		Meta:    s.convertProtoMetaToModel(req.Meta),
		Status:  s.convertProtoStatusToModel(req.Status),
	}

	// Save to repository
	if err := s.pageRepo.Create(ctx, page); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create page: %v", err)
	}

	// Convert back to proto and return
	return s.convertModelToProto(page), nil
}

// GetPage retrieves a page by ID
func (s *ContentService) GetPage(ctx context.Context, req *contentv1.GetPageRequest) (*contentv1.Page, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "page ID is required")
	}

	// Get page from repository
	page, err := s.pageRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "page not found: %v", err)
	}

	return s.convertModelToProto(page), nil
}

// UpdatePage updates an existing page
func (s *ContentService) UpdatePage(ctx context.Context, req *contentv1.UpdatePageRequest) (*contentv1.Page, error) {
	// Validate input
	if err := s.validateUpdatePageRequest(req); err != nil {
		return nil, err
	}

	// Get existing page
	existingPage, err := s.pageRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "page not found: %v", err)
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = s.generateSlug(req.Title)
	} else {
		slug = s.sanitizeSlug(slug)
	}

	// Check slug uniqueness (exclude current page)
	if slug != existingPage.Slug {
		if err := s.validateSlugUniqueness(ctx, slug, req.Id); err != nil {
			return nil, err
		}
	}

	// Sanitize content
	sanitizedContent := s.sanitizeContent(req.Content)

	// Update page model
	existingPage.Title = strings.TrimSpace(req.Title)
	existingPage.Slug = slug
	existingPage.Content = s.convertProtoContentToModel(sanitizedContent)
	existingPage.Meta = s.convertProtoMetaToModel(req.Meta)
	existingPage.Status = s.convertProtoStatusToModel(req.Status)

	// Save to repository
	if err := s.pageRepo.Update(ctx, existingPage); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update page: %v", err)
	}

	// Convert back to proto and return
	return s.convertModelToProto(existingPage), nil
}

// DeletePage deletes a page
func (s *ContentService) DeletePage(ctx context.Context, req *contentv1.DeletePageRequest) (*emptypb.Empty, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "page ID is required")
	}

	// Check if page exists
	_, err := s.pageRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "page not found: %v", err)
	}

	// Delete from repository
	if err := s.pageRepo.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete page: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// ListPages lists pages with filtering and pagination
func (s *ContentService) ListPages(ctx context.Context, req *contentv1.ListPagesRequest) (*contentv1.ListPagesResponse, error) {
	// Set default page size if not provided
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 100 {
		pageSize = 100 // Maximum page size
	}

	// Parse page token to get skip offset
	skip := 0
	if req.PageToken != "" {
		if parsedSkip, err := strconv.Atoi(req.PageToken); err == nil {
			skip = parsedSkip
		}
	}

	// Set up list options
	options := repository.ListOptions{
		Limit: int(pageSize),
		Skip:  skip,
	}

	var pages []*models.Page
	var err error

	// Filter by status if specified
	if req.Status != contentv1.PageStatus_PAGE_STATUS_UNSPECIFIED {
		statusStr := s.convertProtoStatusToModel(req.Status)
		pages, err = s.pageRepo.ListByStatus(ctx, statusStr, options)
	} else {
		pages, err = s.pageRepo.List(ctx, options)
	}

	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list pages: %v", err)
	}

	// Filter by search term if provided
	if req.Search != "" {
		pages = s.filterPagesBySearch(pages, req.Search)
	}

	// Convert to proto
	protoPages := make([]*contentv1.Page, len(pages))
	for i, page := range pages {
		protoPages[i] = s.convertModelToProto(page)
	}

	// Calculate next page token
	nextPageToken := ""
	if len(pages) == int(pageSize) {
		nextPageToken = strconv.Itoa(skip + int(pageSize))
	}

	return &contentv1.ListPagesResponse{
		Pages:         protoPages,
		NextPageToken: nextPageToken,
		TotalCount:    int32(len(protoPages)), // This is approximate for this page
	}, nil
}

// Validation methods

func (s *ContentService) validateCreatePageRequest(req *contentv1.CreatePageRequest) error {
	if req.Title == "" {
		return status.Errorf(codes.InvalidArgument, "title is required")
	}
	if len(req.Title) > 200 {
		return status.Errorf(codes.InvalidArgument, "title must be less than 200 characters")
	}
	if req.Slug != "" && len(req.Slug) > 100 {
		return status.Errorf(codes.InvalidArgument, "slug must be less than 100 characters")
	}
	return nil
}

func (s *ContentService) validateUpdatePageRequest(req *contentv1.UpdatePageRequest) error {
	if req.Id == "" {
		return status.Errorf(codes.InvalidArgument, "page ID is required")
	}
	if req.Title == "" {
		return status.Errorf(codes.InvalidArgument, "title is required")
	}
	if len(req.Title) > 200 {
		return status.Errorf(codes.InvalidArgument, "title must be less than 200 characters")
	}
	if req.Slug != "" && len(req.Slug) > 100 {
		return status.Errorf(codes.InvalidArgument, "slug must be less than 100 characters")
	}
	return nil
}

func (s *ContentService) validateSlugUniqueness(ctx context.Context, slug, excludeID string) error {
	existingPage, err := s.pageRepo.GetBySlug(ctx, slug)
	if err == nil && existingPage.ID != excludeID {
		return status.Errorf(codes.AlreadyExists, "page with slug '%s' already exists", slug)
	}
	return nil
}

// Slug generation and sanitization

func (s *ContentService) generateSlug(title string) string {
	// Convert to lowercase
	slug := strings.ToLower(title)
	
	// Replace spaces and special characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	
	// Remove leading and trailing hyphens
	slug = strings.Trim(slug, "-")
	
	// Limit length
	if len(slug) > 100 {
		slug = slug[:100]
		slug = strings.Trim(slug, "-")
	}
	
	// Ensure slug is not empty
	if slug == "" {
		slug = "page"
	}
	
	return slug
}

func (s *ContentService) sanitizeSlug(slug string) string {
	// Convert to lowercase
	slug = strings.ToLower(slug)
	
	// Replace invalid characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9-]`)
	slug = reg.ReplaceAllString(slug, "-")
	
	// Remove multiple consecutive hyphens
	reg = regexp.MustCompile(`-+`)
	slug = reg.ReplaceAllString(slug, "-")
	
	// Remove leading and trailing hyphens
	slug = strings.Trim(slug, "-")
	
	// Ensure slug is not empty
	if slug == "" {
		slug = "page"
	}
	
	return slug
}

// Content sanitization

func (s *ContentService) sanitizeContent(content *contentv1.PageContent) *contentv1.PageContent {
	if content == nil {
		return &contentv1.PageContent{Blocks: []*contentv1.ContentBlock{}}
	}

	sanitizedBlocks := make([]*contentv1.ContentBlock, len(content.Blocks))
	for i, block := range content.Blocks {
		sanitizedBlocks[i] = s.sanitizeContentBlock(block)
	}

	return &contentv1.PageContent{Blocks: sanitizedBlocks}
}

func (s *ContentService) sanitizeContentBlock(block *contentv1.ContentBlock) *contentv1.ContentBlock {
	if block == nil {
		return &contentv1.ContentBlock{Type: "text", Data: map[string]string{}}
	}

	sanitizedData := make(map[string]string)
	for key, value := range block.Data {
		// HTML escape the values to prevent XSS
		sanitizedData[key] = html.EscapeString(value)
	}

	return &contentv1.ContentBlock{
		Type: block.Type,
		Data: sanitizedData,
	}
}

// Search filtering

func (s *ContentService) filterPagesBySearch(pages []*models.Page, search string) []*models.Page {
	if search == "" {
		return pages
	}

	searchLower := strings.ToLower(search)
	var filtered []*models.Page

	for _, page := range pages {
		if s.pageMatchesSearch(page, searchLower) {
			filtered = append(filtered, page)
		}
	}

	return filtered
}

func (s *ContentService) pageMatchesSearch(page *models.Page, search string) bool {
	// Search in title
	if strings.Contains(strings.ToLower(page.Title), search) {
		return true
	}

	// Search in slug
	if strings.Contains(strings.ToLower(page.Slug), search) {
		return true
	}

	// Search in meta title and description
	if strings.Contains(strings.ToLower(page.Meta.Title), search) {
		return true
	}
	if strings.Contains(strings.ToLower(page.Meta.Description), search) {
		return true
	}

	// Search in content blocks
	for _, block := range page.Content.Blocks {
		for _, value := range block.Data {
			if valueStr, ok := value.(string); ok {
				if strings.Contains(strings.ToLower(valueStr), search) {
					return true
				}
			}
		}
	}

	return false
}

// Conversion methods

func (s *ContentService) convertModelToProto(page *models.Page) *contentv1.Page {
	return &contentv1.Page{
		Id:        page.ID,
		Title:     page.Title,
		Slug:      page.Slug,
		Content:   s.convertModelContentToProto(page.Content),
		Meta:      s.convertModelMetaToProto(page.Meta),
		Status:    s.convertModelStatusToProto(page.Status),
		CreatedAt: timestamppb.New(page.CreatedAt),
		UpdatedAt: timestamppb.New(page.UpdatedAt),
	}
}

func (s *ContentService) convertModelContentToProto(content models.Content) *contentv1.PageContent {
	blocks := make([]*contentv1.ContentBlock, len(content.Blocks))
	for i, block := range content.Blocks {
		data := make(map[string]string)
		for key, value := range block.Data {
			if valueStr, ok := value.(string); ok {
				data[key] = valueStr
			} else {
				data[key] = fmt.Sprintf("%v", value)
			}
		}
		blocks[i] = &contentv1.ContentBlock{
			Type: block.Type,
			Data: data,
		}
	}
	return &contentv1.PageContent{Blocks: blocks}
}

func (s *ContentService) convertModelMetaToProto(meta models.Meta) *contentv1.PageMeta {
	keywords := []string{}
	if meta.Keywords != "" {
		keywords = strings.Split(meta.Keywords, ",")
		for i, keyword := range keywords {
			keywords[i] = strings.TrimSpace(keyword)
		}
	}

	return &contentv1.PageMeta{
		Title:       meta.Title,
		Description: meta.Description,
		Keywords:    keywords,
	}
}

func (s *ContentService) convertModelStatusToProto(status string) contentv1.PageStatus {
	switch status {
	case models.PageStatusDraft:
		return contentv1.PageStatus_PAGE_STATUS_DRAFT
	case models.PageStatusPublished:
		return contentv1.PageStatus_PAGE_STATUS_PUBLISHED
	case models.PageStatusArchived:
		return contentv1.PageStatus_PAGE_STATUS_ARCHIVED
	default:
		return contentv1.PageStatus_PAGE_STATUS_DRAFT
	}
}

func (s *ContentService) convertProtoContentToModel(content *contentv1.PageContent) models.Content {
	if content == nil {
		return models.Content{Blocks: []models.ContentBlock{}}
	}

	blocks := make([]models.ContentBlock, len(content.Blocks))
	for i, block := range content.Blocks {
		data := make(map[string]interface{})
		for key, value := range block.Data {
			data[key] = value
		}
		blocks[i] = models.ContentBlock{
			Type: block.Type,
			Data: data,
		}
	}

	return models.Content{Blocks: blocks}
}

func (s *ContentService) convertProtoMetaToModel(meta *contentv1.PageMeta) models.Meta {
	if meta == nil {
		return models.Meta{}
	}

	keywords := ""
	if len(meta.Keywords) > 0 {
		keywords = strings.Join(meta.Keywords, ", ")
	}

	return models.Meta{
		Title:       meta.Title,
		Description: meta.Description,
		Keywords:    keywords,
	}
}

func (s *ContentService) convertProtoStatusToModel(status contentv1.PageStatus) string {
	switch status {
	case contentv1.PageStatus_PAGE_STATUS_DRAFT:
		return models.PageStatusDraft
	case contentv1.PageStatus_PAGE_STATUS_PUBLISHED:
		return models.PageStatusPublished
	case contentv1.PageStatus_PAGE_STATUS_ARCHIVED:
		return models.PageStatusArchived
	default:
		return models.PageStatusDraft
	}
}

// Blog post service methods
// Note: These methods are placeholders until protobuf types are generated

/*
// CreateBlogPost creates a new blog post
func (s *ContentService) CreateBlogPost(ctx context.Context, req *contentv1.CreateBlogPostRequest) (*contentv1.BlogPost, error) {
	// Validate input
	if err := s.validateCreateBlogPostRequest(req); err != nil {
		return nil, err
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = s.generateSlug(req.Title)
	} else {
		slug = s.sanitizeSlug(slug)
	}

	// Check slug uniqueness
	if err := s.validateBlogSlugUniqueness(ctx, slug, ""); err != nil {
		return nil, err
	}

	// Sanitize content
	sanitizedContent := s.sanitizeContent(req.Content)

	// Create blog post model
	post := &models.BlogPost{
		ID:         "blog:" + slug,
		Type:       "blog_post",
		Title:      strings.TrimSpace(req.Title),
		Slug:       slug,
		Excerpt:    strings.TrimSpace(req.Excerpt),
		Content:    s.convertProtoContentToModel(sanitizedContent),
		Meta:       s.convertProtoMetaToModel(req.Meta),
		Status:     s.convertProtoStatusToModel(req.Status),
		Author:     req.Author,
		Categories: req.Categories,
		Tags:       req.Tags,
		FeaturedImage: req.FeaturedImage,
	}

	// Set published date if status is published
	if req.Status == contentv1.PageStatus_PAGE_STATUS_PUBLISHED {
		if req.PublishedAt != nil {
			publishedAt := req.PublishedAt.AsTime()
			post.PublishedAt = &publishedAt
		} else {
			post.SetPublished()
		}
	}

	// Save to repository
	if err := s.blogRepo.Create(ctx, post); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create blog post: %v", err)
	}

	// Convert back to proto and return
	return s.convertBlogModelToProto(post), nil
}

// GetBlogPost retrieves a blog post by ID
func (s *ContentService) GetBlogPost(ctx context.Context, req *contentv1.GetBlogPostRequest) (*contentv1.BlogPost, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "blog post ID is required")
	}

	// Get blog post from repository
	post, err := s.blogRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "blog post not found: %v", err)
	}

	return s.convertBlogModelToProto(post), nil
}

// UpdateBlogPost updates an existing blog post
func (s *ContentService) UpdateBlogPost(ctx context.Context, req *contentv1.UpdateBlogPostRequest) (*contentv1.BlogPost, error) {
	// Validate input
	if err := s.validateUpdateBlogPostRequest(req); err != nil {
		return nil, err
	}

	// Get existing blog post
	existingPost, err := s.blogRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "blog post not found: %v", err)
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = s.generateSlug(req.Title)
	} else {
		slug = s.sanitizeSlug(slug)
	}

	// Check slug uniqueness (exclude current post)
	if slug != existingPost.Slug {
		if err := s.validateBlogSlugUniqueness(ctx, slug, req.Id); err != nil {
			return nil, err
		}
	}

	// Sanitize content
	sanitizedContent := s.sanitizeContent(req.Content)

	// Update blog post model
	existingPost.Title = strings.TrimSpace(req.Title)
	existingPost.Slug = slug
	existingPost.Excerpt = strings.TrimSpace(req.Excerpt)
	existingPost.Content = s.convertProtoContentToModel(sanitizedContent)
	existingPost.Meta = s.convertProtoMetaToModel(req.Meta)
	existingPost.Status = s.convertProtoStatusToModel(req.Status)
	existingPost.Author = req.Author
	existingPost.Categories = req.Categories
	existingPost.Tags = req.Tags
	existingPost.FeaturedImage = req.FeaturedImage

	// Handle published date
	if req.Status == contentv1.PageStatus_PAGE_STATUS_PUBLISHED {
		if req.PublishedAt != nil {
			publishedAt := req.PublishedAt.AsTime()
			existingPost.PublishedAt = &publishedAt
		} else if existingPost.PublishedAt == nil {
			existingPost.SetPublished()
		}
	} else if req.Status == contentv1.PageStatus_PAGE_STATUS_DRAFT {
		existingPost.SetDraft()
	}

	// Save to repository
	if err := s.blogRepo.Update(ctx, existingPost); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update blog post: %v", err)
	}

	// Convert back to proto and return
	return s.convertBlogModelToProto(existingPost), nil
}

// DeleteBlogPost deletes a blog post
func (s *ContentService) DeleteBlogPost(ctx context.Context, req *contentv1.DeleteBlogPostRequest) (*emptypb.Empty, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "blog post ID is required")
	}

	// Check if blog post exists
	_, err := s.blogRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "blog post not found: %v", err)
	}

	// Delete from repository
	if err := s.blogRepo.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete blog post: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// ListBlogPosts lists blog posts with filtering and pagination
func (s *ContentService) ListBlogPosts(ctx context.Context, req *contentv1.ListBlogPostsRequest) (*contentv1.ListBlogPostsResponse, error) {
	// Set default page size
	pageSize := req.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	// Parse page token for skip value
	skip := 0
	if req.PageToken != "" {
		if parsedSkip, err := strconv.Atoi(req.PageToken); err == nil {
			skip = parsedSkip
		}
	}

	options := repository.ListOptions{
		Limit: int(pageSize),
		Skip:  skip,
		Order: "desc",
	}

	var posts []*models.BlogPost
	var err error

	// Filter by different criteria
	if req.Status != contentv1.PageStatus_PAGE_STATUS_UNSPECIFIED {
		statusStr := s.convertProtoStatusToModel(req.Status)
		posts, err = s.blogRepo.ListByStatus(ctx, statusStr, options)
	} else if req.Category != "" {
		posts, err = s.blogRepo.ListByCategory(ctx, req.Category, options)
	} else if req.Tag != "" {
		posts, err = s.blogRepo.ListByTag(ctx, req.Tag, options)
	} else if req.Author != "" {
		posts, err = s.blogRepo.ListByAuthor(ctx, req.Author, options)
	} else {
		posts, err = s.blogRepo.List(ctx, options)
	}

	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list blog posts: %v", err)
	}

	// Convert to proto
	protoPosts := make([]*contentv1.BlogPost, len(posts))
	for i, post := range posts {
		protoPosts[i] = s.convertBlogModelToProto(post)
	}

	// Generate next page token
	nextPageToken := ""
	if len(posts) == int(pageSize) {
		nextPageToken = strconv.Itoa(skip + int(pageSize))
	}

	return &contentv1.ListBlogPostsResponse{
		Posts:         protoPosts,
		NextPageToken: nextPageToken,
		TotalCount:    int32(len(posts)), // This is approximate
	}, nil
}

// SearchBlogPosts searches blog posts
func (s *ContentService) SearchBlogPosts(ctx context.Context, req *contentv1.SearchBlogPostsRequest) (*contentv1.SearchBlogPostsResponse, error) {
	if req.Query == "" {
		return nil, status.Errorf(codes.InvalidArgument, "search query is required")
	}

	// Set default page size
	pageSize := req.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	// Parse page token for skip value
	skip := 0
	if req.PageToken != "" {
		if parsedSkip, err := strconv.Atoi(req.PageToken); err == nil {
			skip = parsedSkip
		}
	}

	options := repository.ListOptions{
		Limit: int(pageSize),
		Skip:  skip,
		Order: "desc",
	}

	// Search blog posts
	posts, err := s.blogRepo.Search(ctx, req.Query, options)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search blog posts: %v", err)
	}

	// Additional filtering by category or tag if specified
	if req.Category != "" || req.Tag != "" {
		filteredPosts := []*models.BlogPost{}
		for _, post := range posts {
			match := true
			if req.Category != "" {
				categoryMatch := false
				for _, cat := range post.Categories {
					if cat == req.Category {
						categoryMatch = true
						break
					}
				}
				if !categoryMatch {
					match = false
				}
			}
			if req.Tag != "" && match {
				tagMatch := false
				for _, tag := range post.Tags {
					if tag == req.Tag {
						tagMatch = true
						break
					}
				}
				if !tagMatch {
					match = false
				}
			}
			if match {
				filteredPosts = append(filteredPosts, post)
			}
		}
		posts = filteredPosts
	}

	// Convert to proto
	protoPosts := make([]*contentv1.BlogPost, len(posts))
	for i, post := range posts {
		protoPosts[i] = s.convertBlogModelToProto(post)
	}

	// Generate next page token
	nextPageToken := ""
	if len(posts) == int(pageSize) {
		nextPageToken = strconv.Itoa(skip + int(pageSize))
	}

	return &contentv1.SearchBlogPostsResponse{
		Posts:         protoPosts,
		NextPageToken: nextPageToken,
		TotalCount:    int32(len(posts)),
	}, nil
}

// GetBlogCategories retrieves all blog categories
func (s *ContentService) GetBlogCategories(ctx context.Context, req *contentv1.GetBlogCategoriesRequest) (*contentv1.GetBlogCategoriesResponse, error) {
	categories, err := s.blogRepo.GetCategories(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get blog categories: %v", err)
	}

	protoCategories := make([]*contentv1.BlogCategory, len(categories))
	for i, cat := range categories {
		protoCategories[i] = &contentv1.BlogCategory{
			Name:      cat.Name,
			Slug:      cat.Slug,
			PostCount: int32(cat.PostCount),
		}
	}

	return &contentv1.GetBlogCategoriesResponse{
		Categories: protoCategories,
	}, nil
}

// GetBlogTags retrieves all blog tags
func (s *ContentService) GetBlogTags(ctx context.Context, req *contentv1.GetBlogTagsRequest) (*contentv1.GetBlogTagsResponse, error) {
	tags, err := s.blogRepo.GetTags(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get blog tags: %v", err)
	}

	protoTags := make([]*contentv1.BlogTag, len(tags))
	for i, tag := range tags {
		protoTags[i] = &contentv1.BlogTag{
			Name:      tag.Name,
			Slug:      tag.Slug,
			PostCount: int32(tag.PostCount),
		}
	}

	return &contentv1.GetBlogTagsResponse{
		Tags: protoTags,
	}, nil
}

// GetRSSFeed generates RSS feed for blog posts
func (s *ContentService) GetRSSFeed(ctx context.Context, req *contentv1.GetRSSFeedRequest) (*contentv1.GetRSSFeedResponse, error) {
	// Get published blog posts
	options := repository.ListOptions{
		Limit: 50, // RSS feed limit
		Skip:  0,
		Order: "desc",
	}

	posts, err := s.blogRepo.GetPublishedPosts(ctx, options)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get published posts: %v", err)
	}

	// Generate RSS XML
	rssXML := s.generateRSSFeed(posts)

	return &contentv1.GetRSSFeedResponse{
		XmlContent:  rssXML,
		ContentType: "application/rss+xml",
	}, nil
}

// Helper methods for blog posts

func (s *ContentService) validateCreateBlogPostRequest(req *contentv1.CreateBlogPostRequest) error {
	if req.Title == "" {
		return status.Errorf(codes.InvalidArgument, "title is required")
	}
	if req.Author == "" {
		return status.Errorf(codes.InvalidArgument, "author is required")
	}
	return nil
}

func (s *ContentService) validateUpdateBlogPostRequest(req *contentv1.UpdateBlogPostRequest) error {
	if req.Id == "" {
		return status.Errorf(codes.InvalidArgument, "blog post ID is required")
	}
	if req.Title == "" {
		return status.Errorf(codes.InvalidArgument, "title is required")
	}
	if req.Author == "" {
		return status.Errorf(codes.InvalidArgument, "author is required")
	}
	return nil
}

func (s *ContentService) validateBlogSlugUniqueness(ctx context.Context, slug, excludeID string) error {
	existingPost, err := s.blogRepo.GetBySlug(ctx, slug)
	if err == nil && existingPost.ID != excludeID {
		return status.Errorf(codes.AlreadyExists, "blog post with slug '%s' already exists", slug)
	}
	return nil
}

func (s *ContentService) convertBlogModelToProto(post *models.BlogPost) *contentv1.BlogPost {
	protoBlogPost := &contentv1.BlogPost{
		Id:            post.ID,
		Title:         post.Title,
		Slug:          post.Slug,
		Excerpt:       post.Excerpt,
		Content:       s.convertModelContentToProto(post.Content),
		Meta:          s.convertModelMetaToProto(post.Meta),
		Status:        s.convertModelStatusToProto(post.Status),
		Author:        post.Author,
		Categories:    post.Categories,
		Tags:          post.Tags,
		FeaturedImage: post.FeaturedImage,
		CreatedAt:     timestamppb.New(post.CreatedAt),
		UpdatedAt:     timestamppb.New(post.UpdatedAt),
	}

	if post.PublishedAt != nil {
		protoBlogPost.PublishedAt = timestamppb.New(*post.PublishedAt)
	}

	return protoBlogPost
}

func (s *ContentService) generateRSSFeed(posts []*models.BlogPost) string {
	// Basic RSS 2.0 feed generation
	rss := `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>SaaS Startup Platform Blog</title>
<description>Latest insights, tutorials, and updates from our team</description>
<link>https://example.com/blog</link>
<language>en-us</language>
<lastBuildDate>` + time.Now().Format(time.RFC1123Z) + `</lastBuildDate>
`

	for _, post := range posts {
		publishedDate := post.GetPublishedDate().Format(time.RFC1123Z)
		
		// Basic HTML escaping for RSS
		title := html.EscapeString(post.Title)
		description := html.EscapeString(post.Excerpt)
		if description == "" && post.Meta.Description != "" {
			description = html.EscapeString(post.Meta.Description)
		}

		rss += fmt.Sprintf(`<item>
<title>%s</title>
<description>%s</description>
<link>https://example.com/blog/%s</link>
<guid>https://example.com/blog/%s</guid>
<pubDate>%s</pubDate>
<author>%s</author>
`, title, description, post.Slug, post.Slug, publishedDate, html.EscapeString(post.Author))

		// Add categories
		for _, category := range post.Categories {
			rss += fmt.Sprintf(`<category>%s</category>
`, html.EscapeString(category))
		}

		rss += `</item>
`
	}

	rss += `</channel>
</rss>`

	return rss
}
*/
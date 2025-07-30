package models

import (
	"time"
)

// BlogPost represents a blog post document in CouchDB
type BlogPost struct {
	ID           string    `json:"_id"`
	Rev          string    `json:"_rev,omitempty"`
	Type         string    `json:"type"`
	Title        string    `json:"title"`
	Slug         string    `json:"slug"`
	Excerpt      string    `json:"excerpt"`
	Content      Content   `json:"content"`
	Meta         Meta      `json:"meta"`
	Status       string    `json:"status"`
	Author       string    `json:"author"`
	Categories   []string  `json:"categories"`
	Tags         []string  `json:"tags"`
	FeaturedImage string   `json:"featured_image,omitempty"`
	PublishedAt  *time.Time `json:"published_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BlogCategory represents a blog category
type BlogCategory struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	PostCount int    `json:"post_count"`
}

// BlogTag represents a blog tag
type BlogTag struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	PostCount int    `json:"post_count"`
}

// NewBlogPost creates a new blog post with default values
func NewBlogPost(title, slug, author string) *BlogPost {
	now := time.Now()
	return &BlogPost{
		ID:         "blog:" + slug,
		Type:       "blog_post",
		Title:      title,
		Slug:       slug,
		Content:    Content{Blocks: []ContentBlock{}},
		Meta:       Meta{},
		Status:     PageStatusDraft,
		Author:     author,
		Categories: []string{},
		Tags:       []string{},
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// IsPublished returns true if the blog post is published
func (bp *BlogPost) IsPublished() bool {
	return bp.Status == PageStatusPublished && bp.PublishedAt != nil && bp.PublishedAt.Before(time.Now())
}

// GetPublishedDate returns the published date or created date if not published
func (bp *BlogPost) GetPublishedDate() time.Time {
	if bp.PublishedAt != nil {
		return *bp.PublishedAt
	}
	return bp.CreatedAt
}

// SetPublished sets the blog post as published with the current timestamp
func (bp *BlogPost) SetPublished() {
	bp.Status = PageStatusPublished
	now := time.Now()
	bp.PublishedAt = &now
	bp.UpdatedAt = now
}

// SetDraft sets the blog post as draft
func (bp *BlogPost) SetDraft() {
	bp.Status = PageStatusDraft
	bp.PublishedAt = nil
	bp.UpdatedAt = time.Now()
}
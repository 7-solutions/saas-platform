package models

import (
	"time"
)

// Page represents a content page document in CouchDB
type Page struct {
	ID        string    `json:"_id"`
	Rev       string    `json:"_rev,omitempty"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Slug      string    `json:"slug"`
	Content   Content   `json:"content"`
	Meta      Meta      `json:"meta"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Content represents the structured content of a page
type Content struct {
	Blocks []ContentBlock `json:"blocks"`
}

// ContentBlock represents a single content block
type ContentBlock struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

// Meta represents page metadata for SEO
type Meta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Keywords    string `json:"keywords,omitempty"`
}

// PageStatus constants
const (
	PageStatusDraft     = "draft"
	PageStatusPublished = "published"
	PageStatusArchived  = "archived"
)

// NewPage creates a new page with default values
func NewPage(title, slug string) *Page {
	now := time.Now()
	return &Page{
		ID:        "page:" + slug,
		Type:      "page",
		Title:     title,
		Slug:      slug,
		Content:   Content{Blocks: []ContentBlock{}},
		Meta:      Meta{},
		Status:    PageStatusDraft,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
package database

import (
	"context"
	"fmt"
)

// DesignDocument represents a CouchDB design document
type DesignDocument struct {
	ID       string                 `json:"_id"`
	Language string                 `json:"language"`
	Views    map[string]interface{} `json:"views"`
}

// View represents a CouchDB view
type View struct {
	Map    string `json:"map"`
	Reduce string `json:"reduce,omitempty"`
}

// SetupViews creates all necessary design documents and views
func (c *Client) SetupViews(ctx context.Context) error {
	// Pages design document
	pagesDesign := DesignDocument{
		ID:       "_design/pages",
		Language: "javascript",
		Views: map[string]interface{}{
			"all": View{
				Map: `function(doc) {
					if (doc.type === 'page') {
						emit(doc.created_at, doc);
					}
				}`,
			},
			"by_status": View{
				Map: `function(doc) {
					if (doc.type === 'page') {
						emit(doc.status, doc);
					}
				}`,
			},
			"by_slug": View{
				Map: `function(doc) {
					if (doc.type === 'page') {
						emit(doc.slug, doc);
					}
				}`,
			},
		},
	}

	if err := c.CreateDesignDocument(ctx, "_design/pages", pagesDesign); err != nil {
		return fmt.Errorf("failed to create pages design document: %w", err)
	}

	// Users design document
	usersDesign := DesignDocument{
		ID:       "_design/users",
		Language: "javascript",
		Views: map[string]interface{}{
			"all": View{
				Map: `function(doc) {
					if (doc.type === 'user') {
						emit(doc.created_at, doc);
					}
				}`,
			},
			"by_email": View{
				Map: `function(doc) {
					if (doc.type === 'user') {
						emit(doc.email, doc);
					}
				}`,
			},
			"by_role": View{
				Map: `function(doc) {
					if (doc.type === 'user') {
						emit(doc.role, doc);
					}
				}`,
			},
		},
	}

	if err := c.CreateDesignDocument(ctx, "_design/users", usersDesign); err != nil {
		return fmt.Errorf("failed to create users design document: %w", err)
	}

	// Media design document
	mediaDesign := DesignDocument{
		ID:       "_design/media",
		Language: "javascript",
		Views: map[string]interface{}{
			"all": View{
				Map: `function(doc) {
					if (doc.type === 'media') {
						emit(doc.created_at, doc);
					}
				}`,
			},
			"by_filename": View{
				Map: `function(doc) {
					if (doc.type === 'media') {
						emit(doc.filename, doc);
					}
				}`,
			},
			"by_uploader": View{
				Map: `function(doc) {
					if (doc.type === 'media') {
						emit(doc.uploaded_by, doc);
					}
				}`,
			},
		},
	}

	if err := c.CreateDesignDocument(ctx, "_design/media", mediaDesign); err != nil {
		return fmt.Errorf("failed to create media design document: %w", err)
	}

	// Blog posts design document
	blogPostsDesign := DesignDocument{
		ID:       "_design/blog_posts",
		Language: "javascript",
		Views: map[string]interface{}{
			"all": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post') {
						emit(doc.created_at, doc);
					}
				}`,
			},
			"by_slug": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post') {
						emit(doc.slug, doc);
					}
				}`,
			},
			"by_status": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post') {
						emit(doc.status, doc);
					}
				}`,
			},
			"by_author": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post') {
						emit(doc.author, doc);
					}
				}`,
			},
			"by_category": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.categories) {
						for (var i = 0; i < doc.categories.length; i++) {
							emit(doc.categories[i], doc);
						}
					}
				}`,
			},
			"by_tag": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.tags) {
						for (var i = 0; i < doc.tags.length; i++) {
							emit(doc.tags[i], doc);
						}
					}
				}`,
			},
			"published": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.status === 'published' && doc.published_at) {
						var publishedDate = new Date(doc.published_at);
						var now = new Date();
						if (publishedDate <= now) {
							emit(doc.published_at, doc);
						}
					}
				}`,
			},
			"categories": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.categories && doc.status === 'published') {
						for (var i = 0; i < doc.categories.length; i++) {
							emit(doc.categories[i], 1);
						}
					}
				}`,
				Reduce: "_count",
			},
			"tags": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.tags && doc.status === 'published') {
						for (var i = 0; i < doc.tags.length; i++) {
							emit(doc.tags[i], 1);
						}
					}
				}`,
				Reduce: "_count",
			},
			"search": View{
				Map: `function(doc) {
					if (doc.type === 'blog_post' && doc.status === 'published') {
						var searchText = '';
						if (doc.title) searchText += doc.title.toLowerCase() + ' ';
						if (doc.excerpt) searchText += doc.excerpt.toLowerCase() + ' ';
						if (doc.meta && doc.meta.description) searchText += doc.meta.description.toLowerCase() + ' ';
						if (doc.categories) searchText += doc.categories.join(' ').toLowerCase() + ' ';
						if (doc.tags) searchText += doc.tags.join(' ').toLowerCase() + ' ';
						
						// Emit individual words for search
						var words = searchText.split(/\s+/);
						for (var i = 0; i < words.length; i++) {
							if (words[i].length > 2) {
								emit(words[i], doc);
							}
						}
					}
				}`,
			},
		},
	}

	if err := c.CreateDesignDocument(ctx, "_design/blog_posts", blogPostsDesign); err != nil {
		return fmt.Errorf("failed to create blog_posts design document: %w", err)
	}

	// Contact submissions design document
	contactSubmissionsDesign := DesignDocument{
		ID:       "_design/contact_submissions",
		Language: "javascript",
		Views: map[string]interface{}{
			"by_created_at": View{
				Map: `function(doc) {
					if (doc.type === 'contact_submission') {
						emit(doc.created_at, doc);
					}
				}`,
			},
			"by_status": View{
				Map: `function(doc) {
					if (doc.type === 'contact_submission') {
						emit(doc.status, doc);
					}
				}`,
			},
			"by_email": View{
				Map: `function(doc) {
					if (doc.type === 'contact_submission') {
						emit(doc.email, doc);
					}
				}`,
			},
			"count": View{
				Map: `function(doc) {
					if (doc.type === 'contact_submission') {
						emit(null, 1);
					}
				}`,
				Reduce: "_count",
			},
			"search": View{
				Map: `function(doc) {
					if (doc.type === 'contact_submission') {
						var searchText = '';
						if (doc.name) searchText += doc.name.toLowerCase() + ' ';
						if (doc.email) searchText += doc.email.toLowerCase() + ' ';
						if (doc.company) searchText += doc.company.toLowerCase() + ' ';
						if (doc.message) searchText += doc.message.toLowerCase() + ' ';
						
						// Emit individual words for search
						var words = searchText.split(/\s+/);
						for (var i = 0; i < words.length; i++) {
							if (words[i].length > 2) {
								emit(words[i], doc);
							}
						}
					}
				}`,
			},
		},
	}

	if err := c.CreateDesignDocument(ctx, "_design/contact_submissions", contactSubmissionsDesign); err != nil {
		return fmt.Errorf("failed to create contact_submissions design document: %w", err)
	}

	return nil
}
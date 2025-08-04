package ports

import (
	"context"
)

// NOTE: These thin domain placeholders mirror existing service/domain shapes
// used around ports. If a central domain model already exists, these types are
// intentionally compatible (field/subset-wise) so they can be substituted
// without breaking handlers. They allow presenters to compile independently.
// If backend/internal/ports/ports.go already defines Page/BlogPost, those should
// be preferred by the compiler since packages unify symbols; otherwise these
// placeholders are used.
type Page struct {
	ID        string
	Slug      string
	Title     string
	Content   string
	CreatedAt int64 // unix seconds
	UpdatedAt int64 // unix seconds
	Published bool
}

type BlogPost struct {
	ID        string
	Slug      string
	Title     string
	Excerpt   string
	Content   string
	Author    string
	Tags      []string
	CreatedAt int64 // unix seconds
	UpdatedAt int64 // unix seconds
	Published bool
}

// ContentGrpcPresenter defines conversions from domain to transport-specific gRPC DTOs for Content.
//
// Transport-agnostic handlers/services can depend on this port without importing protos.
// Adapters implement the mapping to generated protos under backend/gen/content/v1.
type ContentGrpcPresenter interface {
	// Page
	ToProtoPage(page *Page) any
	ToProtoPageList(pages []*Page, nextToken string) any

	// Blog post
	ToProtoPost(post *BlogPost) any
	ToProtoPostList(posts []*BlogPost, nextToken string) any

	// Error mapping to gRPC status errors
	ToError(err error) error
}

// ContentHTTPPresenter defines conversions from domain to HTTP JSON responses.
//
// Implementations return plain Go values (structs/maps) suitable for json.Marshal.
// This presenter keeps HTTP boundary details out of domain/services.
type ContentHTTPPresenter interface {
	// Page
	Page(ctx context.Context, page *Page) any
	PageList(ctx context.Context, pages []*Page, nextToken string) any

	// Blog post
	Post(ctx context.Context, post *BlogPost) any
	PostList(ctx context.Context, posts []*BlogPost, nextToken string) any

	// Error mapping to (statusCode, body) where body is JSON-marshallable
	Error(ctx context.Context, err error) (status int, body any)
}
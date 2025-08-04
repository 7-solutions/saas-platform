package presenters

import (
	"context"
	"errors"
	"time"

	"github.com/7-solutions/saas-platformbackend/internal/ports"
	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
)

// ContentHTTPPresenterImpl adapts domain models to HTTP JSON-friendly DTOs.
// It satisfies ports.ContentHTTPPresenter. It is side-effect free.
type ContentHTTPPresenterImpl struct{}

// NewContentHTTPPresenter constructs an HTTP presenter for Content.
func NewContentHTTPPresenter() *ContentHTTPPresenterImpl {
	return &ContentHTTPPresenterImpl{}
}

// httpPage is a plain struct suitable for json.Marshal
type httpPage struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Slug      string   `json:"slug"`
	Content   string   `json:"content"`
	Status    string   `json:"status"`
	CreatedAt int64    `json:"created_at"` // unix seconds
	UpdatedAt int64    `json:"updated_at"` // unix seconds
	Tags      []string `json:"tags,omitempty"`
}

type httpPageList struct {
	Pages         []httpPage `json:"pages"`
	NextPageToken string     `json:"next_page_token,omitempty"`
	TotalCount    int        `json:"total_count,omitempty"`
}

type httpPost struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Slug        string   `json:"slug"`
	Excerpt     string   `json:"excerpt,omitempty"`
	Content     string   `json:"content"`
	Author      string   `json:"author,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Status      string   `json:"status"`
	PublishedAt int64    `json:"published_at,omitempty"`
	CreatedAt   int64    `json:"created_at"`
	UpdatedAt   int64    `json:"updated_at"`
}

type httpPostList struct {
	Posts         []httpPost `json:"posts"`
	NextPageToken string     `json:"next_page_token,omitempty"`
	TotalCount    int        `json:"total_count,omitempty"`
}

func statusFromPublished(published bool) string {
	if published {
		return "PUBLISHED"
	}
	return "DRAFT"
}

func toUnix(sec int64) int64 {
	if sec <= 0 {
		return 0
	}
	return time.Unix(sec, 0).UTC().Unix()
}

func (p *ContentHTTPPresenterImpl) Page(ctx context.Context, page *ports.Page) any {
	if page == nil {
		return (*httpPage)(nil)
	}
	return httpPage{
		ID:        page.ID,
		Title:     page.Title,
		Slug:      page.Slug,
		Content:   page.Content,
		Status:    statusFromPublished(page.Published),
		CreatedAt: toUnix(page.CreatedAt),
		UpdatedAt: toUnix(page.UpdatedAt),
	}
}

func (p *ContentHTTPPresenterImpl) PageList(ctx context.Context, pages []*ports.Page, nextToken string) any {
	out := make([]httpPage, 0, len(pages))
	for _, pg := range pages {
		if pg == nil {
			continue
		}
		out = append(out, httpPage{
			ID:        pg.ID,
			Title:     pg.Title,
			Slug:      pg.Slug,
			Content:   pg.Content,
			Status:    statusFromPublished(pg.Published),
			CreatedAt: toUnix(pg.CreatedAt),
			UpdatedAt: toUnix(pg.UpdatedAt),
		})
	}
	return httpPageList{
		Pages:         out,
		NextPageToken: nextToken,
	}
}

func (p *ContentHTTPPresenterImpl) Post(ctx context.Context, post *ports.BlogPost) any {
	if post == nil {
		return (*httpPost)(nil)
	}
	return httpPost{
		ID:          post.ID,
		Title:       post.Title,
		Slug:        post.Slug,
		Excerpt:     post.Excerpt,
		Content:     post.Content,
		Author:      post.Author,
		Tags:        post.Tags,
		Status:      statusFromPublished(post.Published),
		PublishedAt: toUnix(post.CreatedAt), // domain lacks explicit PublishedAt; fallback to CreatedAt
		CreatedAt:   toUnix(post.CreatedAt),
		UpdatedAt:   toUnix(post.UpdatedAt),
	}
}

func (p *ContentHTTPPresenterImpl) PostList(ctx context.Context, posts []*ports.BlogPost, nextToken string) any {
	out := make([]httpPost, 0, len(posts))
	for _, pt := range posts {
		if pt == nil {
			continue
		}
		out = append(out, httpPost{
			ID:          pt.ID,
			Title:       pt.Title,
			Slug:        pt.Slug,
			Excerpt:     pt.Excerpt,
			Content:     pt.Content,
			Author:      pt.Author,
			Tags:        pt.Tags,
			Status:      statusFromPublished(pt.Published),
			PublishedAt: toUnix(pt.CreatedAt),
			CreatedAt:   toUnix(pt.CreatedAt),
			UpdatedAt:   toUnix(pt.UpdatedAt),
		})
	}
	return httpPostList{
		Posts:         out,
		NextPageToken: nextToken,
	}
}

type httpErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error maps domain/service errors to HTTP status code and JSON error body.
func (p *ContentHTTPPresenterImpl) Error(ctx context.Context, err error) (status int, body any) {
	if err == nil {
		return 200, nil
	}
	switch {
	case errors.Is(err, appErr.ErrNotFound):
		return 404, httpErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, appErr.ErrConflict):
		return 409, httpErrorBody{Code: "CONFLICT", Message: err.Error()}
	default:
		return 500, httpErrorBody{Code: "INTERNAL", Message: "internal server error"}
	}
}

/*
Example usage in an HTTP handler (pseudo-code):

func (h *ContentHTTPHandler) GetPage(w http.ResponseWriter, r *http.Request) {
  slug := chi.URLParam(r, "slug")
  page, err := h.contentSvc.GetPage(r.Context(), slug)
  if err != nil {
    status, body := h.presenters.HTTP.Error(r.Context(), err)
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(body)
    return
  }
  resp := h.presenters.HTTP.Page(r.Context(), page)
  _ = json.NewEncoder(w).Encode(resp)
}
*/

package presenters

import (
	"errors"
	"time"

	contentv1 "github.com/7-solutions/saas-platformbackend/gen/content/v1"
	"github.com/7-solutions/saas-platformbackend/internal/ports"
	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ContentGrpcPresenterImpl adapts domain models to gRPC protobuf DTOs for the Content domain.
// It satisfies ports.ContentGrpcPresenter.
type ContentGrpcPresenterImpl struct{}

// NewContentGrpcPresenter constructs a gRPC presenter for Content.
func NewContentGrpcPresenter() *ContentGrpcPresenterImpl {
	return &ContentGrpcPresenterImpl{}
}

func unixToTime(sec int64) time.Time {
	if sec <= 0 {
		return time.Time{}
	}
	return time.Unix(sec, 0).UTC()
}

// ToProtoPage converts a domain Page into a protobuf Page.
func (p *ContentGrpcPresenterImpl) ToProtoPage(page *ports.Page) any {
	if page == nil {
		return (*contentv1.Page)(nil)
	}
	var status contentv1.PageStatus
	if page.Published {
		status = contentv1.PageStatus_PAGE_STATUS_PUBLISHED
	} else {
		status = contentv1.PageStatus_PAGE_STATUS_DRAFT
	}
	return &contentv1.Page{
		Id:    page.ID,
		Title: page.Title,
		Slug:  page.Slug,
		Content: &contentv1.PageContent{
			// Best-effort: if domain stores raw HTML/markdown in Content string,
			// map it into a single block.
			Blocks: []*contentv1.ContentBlock{
				{
					Type: "raw",
					Data: map[string]string{"text": page.Content},
				},
			},
		},
		Status:    status,
		CreatedAt: timestamppb.New(unixToTime(page.CreatedAt)),
		UpdatedAt: timestamppb.New(unixToTime(page.UpdatedAt)),
	}
}

// ToProtoPageList converts a list of domain Pages plus pagination token into ListPagesResponse.
func (p *ContentGrpcPresenterImpl) ToProtoPageList(pages []*ports.Page, nextToken string) any {
	out := make([]*contentv1.Page, 0, len(pages))
	for _, pg := range pages {
		if x, ok := p.ToProtoPage(pg).(*contentv1.Page); ok && x != nil {
			out = append(out, x)
		}
	}
	return &contentv1.ListPagesResponse{
		Pages:         out,
		NextPageToken: nextToken,
	}
}

// ToProtoPost converts a domain BlogPost into a protobuf Post.
func (p *ContentGrpcPresenterImpl) ToProtoPost(post *ports.BlogPost) any {
	if post == nil {
		return (*contentv1.BlogPost)(nil)
	}
	status := contentv1.PageStatus_PAGE_STATUS_DRAFT
	if post.Published {
		status = contentv1.PageStatus_PAGE_STATUS_PUBLISHED
	}
	return &contentv1.BlogPost{
		Id:      post.ID,
		Title:   post.Title,
		Slug:    post.Slug,
		Excerpt: post.Excerpt,
		Content: &contentv1.PageContent{
			Blocks: []*contentv1.ContentBlock{
				{
					Type: "raw",
					Data: map[string]string{"text": post.Content},
				},
			},
		},
		Status:    status,
		Author:    post.Author,
		Tags:      post.Tags,
		CreatedAt: timestamppb.New(unixToTime(post.CreatedAt)),
		UpdatedAt: timestamppb.New(unixToTime(post.UpdatedAt)),
	}
}

// ToProtoPostList converts posts plus token into ListPostsResponse.
func (p *ContentGrpcPresenterImpl) ToProtoPostList(posts []*ports.BlogPost, nextToken string) any {
	out := make([]*contentv1.BlogPost, 0, len(posts))
	for _, pt := range posts {
		if x, ok := p.ToProtoPost(pt).(*contentv1.BlogPost); ok && x != nil {
			out = append(out, x)
		}
	}
	return &contentv1.ListBlogPostsResponse{
		Posts:         out,
		NextPageToken: nextToken,
	}
}

// ToError maps application errors to appropriate gRPC status errors.
func (p *ContentGrpcPresenterImpl) ToError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, appErr.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, appErr.ErrConflict):
		return status.Error(codes.AlreadyExists, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}

/*
Example usage in a gRPC handler (pseudo-code):

func (s *ContentServer) GetPage(ctx context.Context, req *contentv1.GetPageRequest) (*contentv1.Page, error) {
  page, err := s.contentSvc.GetPage(ctx, req.Id)
  if err != nil {
    return nil, s.presenters.GRPC.ToError(err)
  }
  // Convert to proto using presenter
  p := s.presenters.GRPC.ToProtoPage(page).(*contentv1.Page)
  return p, nil
}
*/

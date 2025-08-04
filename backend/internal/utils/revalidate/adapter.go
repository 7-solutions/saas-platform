package revalidate

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
)

// TODO: Move this interface to backend/internal/ports when canonical ports are added.
type Revalidator interface {
	RevalidatePage(ctx context.Context, path string) error
	RevalidateTag(ctx context.Context, tag string) error
}

// NextRevalidatorHTTP implements a minimal HTTP client to Next.js ISR revalidate APIs.
// It is provider-agnostic and uses placeholders with normalized errors.
type NextRevalidatorHTTP struct {
	baseURL    string
	token      string
	httpClient *http.Client
	timeout    time.Duration
}

// NewNextRevalidatorHTTP constructs the adapter with baseURL, token and http client.
// A default timeout of 5s is applied if client has no timeout.
func NewNextRevalidatorHTTP(baseURL, token string, client *http.Client) *NextRevalidatorHTTP {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	timeout := client.Timeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	return &NextRevalidatorHTTP{
		baseURL:    stringsTrimRightSlash(baseURL),
		token:      token,
		httpClient: client,
		timeout:    timeout,
	}
}

func (n *NextRevalidatorHTTP) RevalidatePage(ctx context.Context, path string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	u := fmt.Sprintf("%s/api/revalidate/page", n.baseURL)
	body := []byte(fmt.Sprintf(`{"path":%q,"token":%q}`, path, n.token))
	return n.doPost(ctx, u, body)
}

func (n *NextRevalidatorHTTP) RevalidateTag(ctx context.Context, tag string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	u := fmt.Sprintf("%s/api/revalidate/tag", n.baseURL)
	body := []byte(fmt.Sprintf(`{"tag":%q,"token":%q}`, tag, n.token))
	return n.doPost(ctx, u, body)
}

func (n *NextRevalidatorHTTP) doPost(ctx context.Context, endpoint string, payload []byte) error {
	if _, err := url.Parse(endpoint); err != nil {
		return fmt.Errorf("revalidate: invalid url %q: %w", endpoint, err)
	}

	// Respect context cancellation via http.NewRequestWithContext
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("revalidate: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// TODO: add retry/backoff if needed.
	resp, err := n.httpClient.Do(req)
	if err != nil {
		// Propagate ctx cancellation transparently.
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("revalidate: do request: %w", err)
	}
	defer func() { io.Copy(io.Discard, resp.Body); resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusAccepted, http.StatusNoContent:
		return nil
	case http.StatusNotFound:
		return appErr.ErrNotFound
	case http.StatusConflict:
		return appErr.ErrConflict
	default:
		return fmt.Errorf("revalidate: unexpected status %d", resp.StatusCode)
	}
}

func stringsTrimRightSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

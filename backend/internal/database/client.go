package database

// PostgresClient is defined in postgres.go; this shim constructor wraps an existing pgxpool.Pool.
// Duplicated definitions are avoided by ensuring we only declare helpers here when missing in postgres.go.

// PostgresClient is a lightweight adapter around *pgxpool.Pool for SQL-backed repositories.
type PostgresClient struct {
	Pool *pgxpool.Pool
}

// NewPostgresClient constructs a PostgresClient from a pgx pool.
func NewPostgresClient(pool *pgxpool.Pool) *PostgresClient {
	return &PostgresClient{Pool: pool}
}

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client wraps the CouchDB HTTP client with connection management
type Client struct {
	httpClient *http.Client
	baseURL    string
	username   string
	password   string
	dbName     string
}

// Config holds the database configuration
type Config struct {
	URL      string
	Username string
	Password string
	Database string
}

// Document represents a CouchDB document response
type Document struct {
	ID  string `json:"_id"`
	Rev string `json:"_rev"`
}

// QueryResult represents a CouchDB query result
type QueryResult struct {
	TotalRows int             `json:"total_rows"`
	Offset    int             `json:"offset"`
	Rows      []QueryResultRow `json:"rows"`
}

// QueryResultRow represents a single row in a query result
type QueryResultRow struct {
	ID    string          `json:"id"`
	Key   interface{}     `json:"key"`
	Value interface{}     `json:"value"`
	Doc   json.RawMessage `json:"doc,omitempty"`
}

// ErrorResponse represents a CouchDB error response
type ErrorResponse struct {
	Error  string `json:"error"`
	Reason string `json:"reason"`
}

// NewClient creates a new CouchDB HTTP client with connection management
func NewClient(config Config) (*Client, error) {
	// Retain for backward compatibility of CouchDB code paths in this step.
	client := &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    config.URL,
		username:   config.Username,
		password:   config.Password,
		dbName:     config.Database,
	}
	return client, nil
}

// makeRequest makes an HTTP request to CouchDB
func (c *Client) makeRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	return nil, fmt.Errorf("CouchDB HTTP not supported in this phase")
}

// DBExists checks if the database exists
func (c *Client) DBExists(ctx context.Context) (bool, error) {
	url := fmt.Sprintf("%s/%s", c.baseURL, c.dbName)
	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	if c.username != "" && c.password != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

// CreateDB creates the database
func (c *Client) CreateDB(ctx context.Context) error {
	url := fmt.Sprintf("%s/%s", c.baseURL, c.dbName)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if c.username != "" && c.password != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create database: %s", string(body))
	}

	return nil
}

// Put creates or updates a document
func (c *Client) Put(ctx context.Context, id string, doc interface{}) (*Document, error) {
	resp, err := c.makeRequest(ctx, "PUT", id, doc)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to put document: %s", string(body))
	}

	var result Document
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Get retrieves a document
func (c *Client) Get(ctx context.Context, id string, doc interface{}) error {
	resp, err := c.makeRequest(ctx, "GET", id, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("document not found: %s", id)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to get document: %s", string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(doc); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

// Delete deletes a document
func (c *Client) Delete(ctx context.Context, id, rev string) error {
	path := fmt.Sprintf("%s?rev=%s", id, url.QueryEscape(rev))
	resp, err := c.makeRequest(ctx, "DELETE", path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete document: %s", string(body))
	}

	return nil
}

// Query executes a view query
func (c *Client) Query(ctx context.Context, designDoc, viewName string, params map[string]interface{}) (*QueryResult, error) {
	path := fmt.Sprintf("_design/%s/_view/%s", designDoc, viewName)
	
	if len(params) > 0 {
		values := url.Values{}
		for k, v := range params {
			switch val := v.(type) {
			case string:
				if k == "key" || k == "startkey" || k == "endkey" {
					// JSON encode string keys for CouchDB
					jsonVal, _ := json.Marshal(val)
					values.Add(k, string(jsonVal))
				} else {
					values.Add(k, val)
				}
			case int:
				values.Add(k, fmt.Sprintf("%d", val))
			case bool:
				values.Add(k, fmt.Sprintf("%t", val))
			default:
				jsonVal, _ := json.Marshal(val)
				values.Add(k, string(jsonVal))
			}
		}
		path += "?" + values.Encode()
	}

	resp, err := c.makeRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to query view: %s", string(body))
	}

	var result QueryResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Close closes the client connection
func (c *Client) Close() error {
	return nil
}

// Ping checks if the database is accessible
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.DBExists(ctx)
	return err
}

// CreateDesignDocument creates or updates a design document idempotently.
// It will fetch the current _rev if the doc exists and retry on conflict.
func (c *Client) CreateDesignDocument(ctx context.Context, designDoc string, doc interface{}) error {
	// Attempt to put first (create or replace if caller provided _rev)
	if _, err := c.Put(ctx, designDoc, doc); err == nil {
		return nil
	}

	// If failed (likely conflict), fetch existing to get current _rev and merge it in.
	// We decode into a generic map to inject _rev easily.
	var existing map[string]interface{}
	getErr := c.Get(ctx, designDoc, &existing)
	if getErr != nil {
		return fmt.Errorf("failed to create design document %s: %w", designDoc, getErr)
	}

	// Marshal provided doc into map
	var docMap map[string]interface{}
	b, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to marshal design doc for upsert %s: %w", designDoc, err)
	}
	if err := json.Unmarshal(b, &docMap); err != nil {
		return fmt.Errorf("failed to unmarshal design doc for upsert %s: %w", designDoc, err)
	}

	// Inject current _rev
	if rev, ok := existing["_rev"].(string); ok && rev != "" {
		docMap["_rev"] = rev
	}

	// Retry put with _rev
	if _, err := c.Put(ctx, designDoc, docMap); err != nil {
		return fmt.Errorf("failed to upsert design document %s: %w", designDoc, err)
	}
	return nil
}

// Upsert puts a document with automatic _rev fetch and single retry on conflict.
func (c *Client) Upsert(ctx context.Context, id string, doc interface{}) (*Document, error) {
	// Try first put
	if d, err := c.Put(ctx, id, doc); err == nil {
		return d, nil
	}

	// Fetch latest rev
	var existing map[string]interface{}
	if err := c.Get(ctx, id, &existing); err != nil {
		// If not found, try create again
		if strings.Contains(err.Error(), "document not found") {
			return c.Put(ctx, id, doc)
		}
		return nil, err
	}

	// Merge _rev into doc
	var docMap map[string]interface{}
	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal doc for upsert %s: %w", id, err)
	}
	if err := json.Unmarshal(raw, &docMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal doc for upsert %s: %w", id, err)
	}
	if rev, ok := existing["_rev"].(string); ok && rev != "" {
		docMap["_rev"] = rev
	}
	return c.Put(ctx, id, docMap)
}

// NewTestClient creates a new test client with a unique test database
func NewTestClient() (*Client, error) {
	return &Client{httpClient: &http.Client{Timeout: 30 * time.Second}}, nil
}
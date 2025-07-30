package database

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
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
	client := &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    strings.TrimSuffix(config.URL, "/"),
		username:   config.Username,
		password:   config.Password,
		dbName:     config.Database,
	}

	// Create database if it doesn't exist
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.DBExists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check if database exists: %w", err)
	}

	if !exists {
		err = client.CreateDB(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to create database: %w", err)
		}
		log.Printf("Created database: %s", config.Database)
	}

	return client, nil
}

// makeRequest makes an HTTP request to CouchDB
func (c *Client) makeRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	url := fmt.Sprintf("%s/%s/%s", c.baseURL, c.dbName, strings.TrimPrefix(path, "/"))
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if c.username != "" && c.password != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	return resp, nil
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
	// HTTP client doesn't need explicit closing
	return nil
}

// Ping checks if the database is accessible
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.DBExists(ctx)
	return err
}

// CreateDesignDocument creates or updates a design document
func (c *Client) CreateDesignDocument(ctx context.Context, designDoc string, doc interface{}) error {
	_, err := c.Put(ctx, designDoc, doc)
	if err != nil {
		return fmt.Errorf("failed to create design document %s: %w", designDoc, err)
	}
	return nil
}

// NewTestClient creates a new test client with a unique test database
func NewTestClient() (*Client, error) {
	// Generate a unique test database name
	testDBName := fmt.Sprintf("test_db_%d", time.Now().UnixNano())
	
	config := Config{
		URL:      "http://localhost:5984",
		Username: "admin",
		Password: "password",
		Database: testDBName,
	}

	return NewClient(config)
}
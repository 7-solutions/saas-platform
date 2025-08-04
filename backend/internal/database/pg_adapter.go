package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresClient is a lightweight adapter around *pgxpool.Pool for SQL-backed repositories.
// This mirrors the expected type by NewBlogRepositorySQL/NewMediaRepositorySQL without
// altering existing postgres.go implementations.
type PostgresClient struct {
	Pool *pgxpool.Pool
}

// NewPostgresClientFromPool constructs a PostgresClient from a pgx pool.
func NewPostgresClientFromPool(pool *pgxpool.Pool) *PostgresClient {
	return &PostgresClient{Pool: pool}
}

// Ping verifies connectivity (optional convenience).
func (c *PostgresClient) Ping(ctx context.Context) error {
	if c == nil || c.Pool == nil {
		return fmt.Errorf("nil postgres client or pool")
	}
	return c.Pool.Ping(ctx)
}
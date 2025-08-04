package database

import (
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/saas-startup-platform/backend/internal/database/sqlc"
)

// NewQueriesFromPool returns a sqlc Queries bound to the provided pgx pool.
func NewQueriesFromPool(pool *pgxpool.Pool) *db.Queries {
	if pool == nil {
		return nil
	}
	return db.New(pool)
}

// NewQueriesFromClient returns the sqlc Queries from a PostgresClient.
func NewQueriesFromClient(c *PostgresClient) *db.Queries {
	if c == nil {
		return nil
	}
	return c.Sqlc()
}
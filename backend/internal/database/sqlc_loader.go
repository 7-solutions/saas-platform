package database

import (
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
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

// NewSQLCQueriesFromPool returns sqlc Queries initialized against the provided pool.
// TODO(asap): Adopt in cmd/api or internal/server startup when wiring pgxpool.
func NewSQLCQueriesFromPool(pool *pgxpool.Pool) *db.Queries {
	if pool == nil {
		return nil
	}
	return db.New(pool)
}

// NewUnitOfWorkFromPool builds a *SQLUnitOfWork using the provided pool and queries.
// Note: This name already exists in config.go with a different signature; to avoid
// redeclaration while still providing the requested factory, we use a distinct name here.
// TODO(asap): Use from app initialization to create a shared UoW instance.
func NewSQLUnitOfWorkFromPool(pool PgxBeginner, q *db.Queries, logger Logger) *SQLUnitOfWork {
	if pool == nil || q == nil {
		return nil
	}
	return NewSQLUnitOfWork(pool, q, logger)
}

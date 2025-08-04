package database

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	
	db "github.com/saas-startup-platform/backend/internal/database/sqlc"
)

// PostgresClient wraps a pgx connection pool and sqlc queries adapter.
type PostgresClient struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// NewPostgresClient initializes a pgx connection pool based on env config and verifies connectivity.
// - Uses DATABASE_URL if present; otherwise builds from POSTGRES_* variables.
// - Configures MaxConns from POSTGRES_MAX_CONNS (default 10).
// - Pings the DB to ensure readiness.
// - Respects context cancellation for Connect and Ping.
// - SSLMode can be provided via the URL's sslmode query parameter.
func NewPostgresClient(ctx context.Context) (*PostgresClient, error) {
	cfg := LoadPGConfig()

	pgxCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	// Apply sensible defaults
	pgxCfg.MaxConns = cfg.MaxConns

	// Connect with context
	pool, err := pgxpool.NewWithConfig(ctx, pgxCfg)
	if err != nil {
		return nil, err
	}

	// Health check ping honoring context
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}

	// Initialize sqlc queries bound to this pool
	queries := db.New(pool)

	// Log connection success. Prefer internal logger if available later.
	log.Printf("Postgres connected: maxConns=%d", pgxCfg.MaxConns)

	return &PostgresClient{
		pool: pool,
		q:    queries,
	}, nil
}

// Close closes the pgx pool.
func (c *PostgresClient) Close() {
	if c == nil || c.pool == nil {
		return
	}
	c.pool.Close()
}

// Sqlc returns the sqlc-generated Queries handle.
func (c *PostgresClient) Sqlc() *db.Queries {
	return c.q
}

// Pool exposes the underlying pgxpool.Pool for advanced usage.
func (c *PostgresClient) Pool() *pgxpool.Pool {
	return c.pool
}
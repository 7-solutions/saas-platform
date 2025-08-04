package database

import (
	"context"
	"errors"
	"log"

	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
	"github.com/jackc/pgx/v5"
)

// SQLUnitOfWork implements ports.UnitOfWork backed by pgx and sqlc.
type SQLUnitOfWork struct {
	pool   PgxBeginner
	base   *db.Queries
	logger Logger
}

// PgxBeginner represents the minimal subset needed from a pgx pool or conn.
type PgxBeginner interface {
	BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error)
}

// Logger is a minimal logger used by database package.
type Logger interface {
	Printf(format string, v ...any)
}

// context key for tx-bound Queries
type queriesCtxKey struct{}

// NewSQLUnitOfWork creates a new SQLUnitOfWork.
// pool should be a pgxpool.Pool or equivalent implementing BeginTx.
// base is a non-tx bound *db.Queries for fallback usage.
func NewSQLUnitOfWork(pool PgxBeginner, base *db.Queries, logger Logger) *SQLUnitOfWork {
	if logger == nil {
		logger = stdLogger{}
	}
	return &SQLUnitOfWork{
		pool:   pool,
		base:   base,
		logger: logger,
	}
}

// Do runs the function within a transaction. It exposes a tx-bound sqlc Queries
// via context so that adapters can pick it up. On error, rolls back; otherwise commits.
func (u *SQLUnitOfWork) Do(ctx context.Context, fn func(ctx context.Context) error) error {
	if u.pool == nil {
		return errors.New("unit of work not configured: missing pool")
	}
	tx, err := u.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	q := db.New(tx)
	ctxWithQ := context.WithValue(ctx, queriesCtxKey{}, q)

	if err := fn(ctxWithQ); err != nil {
		rbErr := tx.Rollback(ctx)
		if rbErr != nil {
			u.logger.Printf("rollback error: %v", rbErr)
		}
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

// QueriesFromContext returns a tx-aware *db.Queries if present, otherwise nil.
// Adapters can fallback to their base Queries when this returns nil.
func QueriesFromContext(ctx context.Context) *db.Queries {
	if ctx == nil {
		return nil
	}
	if v := ctx.Value(queriesCtxKey{}); v != nil {
		if q, ok := v.(*db.Queries); ok {
			return q
		}
	}
	return nil
}

// stdLogger is a basic logger fallback.
type stdLogger struct{}

func (stdLogger) Printf(format string, v ...any) {
	log.Printf(format, v...)
}

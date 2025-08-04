package repository

import (
	"context"
	"log"

	dal "github.com/7-solutions/saas-platformbackend/internal/database"
	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
	"github.com/7-solutions/saas-platformbackend/internal/ports"
	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
)

// minimal local ListOptions fallback if ports.ListOptions changes later
type listOptions = ports.ListOptions

// usersRepositorySQL implements ports.UsersRepository using sqlc Queries.
type usersRepositorySQL struct {
	base   *db.Queries
	logger Logger
}

// Logger is a minimal logger used by adapters.
// If there's a project-wide logger, adapters can accept it here later.
type Logger interface {
	Printf(format string, v ...any)
}

// ensure usersRepositorySQL satisfies the interface
var _ ports.UsersRepository = (*usersRepositorySQL)(nil)

// getQ returns tx-bound Queries from context when available, otherwise the base queries.
func (r *usersRepositorySQL) getQ(ctx context.Context) *db.Queries {
	if q := dal.QueriesFromContext(ctx); q != nil {
		return q
	}
	return r.base
}

func (r *usersRepositorySQL) GetByEmail(ctx context.Context, email string) (*ports.User, error) {
	q := r.getQ(ctx)
	u, err := q.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	return mapSQLCUser(u), nil
}

func (r *usersRepositorySQL) List(ctx context.Context, opt ports.ListOptions) ([]*ports.User, error) {
	q := r.getQ(ctx)
	items, err := q.ListUsers(ctx, db.ListUsersParams{
		Limit:  opt.Limit,
		Offset: opt.Offset,
	})
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	out := make([]*ports.User, 0, len(items))
	for _, it := range items {
		u := it
		out = append(out, mapSQLCUser(u))
	}
	return out, nil
}

func (r *usersRepositorySQL) Create(ctx context.Context, u *ports.User) error {
	q := r.getQ(ctx)
	name := sqlcStringPtr(u.Name)
	pw := sqlcStringPtr(u.PasswordHash)
	row, err := q.InsertUser(ctx, db.InsertUserParams{
		Email:        u.Email,
		Name:         name,
		PasswordHash: pw,
		Role:         u.Role,
	})
	if err != nil {
		return appErr.MapDBError(err)
	}
	// update passed-in struct with generated fields
	out := mapSQLCUser(row)
	*u = *out
	return nil
}

// NewUsersRepositorySQL constructs a UsersRepository backed by the provided base Queries.
// The queries will be swapped to a tx-bound instance when used inside UnitOfWork.Do via context.
func NewUsersRepositorySQL(base *db.Queries, logger Logger) ports.UsersRepository {
	if logger == nil {
		logger = stdLogger{}
	}
	return &usersRepositorySQL{
		base:   base,
		logger: logger,
	}
}

// stdLogger is a no-op/basic logger fallback to avoid extra deps.
type stdLogger struct{}

func (stdLogger) Printf(format string, v ...any) {
	log.Printf(format, v...)
}

// mapping helpers

func mapSQLCUser(u db.User) *ports.User {
	return &ports.User{
		ID:           u.ID.String(),
		Email:        u.Email,
		Name:         goStringPtr(u.Name),
		PasswordHash: goStringPtr(u.PasswordHash),
		Role:         u.Role,
		CreatedAt:    u.CreatedAt.Time,
		UpdatedAt:    u.UpdatedAt.Time,
	}
}

// sqlc uses pointers for nullable text; keep helpers minimal and local.

func sqlcStringPtr(p *string) *string {
	if p == nil {
		return nil
	}
	if *p == "" {
		// allow empty string explicitly if needed; no change
	}
	return p
}

func goStringPtr(p *string) *string {
	if p == nil {
		return nil
	}
	s := *p
	return &s
}

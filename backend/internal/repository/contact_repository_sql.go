package repository

import (
	"context"
	"time"

	dal "github.com/7-solutions/saas-platformbackend/internal/database"
	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
	"github.com/7-solutions/saas-platformbackend/internal/ports"
	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// contactRepositorySQL implements ports.ContactRepository using sqlc.
type contactRepositorySQL struct {
	base   *db.Queries
	logger Logger
}

// ensure interface compliance
var _ ports.ContactRepository = (*contactRepositorySQL)(nil)

// getQ returns tx-bound Queries from context when available, otherwise the base queries.
func (r *contactRepositorySQL) getQ(ctx context.Context) *db.Queries {
	if q := dal.QueriesFromContext(ctx); q != nil {
		return q
	}
	return r.base
}

type ContactListOptions struct {
	Limit     int32
	Offset    int32
	StartTime *time.Time
	EndTime   *time.Time
	Email     *string
	Status    *ports.ContactStatus
}

func (r *contactRepositorySQL) CreateSubmission(ctx context.Context, s *ports.ContactSubmission) (*ports.ContactSubmission, error) {
	q := r.getQ(ctx)
	var col5 any
	if s.Status != "" {
		// generated field name is Column5 in InsertContactParams
		col5 = string(s.Status)
	}
	row, err := q.InsertContact(ctx, db.InsertContactParams{
		Email:   s.Email,
		Name:    s.Name,
		Subject: s.Subject,
		Message: s.Message,
		Column5: col5,
	})
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	out := mapSQLCContact(row)
	return out, nil
}

func (r *contactRepositorySQL) GetSubmission(ctx context.Context, id string) (*ports.ContactSubmission, error) {
	q := r.getQ(ctx)

	u := parseUUIDToPgtype(id)

	row, err := q.GetContactByID(ctx, u)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, appErr.ErrNotFound
		}
		return nil, appErr.MapDBError(err)
	}

	out := mapSQLCContact(row)
	return out, nil
}

func (r *contactRepositorySQL) UpdateSubmission(ctx context.Context, s *ports.ContactSubmission) (*ports.ContactSubmission, error) {
	// Only UpdateContactStatus exists; update status by ID.
	q := r.getQ(ctx)

	id := parseUUIDToPgtype(s.ID)

	row, err := q.UpdateContactStatus(ctx, db.UpdateContactStatusParams{
		ID:     id,
		Status: string(s.Status),
	})
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	out := mapSQLCContact(row)
	return out, nil
}

func (r *contactRepositorySQL) DeleteSubmission(ctx context.Context, id string) error {
	q := r.getQ(ctx)

	u := parseUUIDToPgtype(id)

	affected, err := q.DeleteContactByID(ctx, u)
	if err != nil {
		return appErr.MapDBError(err)
	}
	if affected == 0 {
		return appErr.ErrNotFound
	}
	return nil
}

func (r *contactRepositorySQL) ListSubmissions(ctx context.Context, opt ports.ListOptions) ([]*ports.ContactSubmission, *ports.PaginationInfo, error) {
	q := r.getQ(ctx)
	// Broad time range using SQL NOW() bounds.
	start := time.Unix(0, 0).UTC()
	end := time.Now().UTC()

	var startTS, endTS pgtype.Timestamptz
	_ = startTS.Scan(start)
	_ = endTS.Scan(end)

	items, err := q.ListContactsByCreatedAt(ctx, db.ListContactsByCreatedAtParams{
		CreatedAt:   startTS,
		CreatedAt_2: endTS,
		Limit:       opt.Limit,
		Offset:      opt.Offset,
	})
	if err != nil {
		return nil, nil, appErr.MapDBError(err)
	}
	out := make([]*ports.ContactSubmission, 0, len(items))
	for _, it := range items {
		c := it
		out = append(out, mapSQLCContact(c))
	}
	p := &ports.PaginationInfo{
		Limit:  opt.Limit,
		Offset: opt.Offset,
	}
	return out, p, nil
}

func (r *contactRepositorySQL) ListByStatus(ctx context.Context, status ports.ContactStatus) ([]*ports.ContactSubmission, error) {
	q := r.getQ(ctx)
	items, err := q.ListContactsByStatus(ctx, db.ListContactsByStatusParams{
		Status: string(status),
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	out := make([]*ports.ContactSubmission, 0, len(items))
	for _, it := range items {
		c := it
		out = append(out, mapSQLCContact(c))
	}
	return out, nil
}

func (r *contactRepositorySQL) CountByStatus(ctx context.Context, status ports.ContactStatus) (int64, error) {
	q := r.getQ(ctx)
	row, err := q.CountContactsByStatus(ctx, string(status))
	if err != nil {
		return 0, appErr.MapDBError(err)
	}
	return row, nil
}

func (r *contactRepositorySQL) Search(ctx context.Context, query string, opt ports.ListOptions) ([]*ports.ContactSubmission, error) {
	q := r.getQ(ctx)
	items, err := q.SearchContacts(ctx, db.SearchContactsParams{
		ToTsquery: query,
		Limit:     opt.Limit,
		Offset:    opt.Offset,
	})
	if err != nil {
		return nil, appErr.MapDBError(err)
	}
	out := make([]*ports.ContactSubmission, 0, len(items))
	for _, it := range items {
		c := it
		out = append(out, mapSQLCContact(c))
	}
	return out, nil
}

// NewContactRepositorySQL constructs a ContactRepository backed by sqlc queries.
func NewContactRepositorySQL(base *db.Queries, logger Logger) ports.ContactRepository {
	if logger == nil {
		logger = stdLogger{}
	}
	return &contactRepositorySQL{
		base:   base,
		logger: logger,
	}
}

// helpers

func mapSQLCContact(c db.ContactSubmission) *ports.ContactSubmission {
	return &ports.ContactSubmission{
		ID:        c.ID.String(),
		Email:     c.Email,
		Name:      goStringPtr(c.Name),
		Subject:   goStringPtr(c.Subject),
		Message:   c.Message,
		Status:    ports.ContactStatus(c.Status),
		CreatedAt: c.CreatedAt.Time,
		UpdatedAt: c.UpdatedAt.Time,
	}
}

// parseUUID relies on sqlc's UUID type stringer/parser.
// We can defer exact behavior to sqlc/pgx types; for now, accept string and panic-free parse.
func parseUUIDToPgtype(id string) pgtype.UUID {
	var u pgtype.UUID
	// pgtype.UUID has Parse method to parse string UUID.
	_ = u.Scan(id)
	return u
}

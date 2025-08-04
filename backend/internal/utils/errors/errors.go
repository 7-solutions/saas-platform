package errors

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgconn"
)

// Sentinel errors
var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("conflict")

// MapDBError normalizes driver/sqlc errors to sentinel errors used by ports/adapters.
// - pgx.ErrNoRows -> ErrNotFound
// - unique_violation (23505) -> ErrConflict
// Fallback: return original error.
func MapDBError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return ErrConflict
		}
	}
	return err
}
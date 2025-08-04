package repository

import (
	// Keep imports minimal; db and ports are only for types in signatures
	db "github.com/7-solutions/saas-platformbackend/internal/database/sqlc"
	ports "github.com/7-solutions/saas-platformbackend/internal/ports"
)

// NewUsersRepoSQL returns a SQL-backed UsersRepository using sqlc queries.
// It delegates to repository.NewUsersRepositorySQL.
// TODO(adopt): Wire this in cmd/api or internal/server during initialization alongside pgx pool and sqlc.
func NewUsersRepoSQL(q *db.Queries, logger Logger) ports.UsersRepository {
	return NewUsersRepositorySQL(q, logger)
}

// NewContactRepoSQL returns a SQL-backed ContactRepository using sqlc queries.
// It delegates to repository.NewContactRepositorySQL.
// TODO(adopt): Wire this in cmd/api or internal/server during initialization alongside pgx pool and sqlc.
func NewContactRepoSQL(q *db.Queries, logger Logger) ports.ContactRepository {
	return NewContactRepositorySQL(q, logger)
}

/*
Example wiring order (pseudo, for reference):

// 1) Pool (existing in config/startup)
pool := existingPGXPool

// 2) sqlc queries
q := database.NewSQLCQueriesFromPool(pool)

// 3) repositories
usersRepo := repository.NewUsersRepoSQL(q, appLogger)
contactRepo := repository.NewContactRepoSQL(q, appLogger)

// 4) unit of work
uow := database.NewSQLUnitOfWorkFromPool(pool, q, stdLogger{}) // or package logger compatible with database.Logger

// 5) content service (see services factory)
contentSvc := services.NewContentServiceFactoryWithPorts(pageRepo, blogRepo, usersRepo, contactRepo, uow)
*/

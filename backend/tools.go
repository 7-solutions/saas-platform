//go:build tools
// +build tools

// This file ensures tool/driver deps are kept in go.mod without direct code usage.

package backend

import (
	_ "github.com/jackc/pgx/v5/pgxpool"
)
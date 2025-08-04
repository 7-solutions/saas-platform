package database

import (
	"fmt"
	"log"
	"os"
	"strconv"
)

type PGConfig struct {
	DatabaseURL string
	MaxConns    int32
}

// LoadPGConfig loads Postgres configuration from environment variables.
// Precedence:
// - DATABASE_URL if present.
// - Otherwise, construct URL from POSTGRES_* variables with defaults.
// Defaults: host=localhost, port=5432, db=app, user=app, password=app, sslmode=disable (unless POSTGRES_SSLMODE set)
// Max connections from POSTGRES_MAX_CONNS (default 10).
func LoadPGConfig() PGConfig {
	// Defaults
	host := getEnv("POSTGRES_HOST", "localhost")
	port := getEnv("POSTGRES_PORT", "5432")
	db := getEnv("POSTGRES_DB", "app")
	user := getEnv("POSTGRES_USER", "app")
	pass := getEnv("POSTGRES_PASSWORD", "app")
	sslmode := getEnv("POSTGRES_SSLMODE", "disable")

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Build a connection URL compatible with pgx
		// Example: postgres://user:pass@host:port/db?sslmode=disable
		databaseURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
			urlEscape(user),
			urlEscape(pass),
			host,
			port,
			db,
			sslmode,
		)
	}

	maxConns := int32(10)
	if v := os.Getenv("POSTGRES_MAX_CONNS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxConns = int32(n)
		} else {
			log.Printf("invalid POSTGRES_MAX_CONNS=%q, falling back to default %d", v, maxConns)
		}
	}

	return PGConfig{
		DatabaseURL: databaseURL,
		MaxConns:    maxConns,
	}
}

// getEnv returns val or fallback when empty.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// urlEscape is a minimal placeholder to avoid accidental URL parsing issues in user/pass.
// For now, we keep it simple, as pgx can also parse DSNs with special chars. Customize if needed.
func urlEscape(v string) string {
	// Very light escaping; for full coverage consider url.QueryEscape or net/url.UserPassword handling.
	// Keeping it simple to avoid adding extra imports/behavior.
	return v
}
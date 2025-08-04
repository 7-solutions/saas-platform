package gateway

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"shared/go-logger"
)

type Config struct {
	AllowOrigins []string
	AllowHeaders []string
}

func NewMux(cfg Config, register func(ctx context.Context, mux *http.ServeMux) error) *http.ServeMux {
	log := logger.L()
	mux := http.NewServeMux()

	// placeholder register for future grpc-gateway handlers
	if register != nil {
		if err := register(context.Background(), mux); err != nil {
			log.Error("gateway register failed", "err", err)
		}
	}

	// CORS wrapper
	return withCORS(cfg, mux)
}

func withCORS(cfg Config, next *http.ServeMux) *http.ServeMux {
	wrap := http.NewServeMux()
	origins := cfg.AllowOrigins
	if len(origins) == 0 {
		if v := os.Getenv("CORS_ALLOW_ORIGINS"); v != "" {
			origins = strings.Split(v, ",")
		} else {
			origins = []string{"*"}
		}
	}
	allowHeaders := cfg.AllowHeaders
	if len(allowHeaders) == 0 {
		allowHeaders = []string{"Authorization", "Content-Type", "X-Request-ID"}
	}

	wrap.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" && len(origins) > 0 {
			origin = origins[0]
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Headers", strings.Join(allowHeaders, ", "))
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})

	return wrap
}

// Helper to add simple timeout middleware around a handler.
func WithTimeout(h http.Handler, d time.Duration) http.Handler {
	return http.TimeoutHandler(h, d, "request timeout")
}
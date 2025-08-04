package logger

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"time"
)

var (
	once   sync.Once
	global *slog.Logger
)

type ctxKey string

const (
	ctxRequestID ctxKey = "req_id"
	ctxUserID    ctxKey = "user_id"
	ctxRole      ctxKey = "role"
)

// Init initializes the global structured logger.
// level: "debug" | "info" | "warn" | "error"
// format: "json" | "text"
func Init(level, format string) {
	once.Do(func() {
		var lvl slog.Level
		switch level {
		case "debug":
			lvl = slog.LevelDebug
		case "warn":
			lvl = slog.LevelWarn
		case "error":
			lvl = slog.LevelError
		default:
			lvl = slog.LevelInfo
		}

		var handler slog.Handler
		opts := &slog.HandlerOptions{Level: lvl, AddSource: false, ReplaceAttr: redact}
		switch format {
		case "text":
			handler = slog.NewTextHandler(os.Stdout, opts)
		default:
			handler = slog.NewJSONHandler(os.Stdout, opts)
		}

		global = slog.New(handler).With(
			slog.String("svc", serviceName()),
			slog.Time("ts", time.Now()),
		)
	})
}

func serviceName() string {
	if v := os.Getenv("SERVICE_NAME"); v != "" {
		return v
	}
	return "unknown"
}

func redact(_ []string, a slog.Attr) slog.Attr {
	// potential place to scrub secrets in future
	return a
}

// L returns the global logger. Init() should be called once at startup.
func L() *slog.Logger {
	if global == nil {
		Init("info", "json")
	}
	return global
}

// WithContext enriches context with request-scoped fields.
func WithContext(ctx context.Context, reqID, userID, role string) context.Context {
	if reqID != "" {
		ctx = context.WithValue(ctx, ctxRequestID, reqID)
	}
	if userID != "" {
		ctx = context.WithValue(ctx, ctxUserID, userID)
	}
	if role != "" {
		ctx = context.WithValue(ctx, ctxRole, role)
	}
	return ctx
}

// FromContext returns a logger annotated with common context fields if present.
func FromContext(ctx context.Context) *slog.Logger {
	l := L()
	if ctx == nil {
		return l
	}
	attrs := []any{}
	if v := ctx.Value(ctxRequestID); v != nil {
		attrs = append(attrs, slog.String("req_id", v.(string)))
	}
	if v := ctx.Value(ctxUserID); v != nil {
		attrs = append(attrs, slog.String("user_id", v.(string)))
	}
	if v := ctx.Value(ctxRole); v != nil {
		attrs = append(attrs, slog.String("role", v.(string)))
	}
	if len(attrs) > 0 {
		return l.With(attrs...)
	}
	return l
}
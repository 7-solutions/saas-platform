package logger

import (
	"context"
	"log"
	"os"
	"sync"
	"time"
)

// Note: This package already defines a concrete Logger type in logger.go.
// To avoid name collisions, we avoid declaring another Logger interface here
// and instead expose a separate adapter type with similar semantics.

// ZapLogger is a minimal zap-like wrapper that falls back to stdlib log.
// It preserves structured fields by merging base fields with call-time fields.
// TODO: Wire zap.Logger or slog as needed behind this adapter.
type ZapLogger struct {
	base   map[string]any
	stdlog *log.Logger
	mu     sync.Mutex
}

// NewZapLogger constructs a new logger with a stdlib fallback.
func NewZapLogger() *ZapLogger {
	return &ZapLogger{
		base:   map[string]any{},
		stdlog: log.New(os.Stdout, "", log.LstdFlags|log.Lmicroseconds|log.LUTC),
	}
}

// With returns a new ZapLogger carrying merged fields.
func (z *ZapLogger) With(fields map[string]any) *ZapLogger {
	z.mu.Lock()
	defer z.mu.Unlock()

	next := &ZapLogger{
		base:   make(map[string]any, len(z.base)+len(fields)),
		stdlog: z.stdlog,
	}
	for k, v := range z.base {
		next.base[k] = v
	}
	for k, v := range fields {
		next.base[k] = v
	}
	return next
}

func (z *ZapLogger) Info(ctx context.Context, msg string, fields map[string]any) {
	z.log(ctx, "INFO", msg, nil, fields)
}

func (z *ZapLogger) Warn(ctx context.Context, msg string, fields map[string]any) {
	z.log(ctx, "WARN", msg, nil, fields)
}

func (z *ZapLogger) Error(ctx context.Context, msg string, err error, fields map[string]any) {
	z.log(ctx, "ERROR", msg, err, fields)
}

// log formats a simple structured line. Keep output minimal to avoid heavy logging.
func (z *ZapLogger) log(ctx context.Context, level, msg string, err error, fields map[string]any) {
	if ctx != nil {
		select {
		case <-ctx.Done():
			// Respect cancellation; avoid logging if context is canceled.
			return
		default:
		}
	}

	merged := make(map[string]any, len(z.base)+len(fields)+3)
	for k, v := range z.base {
		merged[k] = v
	}
	for k, v := range fields {
		merged[k] = v
	}

	merged["level"] = level
	merged["msg"] = msg
	merged["ts"] = time.Now().UTC().Format(time.RFC3339Nano)
	if err != nil {
		merged["error"] = err.Error()
	}

	// Render in key=value pairs, stable but simple.
	out := make([]any, 0, len(merged)*2)
	for k, v := range merged {
		out = append(out, k+"=", v, " ")
	}
	z.stdlog.Print(out...)
}
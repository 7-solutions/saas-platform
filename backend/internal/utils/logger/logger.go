package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"time"
)

// LogLevel represents the severity of a log entry
type LogLevel string

const (
	LevelDebug LogLevel = "DEBUG"
	LevelInfo  LogLevel = "INFO"
	LevelWarn  LogLevel = "WARN"
	LevelError LogLevel = "ERROR"
	LevelFatal LogLevel = "FATAL"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       LogLevel               `json:"level"`
	Message     string                 `json:"message"`
	Service     string                 `json:"service"`
	Method      string                 `json:"method,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	RequestID   string                 `json:"request_id,omitempty"`
	Duration    *time.Duration         `json:"duration,omitempty"`
	Error       *ErrorDetails          `json:"error,omitempty"`
	Fields      map[string]interface{} `json:"fields,omitempty"`
	StackTrace  string                 `json:"stack_trace,omitempty"`
	File        string                 `json:"file,omitempty"`
	Line        int                    `json:"line,omitempty"`
}

// ErrorDetails contains detailed error information
type ErrorDetails struct {
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message"`
	Stack   string `json:"stack,omitempty"`
}

// Logger provides structured logging functionality
type Logger struct {
	slogger *slog.Logger
	service string
}

// Config holds logger configuration
type Config struct {
	Service string
	Level   LogLevel
	Format  string // "json" or "text"
	Output  string // "stdout", "stderr", or file path
}

// NewLogger creates a new structured logger
func NewLogger(config Config) *Logger {
	var level slog.Level
	switch config.Level {
	case LevelDebug:
		level = slog.LevelDebug
	case LevelInfo:
		level = slog.LevelInfo
	case LevelWarn:
		level = slog.LevelWarn
	case LevelError:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: level,
		AddSource: true,
	}

	var handler slog.Handler
	if config.Format == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return &Logger{
		slogger: slog.New(handler),
		service: config.Service,
	}
}

// WithContext returns a logger with context values
func (l *Logger) WithContext(ctx context.Context) *Logger {
	return &Logger{
		slogger: l.slogger.With(l.extractContextFields(ctx)...),
		service: l.service,
	}
}

// WithFields returns a logger with additional fields
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	args := make([]interface{}, 0, len(fields)*2)
	for k, v := range fields {
		args = append(args, k, v)
	}
	
	return &Logger{
		slogger: l.slogger.With(args...),
		service: l.service,
	}
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, fields ...interface{}) {
	l.log(LevelDebug, msg, nil, fields...)
}

// Info logs an info message
func (l *Logger) Info(msg string, fields ...interface{}) {
	l.log(LevelInfo, msg, nil, fields...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, fields ...interface{}) {
	l.log(LevelWarn, msg, nil, fields...)
}

// Error logs an error message
func (l *Logger) Error(msg string, err error, fields ...interface{}) {
	l.log(LevelError, msg, err, fields...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, err error, fields ...interface{}) {
	l.log(LevelFatal, msg, err, fields...)
	os.Exit(1)
}

// LogRequest logs an HTTP/gRPC request
func (l *Logger) LogRequest(ctx context.Context, method, path string, duration time.Duration, statusCode int, err error) {
	level := LevelInfo
	if err != nil || statusCode >= 500 {
		level = LevelError
	} else if statusCode >= 400 {
		level = LevelWarn
	}

	fields := []interface{}{
		"method", method,
		"path", path,
		"duration_ms", duration.Milliseconds(),
		"status_code", statusCode,
	}

	if userID := l.getUserIDFromContext(ctx); userID != "" {
		fields = append(fields, "user_id", userID)
	}

	if requestID := l.getRequestIDFromContext(ctx); requestID != "" {
		fields = append(fields, "request_id", requestID)
	}

	msg := fmt.Sprintf("%s %s - %d", method, path, statusCode)
	l.log(level, msg, err, fields...)
}

// LogError logs a detailed error with stack trace
func (l *Logger) LogError(ctx context.Context, err error, msg string, fields ...interface{}) {
	if err == nil {
		return
	}

	// Add stack trace for errors
	stack := l.getStackTrace(2) // Skip this function and the caller
	
	allFields := append(fields, "stack_trace", stack)
	
	if userID := l.getUserIDFromContext(ctx); userID != "" {
		allFields = append(allFields, "user_id", userID)
	}

	if requestID := l.getRequestIDFromContext(ctx); requestID != "" {
		allFields = append(allFields, "request_id", requestID)
	}

	l.log(LevelError, msg, err, allFields...)
}

// LogPanic logs a panic with full stack trace
func (l *Logger) LogPanic(ctx context.Context, recovered interface{}, msg string) {
	stack := l.getStackTrace(2)
	
	fields := []interface{}{
		"panic_value", recovered,
		"stack_trace", stack,
	}

	if userID := l.getUserIDFromContext(ctx); userID != "" {
		fields = append(fields, "user_id", userID)
	}

	if requestID := l.getRequestIDFromContext(ctx); requestID != "" {
		fields = append(fields, "request_id", requestID)
	}

	l.log(LevelFatal, msg, nil, fields...)
}

// log is the internal logging method
func (l *Logger) log(level LogLevel, msg string, err error, fields ...interface{}) {
	// Add service name
	allFields := append([]interface{}{"service", l.service}, fields...)
	
	// Add error details if present
	if err != nil {
		allFields = append(allFields, "error", err.Error())
	}

	// Convert to slog level and log
	var slogLevel slog.Level
	switch level {
	case LevelDebug:
		slogLevel = slog.LevelDebug
	case LevelInfo:
		slogLevel = slog.LevelInfo
	case LevelWarn:
		slogLevel = slog.LevelWarn
	case LevelError, LevelFatal:
		slogLevel = slog.LevelError
	}

	l.slogger.Log(context.Background(), slogLevel, msg, allFields...)
}

// extractContextFields extracts logging fields from context
func (l *Logger) extractContextFields(ctx context.Context) []interface{} {
	var fields []interface{}

	if userID := l.getUserIDFromContext(ctx); userID != "" {
		fields = append(fields, "user_id", userID)
	}

	if requestID := l.getRequestIDFromContext(ctx); requestID != "" {
		fields = append(fields, "request_id", requestID)
	}

	return fields
}

// getUserIDFromContext extracts user ID from context
func (l *Logger) getUserIDFromContext(ctx context.Context) string {
	if userID, ok := ctx.Value("user_id").(string); ok {
		return userID
	}
	return ""
}

// getRequestIDFromContext extracts request ID from context
func (l *Logger) getRequestIDFromContext(ctx context.Context) string {
	if requestID, ok := ctx.Value("request_id").(string); ok {
		return requestID
	}
	return ""
}

// getStackTrace returns a formatted stack trace
func (l *Logger) getStackTrace(skip int) string {
	const depth = 32
	var pcs [depth]uintptr
	n := runtime.Callers(skip+1, pcs[:])
	
	frames := runtime.CallersFrames(pcs[:n])
	var stack []string
	
	for {
		frame, more := frames.Next()
		stack = append(stack, fmt.Sprintf("%s:%d %s", frame.File, frame.Line, frame.Function))
		if !more {
			break
		}
	}
	
	stackBytes, _ := json.Marshal(stack)
	return string(stackBytes)
}

// Global logger instance
var globalLogger *Logger

// InitGlobalLogger initializes the global logger
func InitGlobalLogger(config Config) {
	globalLogger = NewLogger(config)
}

// GetGlobalLogger returns the global logger instance
func GetGlobalLogger() *Logger {
	if globalLogger == nil {
		globalLogger = NewLogger(Config{
			Service: "unknown",
			Level:   LevelInfo,
			Format:  "json",
		})
	}
	return globalLogger
}

// Convenience functions using global logger
func Debug(msg string, fields ...interface{}) {
	GetGlobalLogger().Debug(msg, fields...)
}

func Info(msg string, fields ...interface{}) {
	GetGlobalLogger().Info(msg, fields...)
}

func Warn(msg string, fields ...interface{}) {
	GetGlobalLogger().Warn(msg, fields...)
}

func Error(msg string, err error, fields ...interface{}) {
	GetGlobalLogger().Error(msg, err, fields...)
}

func Fatal(msg string, err error, fields ...interface{}) {
	GetGlobalLogger().Fatal(msg, err, fields...)
}

func LogRequest(ctx context.Context, method, path string, duration time.Duration, statusCode int, err error) {
	GetGlobalLogger().LogRequest(ctx, method, path, duration, statusCode, err)
}

func LogError(ctx context.Context, err error, msg string, fields ...interface{}) {
	GetGlobalLogger().LogError(ctx, err, msg, fields...)
}

func LogPanic(ctx context.Context, recovered interface{}, msg string) {
	GetGlobalLogger().LogPanic(ctx, recovered, msg)
}
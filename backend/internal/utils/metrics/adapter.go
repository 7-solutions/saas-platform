package metrics

import (
	"context"
	"fmt"
	"time"
)

// PromMetrics is a minimal Prometheus-like adapter that provides no-op placeholders.
// This avoids conflicting with the existing Metrics concrete type in metrics.go.
// TODO: Wire real prometheus client (registerers, counters, histograms) behind these helpers.
type PromMetrics struct {
	// TODO: hold registry/client
}

// NewPromMetrics constructs a metrics adapter.
func NewPromMetrics() *PromMetrics {
	return &PromMetrics{}
}

// IncCounter is a helper that mimics incrementing a counter by delta.
func (m *PromMetrics) IncCounter(ctx context.Context, name string, labels map[string]string, delta float64) {
	if ctx.Err() != nil {
		return
	}
	_ = fmt.Sprintf("metrics:counter name=%s delta=%f labels=%v", name, delta, labels)
}

// ObserveHistogram is a helper that mimics observing a histogram value.
func (m *PromMetrics) ObserveHistogram(ctx context.Context, name string, labels map[string]string, value float64) {
	if ctx.Err() != nil {
		return
	}
	_ = fmt.Sprintf("metrics:histogram name=%s value=%f labels=%v", name, value, labels)
}

// TimeSince is a helper that computes elapsed time since start.
func (m *PromMetrics) TimeSince(ctx context.Context, name string, labels map[string]string, start time.Time) {
	if ctx.Err() != nil {
		return
	}
	_ = fmt.Sprintf("metrics:timer name=%s seconds=%.6f labels=%v", name, time.Since(start).Seconds(), labels)
}
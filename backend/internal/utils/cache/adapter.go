package cache

import (
	"context"
	"sync"
	"time"
)

// TODO: Move this interface to backend/internal/ports when canonical ports are added.
type Cache interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// redisEntry holds value and expiry for in-memory fallback.
type redisEntry struct {
	val    string
	expiry time.Time // zero = no expiry
}

// RedisCache is a Redis-like adapter with in-memory fallback.
// TODO: Wire real Redis client in place of the map.
type RedisCache struct {
	mu     sync.RWMutex
	store  map[string]redisEntry
	// TODO: client any // placeholder for redis client
}

// NewRedisCache constructs the adapter with an in-memory map fallback.
func NewRedisCache() *RedisCache {
	return &RedisCache{
		store: make(map[string]redisEntry),
	}
}

// Get returns a value if present and not expired.
func (r *RedisCache) Get(ctx context.Context, key string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	e, ok := r.store[key]
	if !ok {
		return "", nil
	}
	if !e.expiry.IsZero() && time.Now().After(e.expiry) {
		// Treat expired as not found
		return "", nil
	}
	return e.val, nil
}

// Set stores a value with TTL (0 = no expiry).
func (r *RedisCache) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	r.mu.Lock()
	r.store[key] = redisEntry{val: value, expiry: exp}
	r.mu.Unlock()
	return nil
}

// Delete removes a key.
func (r *RedisCache) Delete(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.store, key)
	r.mu.Unlock()
	return nil
}
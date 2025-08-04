package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	appErr "github.com/7-solutions/saas-platformbackend/internal/utils/errors"
)

// TODO: Move this interface to backend/internal/ports when canonical ports are added.
type AuthTokenVerifier interface {
	Verify(ctx context.Context, token string) (*SimpleClaims, error)
}

// Claims represents a minimal set of JWT claims returned after verification.
type SimpleClaims struct {
	Subject string                 `json:"sub,omitempty"`
	Issuer  string                 `json:"iss,omitempty"`
	Expiry  int64                  `json:"exp,omitempty"`
	Extra   map[string]interface{} `json:"extra,omitempty"`
}

// JWTVerifier is a minimal JWT/JWK-based verifier placeholder.
// TODO: Wire real JWKS fetch/cache and signature verification.
type JWTVerifier struct {
	jwksURL     string
	cacheTTL    time.Duration
	lastFetchAt time.Time
	// TODO: keySet any // placeholder for a JWK set
}

// NewJWTVerifier constructs a verifier with jwksURL and an in-memory cache duration.
func NewJWTVerifier(jwksURL string, cacheTTL time.Duration) *JWTVerifier {
	if cacheTTL == 0 {
		cacheTTL = 5 * time.Minute
	}
	return &JWTVerifier{
		jwksURL:  jwksURL,
		cacheTTL: cacheTTL,
	}
}

// Verify parses the JWT header/payload and returns placeholder claims.
// TODO: Validate signature using JWKs from jwksURL; map errors to normalized sentinels.
func (v *JWTVerifier) Verify(ctx context.Context, token string) (*SimpleClaims, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if token == "" {
		return nil, appErr.ErrNotFound
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		// Malformed token
		return nil, appErr.ErrConflict
	}

	// Decode header and payload (base64url without padding).
	_, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("jwt: header decode: %w", err)
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("jwt: payload decode: %w", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("jwt: payload json: %w", err)
	}

	// Extract common claims
	claims := &SimpleClaims{
		Extra: map[string]interface{}{},
	}
	if sub, _ := payload["sub"].(string); sub != "" {
		claims.Subject = sub
	}
	if iss, _ := payload["iss"].(string); iss != "" {
		claims.Issuer = iss
	}
	switch exp := payload["exp"].(type) {
	case float64:
		claims.Expiry = int64(exp)
	case int64:
		claims.Expiry = exp
	case json.Number:
		if n, err := exp.Int64(); err == nil {
			claims.Expiry = n
		}
	}

	// Copy remaining payload into Extra
	for k, v := range payload {
		if k == "sub" || k == "iss" || k == "exp" {
			continue
		}
		claims.Extra[k] = v
	}

	// TODO: Perform signature verification against JWKs.
	// If key not found -> appErr.ErrNotFound
	// If signature invalid / alg mismatch -> appErr.ErrConflict
	_ = v.jwksURL

	// Placeholder: simulate expired token mapping
	if claims.Expiry > 0 && time.Unix(claims.Expiry, 0).Before(time.Now()) {
		return nil, appErr.ErrConflict
	}

	// Placeholder: if subject is missing, treat as not found
	if claims.Subject == "" {
		return nil, appErr.ErrNotFound
	}

	// Simulate network-bound JWKS refresh respecting ctx (not implemented).
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	return claims, nil
}

// helper to map generic errors to normalized ones; currently unused but kept for clarity.
func mapVerifyError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	// Default fallback
	return err
}

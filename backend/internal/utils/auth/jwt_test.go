package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestGenerateToken(t *testing.T) {
	tests := []struct {
		name     string
		userID   string
		email    string
		role     string
		username string
		wantErr  bool
	}{
		{
			name:     "valid token generation",
			userID:   "user:test@example.com",
			email:    "test@example.com",
			role:     "admin",
			username: "Test User",
			wantErr:  false,
		},
		{
			name:     "empty userID",
			userID:   "",
			email:    "test@example.com",
			role:     "admin",
			username: "Test User",
			wantErr:  false, // Should still work
		},
		{
			name:     "empty email",
			userID:   "user:test@example.com",
			email:    "",
			role:     "admin",
			username: "Test User",
			wantErr:  false, // Should still work
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := GenerateToken(tt.userID, tt.email, tt.role, tt.username)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, token)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, token)

				// Verify token can be parsed
				claims, err := ValidateToken(token)
				assert.NoError(t, err)
				assert.Equal(t, tt.userID, claims.UserID)
				assert.Equal(t, tt.email, claims.Email)
				assert.Equal(t, tt.role, claims.Role)
				assert.Equal(t, tt.username, claims.Username)
			}
		})
	}
}

func TestValidateToken(t *testing.T) {
	// Generate a valid token for testing
	validToken, err := GenerateToken("user:test@example.com", "test@example.com", "admin", "Test User")
	assert.NoError(t, err)

	// Create an expired token
	expiredClaims := &Claims{
		UserID:   "user:test@example.com",
		Email:    "test@example.com",
		Role:     "admin",
		Username: "Test User",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Subject:   "user:test@example.com",
		},
	}
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	expiredTokenString, err := expiredToken.SignedString(JWTSecret)
	assert.NoError(t, err)

	tests := []struct {
		name      string
		token     string
		wantErr   bool
		wantClaim bool
	}{
		{
			name:      "valid token",
			token:     validToken,
			wantErr:   false,
			wantClaim: true,
		},
		{
			name:      "empty token",
			token:     "",
			wantErr:   true,
			wantClaim: false,
		},
		{
			name:      "invalid token format",
			token:     "invalid-token",
			wantErr:   true,
			wantClaim: false,
		},
		{
			name:      "expired token",
			token:     expiredTokenString,
			wantErr:   true,
			wantClaim: false,
		},
		{
			name:      "token with wrong signature",
			token:     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
			wantErr:   true,
			wantClaim: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := ValidateToken(tt.token)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, claims)
			} else {
				assert.NoError(t, err)
				if tt.wantClaim {
					assert.NotNil(t, claims)
					assert.Equal(t, "user:test@example.com", claims.UserID)
					assert.Equal(t, "test@example.com", claims.Email)
					assert.Equal(t, "admin", claims.Role)
					assert.Equal(t, "Test User", claims.Username)
				}
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	// Create initial claims
	originalClaims := &Claims{
		UserID:   "user:test@example.com",
		Email:    "test@example.com",
		Role:     "admin",
		Username: "Test User",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-30 * time.Minute)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			Subject:   "user:test@example.com",
		},
	}

	tests := []struct {
		name    string
		claims  *Claims
		wantErr bool
	}{
		{
			name:    "valid claims refresh",
			claims:  originalClaims,
			wantErr: false,
		},
		{
			name:    "nil claims",
			claims:  nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.claims == nil {
				// This should panic or cause an error
				assert.Panics(t, func() {
					RefreshToken(tt.claims)
				})
				return
			}

			newToken, err := RefreshToken(tt.claims)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, newToken)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, newToken)

				// Verify the new token is valid and has updated timestamps
				newClaims, err := ValidateToken(newToken)
				assert.NoError(t, err)
				assert.Equal(t, tt.claims.UserID, newClaims.UserID)
				assert.Equal(t, tt.claims.Email, newClaims.Email)
				assert.Equal(t, tt.claims.Role, newClaims.Role)
				assert.Equal(t, tt.claims.Username, newClaims.Username)

				// Check that expiration is in the future
				assert.True(t, newClaims.ExpiresAt.After(time.Now()))
			}
		})
	}
}

func TestExtractTokenFromHeader(t *testing.T) {
	tests := []struct {
		name       string
		authHeader string
		wantToken  string
		wantErr    bool
	}{
		{
			name:       "valid bearer token",
			authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantToken:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantErr:    false,
		},
		{
			name:       "empty header",
			authHeader: "",
			wantToken:  "",
			wantErr:    true,
		},
		{
			name:       "missing Bearer prefix",
			authHeader: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantToken:  "",
			wantErr:    true,
		},
		{
			name:       "Bearer with no token",
			authHeader: "Bearer ",
			wantToken:  "",
			wantErr:    true,
		},
		{
			name:       "Bearer with empty token",
			authHeader: "Bearer",
			wantToken:  "",
			wantErr:    true,
		},
		{
			name:       "wrong case Bearer",
			authHeader: "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			wantToken:  "",
			wantErr:    true,
		},
		{
			name:       "Bearer with spaces in token",
			authHeader: "Bearer token with spaces",
			wantToken:  "token with spaces",
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := ExtractTokenFromHeader(tt.authHeader)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, token)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantToken, token)
			}
		})
	}
}

func TestJWTSecretFromEnv(t *testing.T) {
	// Test that JWT secret is loaded correctly
	secret := getJWTSecret()
	assert.NotEmpty(t, secret)
	assert.NotEqual(t, []byte(""), secret)
}
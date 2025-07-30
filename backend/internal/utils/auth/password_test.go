package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHashPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid password",
			password: "password123",
			wantErr:  false,
		},
		{
			name:     "empty password",
			password: "",
			wantErr:  false, // bcrypt can hash empty strings
		},
		{
			name:     "long password (within bcrypt limit)",
			password: "this-is-a-long-password-but-within-72-byte-limit-for-bcrypt-algorithm",
			wantErr:  false,
		},
		{
			name:     "password exceeding bcrypt limit",
			password: "this-is-a-very-long-password-that-exceeds-the-72-byte-limit-for-bcrypt-hashing-algorithm-and-should-fail",
			wantErr:  true,
		},
		{
			name:     "password with special characters",
			password: "p@ssw0rd!@#$%^&*()",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash, err := HashPassword(tt.password)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, hash)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, hash)
				assert.NotEqual(t, tt.password, hash) // Hash should be different from password
				assert.True(t, len(hash) > 50)        // bcrypt hashes are typically 60 characters

				// Verify the hash can be used to check the password
				assert.True(t, CheckPasswordHash(tt.password, hash))
			}
		})
	}
}

func TestCheckPasswordHash(t *testing.T) {
	// Create a known hash for testing
	password := "testpassword123"
	hash, err := HashPassword(password)
	assert.NoError(t, err)

	tests := []struct {
		name     string
		password string
		hash     string
		want     bool
	}{
		{
			name:     "correct password",
			password: password,
			hash:     hash,
			want:     true,
		},
		{
			name:     "incorrect password",
			password: "wrongpassword",
			hash:     hash,
			want:     false,
		},
		{
			name:     "empty password",
			password: "",
			hash:     hash,
			want:     false,
		},
		{
			name:     "empty hash",
			password: password,
			hash:     "",
			want:     false,
		},
		{
			name:     "invalid hash format",
			password: password,
			hash:     "invalid-hash",
			want:     false,
		},
		{
			name:     "case sensitive password",
			password: "TESTPASSWORD123",
			hash:     hash,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CheckPasswordHash(tt.password, tt.hash)
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "valid strong password",
			password: "Password123!",
			wantErr:  false,
		},
		{
			name:     "too short",
			password: "Pass1!",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters long",
		},
		{
			name:     "too long",
			password: "P@ssw0rd!" + string(make([]byte, 120)), // 129 characters
			wantErr:  true,
			errMsg:   "password must be less than 128 characters long",
		},
		{
			name:     "no uppercase",
			password: "password123!",
			wantErr:  true,
			errMsg:   "password must contain at least one uppercase letter",
		},
		{
			name:     "no lowercase",
			password: "PASSWORD123!",
			wantErr:  true,
			errMsg:   "password must contain at least one lowercase letter",
		},
		{
			name:     "no number",
			password: "Password!",
			wantErr:  true,
			errMsg:   "password must contain at least one number",
		},
		{
			name:     "no special character",
			password: "Password123",
			wantErr:  true,
			errMsg:   "password must contain at least one special character",
		},
		{
			name:     "minimum valid password",
			password: "Pass123!",
			wantErr:  false,
		},
		{
			name:     "password with symbols",
			password: "P@ssw0rd#",
			wantErr:  false,
		},
		{
			name:     "password with punctuation",
			password: "Password123.",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid email",
			email:   "user@example.com",
			wantErr: false,
		},
		{
			name:    "valid email with subdomain",
			email:   "user@mail.example.com",
			wantErr: false,
		},
		{
			name:    "valid email with plus",
			email:   "user+tag@example.com",
			wantErr: false,
		},
		{
			name:    "empty email",
			email:   "",
			wantErr: true,
			errMsg:  "email is required",
		},
		{
			name:    "email with spaces (trimmed)",
			email:   "  user@example.com  ",
			wantErr: false,
		},
		{
			name:    "too short",
			email:   "a@b",
			wantErr: true,
			errMsg:  "email domain must contain at least one dot",
		},
		{
			name:    "too long",
			email:   string(make([]byte, 250)) + "@example.com", // > 254 characters
			wantErr: true,
			errMsg:  "email is too long",
		},
		{
			name:    "no @ symbol",
			email:   "userexample.com",
			wantErr: true,
			errMsg:  "email must contain @ symbol",
		},
		{
			name:    "multiple @ symbols",
			email:   "user@@example.com",
			wantErr: true,
			errMsg:  "email must contain exactly one @ symbol",
		},
		{
			name:    "empty local part",
			email:   "@example.com",
			wantErr: true,
			errMsg:  "email local part cannot be empty",
		},
		{
			name:    "empty domain part",
			email:   "user@",
			wantErr: true,
			errMsg:  "email domain part cannot be empty",
		},
		{
			name:    "domain without dot",
			email:   "user@example",
			wantErr: true,
			errMsg:  "email domain must contain at least one dot",
		},
		{
			name:    "valid email with numbers",
			email:   "user123@example123.com",
			wantErr: false,
		},
		{
			name:    "valid email with hyphens",
			email:   "user-name@example-domain.com",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEmail(tt.email)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPasswordHashConsistency(t *testing.T) {
	password := "testpassword123"

	// Hash the same password multiple times
	hash1, err1 := HashPassword(password)
	hash2, err2 := HashPassword(password)

	assert.NoError(t, err1)
	assert.NoError(t, err2)
	assert.NotEmpty(t, hash1)
	assert.NotEmpty(t, hash2)

	// Hashes should be different (bcrypt includes salt)
	assert.NotEqual(t, hash1, hash2)

	// But both should validate the same password
	assert.True(t, CheckPasswordHash(password, hash1))
	assert.True(t, CheckPasswordHash(password, hash2))
}
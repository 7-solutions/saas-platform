package media

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFileStorage_SaveFile(t *testing.T) {
	// Setup temporary directory for testing
	tempDir, err := os.MkdirTemp("", "media_test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	config := &StorageConfig{
		UploadDir:   tempDir,
		MaxFileSize: 1024 * 1024, // 1MB
		AllowedMIME: []string{"image/png", "image/jpeg", "text/plain"},
	}

	storage := NewFileStorage(config)

	tests := []struct {
		name         string
		content      []byte
		originalName string
		mimeType     string
		expectError  bool
		errorMsg     string
	}{
		{
			name:         "successful file save",
			content:      []byte("test content"),
			originalName: "test.txt",
			mimeType:     "text/plain",
			expectError:  false,
		},
		{
			name:         "file too large",
			content:      make([]byte, 2*1024*1024), // 2MB
			originalName: "large.txt",
			mimeType:     "text/plain",
			expectError:  true,
			errorMsg:     "file size exceeds maximum",
		},
		{
			name:         "disallowed MIME type",
			content:      []byte("test content"),
			originalName: "test.pdf",
			mimeType:     "application/pdf",
			expectError:  true,
			errorMsg:     "MIME type application/pdf is not allowed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filename, url, err := storage.SaveFile(tt.content, tt.originalName, tt.mimeType)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Empty(t, filename)
				assert.Empty(t, url)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, filename)
				assert.NotEmpty(t, url)
				assert.Contains(t, url, "/uploads/")

				// Verify file was actually saved
				filePath := filepath.Join(tempDir, filename)
				savedContent, err := os.ReadFile(filePath)
				assert.NoError(t, err)
				assert.Equal(t, tt.content, savedContent)
			}
		})
	}
}

func TestFileStorage_GetFile(t *testing.T) {
	// Setup temporary directory for testing
	tempDir, err := os.MkdirTemp("", "media_test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	config := &StorageConfig{
		UploadDir:   tempDir,
		MaxFileSize: 1024 * 1024,
		AllowedMIME: []string{"text/plain"},
	}

	storage := NewFileStorage(config)

	// Create a test file
	testContent := []byte("test file content")
	testFilename := "test_file.txt"
	testFilePath := filepath.Join(tempDir, testFilename)
	err = os.WriteFile(testFilePath, testContent, 0644)
	require.NoError(t, err)

	tests := []struct {
		name        string
		filename    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "successful file retrieval",
			filename:    testFilename,
			expectError: false,
		},
		{
			name:        "file not found",
			filename:    "nonexistent.txt",
			expectError: true,
			errorMsg:    "file not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content, err := storage.GetFile(tt.filename)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, content)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, testContent, content)
			}
		})
	}
}

func TestFileStorage_DeleteFile(t *testing.T) {
	// Setup temporary directory for testing
	tempDir, err := os.MkdirTemp("", "media_test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	config := &StorageConfig{
		UploadDir:   tempDir,
		MaxFileSize: 1024 * 1024,
		AllowedMIME: []string{"text/plain"},
	}

	storage := NewFileStorage(config)

	// Create a test file
	testContent := []byte("test file content")
	testFilename := "test_file.txt"
	testFilePath := filepath.Join(tempDir, testFilename)
	err = os.WriteFile(testFilePath, testContent, 0644)
	require.NoError(t, err)

	tests := []struct {
		name        string
		filename    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "successful file deletion",
			filename:    testFilename,
			expectError: false,
		},
		{
			name:        "file not found",
			filename:    "nonexistent.txt",
			expectError: true,
			errorMsg:    "file not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := storage.DeleteFile(tt.filename)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				// Verify file was actually deleted
				_, err := os.Stat(filepath.Join(tempDir, tt.filename))
				assert.True(t, os.IsNotExist(err))
			}
		})
	}
}

func TestFileStorage_FileExists(t *testing.T) {
	// Setup temporary directory for testing
	tempDir, err := os.MkdirTemp("", "media_test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	config := &StorageConfig{
		UploadDir: tempDir,
	}

	storage := NewFileStorage(config)

	// Create a test file
	testFilename := "test_file.txt"
	testFilePath := filepath.Join(tempDir, testFilename)
	err = os.WriteFile(testFilePath, []byte("test"), 0644)
	require.NoError(t, err)

	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{
			name:     "existing file",
			filename: testFilename,
			expected: true,
		},
		{
			name:     "non-existing file",
			filename: "nonexistent.txt",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exists := storage.FileExists(tt.filename)
			assert.Equal(t, tt.expected, exists)
		})
	}
}

func TestFileStorage_generateUniqueFilename(t *testing.T) {
	config := DefaultStorageConfig()
	storage := NewFileStorage(config)

	originalName := "test.txt"
	filename1 := storage.generateUniqueFilename(originalName)
	filename2 := storage.generateUniqueFilename(originalName)

	// Filenames should be different
	assert.NotEqual(t, filename1, filename2)

	// Both should contain the original name without extension
	assert.Contains(t, filename1, "test")
	assert.Contains(t, filename2, "test")

	// Both should have the correct extension
	assert.Contains(t, filename1, ".txt")
	assert.Contains(t, filename2, ".txt")
}

func TestDefaultStorageConfig(t *testing.T) {
	config := DefaultStorageConfig()

	assert.Equal(t, "./uploads", config.UploadDir)
	assert.Equal(t, int64(10*1024*1024), config.MaxFileSize)
	assert.Contains(t, config.AllowedMIME, "image/jpeg")
	assert.Contains(t, config.AllowedMIME, "image/png")
	assert.Contains(t, config.AllowedMIME, "application/pdf")
}
package media

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// FileStorageInterface defines the interface for file storage operations
type FileStorageInterface interface {
	SaveFile(content []byte, originalName, mimeType string) (string, string, error)
	GetFile(filename string) ([]byte, error)
	DeleteFile(filename string) error
	FileExists(filename string) bool
}

// StorageConfig holds configuration for file storage
type StorageConfig struct {
	UploadDir   string
	MaxFileSize int64 // in bytes
	AllowedMIME []string
}

// DefaultStorageConfig returns default storage configuration
func DefaultStorageConfig() *StorageConfig {
	return &StorageConfig{
		UploadDir:   "./uploads",
		MaxFileSize: 10 * 1024 * 1024, // 10MB
		AllowedMIME: []string{
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"application/pdf",
			"text/plain",
		},
	}
}

// FileStorage handles file storage operations
type FileStorage struct {
	config *StorageConfig
}

// NewFileStorage creates a new file storage instance
func NewFileStorage(config *StorageConfig) *FileStorage {
	return &FileStorage{
		config: config,
	}
}

// SaveFile saves a file to disk and returns the filename and URL
func (fs *FileStorage) SaveFile(content []byte, originalName, mimeType string) (string, string, error) {
	// Validate file size
	if int64(len(content)) > fs.config.MaxFileSize {
		return "", "", fmt.Errorf("file size exceeds maximum allowed size of %d bytes", fs.config.MaxFileSize)
	}

	// Validate MIME type
	if !fs.isAllowedMIME(mimeType) {
		return "", "", fmt.Errorf("MIME type %s is not allowed", mimeType)
	}

	// Ensure upload directory exists
	if err := os.MkdirAll(fs.config.UploadDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Generate unique filename
	filename := fs.generateUniqueFilename(originalName)
	filePath := filepath.Join(fs.config.UploadDir, filename)

	// Write file to disk
	if err := os.WriteFile(filePath, content, 0644); err != nil {
		return "", "", fmt.Errorf("failed to write file: %w", err)
	}

	// Generate URL
	url := "/uploads/" + filename

	return filename, url, nil
}

// GetFile reads a file from disk
func (fs *FileStorage) GetFile(filename string) ([]byte, error) {
	filePath := filepath.Join(fs.config.UploadDir, filename)
	
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("file not found: %s", filename)
	}

	// Read file
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return content, nil
}

// DeleteFile removes a file from disk
func (fs *FileStorage) DeleteFile(filename string) error {
	filePath := filepath.Join(fs.config.UploadDir, filename)
	
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("file not found: %s", filename)
	}

	// Delete file
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// FileExists checks if a file exists on disk
func (fs *FileStorage) FileExists(filename string) bool {
	filePath := filepath.Join(fs.config.UploadDir, filename)
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

// generateUniqueFilename generates a unique filename using timestamp and hash
func (fs *FileStorage) generateUniqueFilename(originalName string) string {
	ext := filepath.Ext(originalName)
	nameWithoutExt := strings.TrimSuffix(originalName, ext)
	
	// Create hash from original name and current time
	hash := sha256.Sum256([]byte(nameWithoutExt + time.Now().String()))
	hashStr := fmt.Sprintf("%x", hash)[:12] // Use first 12 characters
	
	// Generate timestamp
	timestamp := time.Now().Unix()
	
	return fmt.Sprintf("%s_%d_%s%s", nameWithoutExt, timestamp, hashStr, ext)
}

// isAllowedMIME checks if the MIME type is allowed
func (fs *FileStorage) isAllowedMIME(mimeType string) bool {
	for _, allowed := range fs.config.AllowedMIME {
		if allowed == mimeType {
			return true
		}
	}
	return false
}

// GetFileInfo returns file information without reading the entire file
func (fs *FileStorage) GetFileInfo(filename string) (os.FileInfo, error) {
	filePath := filepath.Join(fs.config.UploadDir, filename)
	return os.Stat(filePath)
}
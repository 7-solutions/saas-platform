package media

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
)

// FileMetadata contains extracted file metadata
type FileMetadata struct {
	MimeType   string
	Size       int64
	Width      int
	Height     int
	Extension  string
	IsImage    bool
	IsDocument bool
}

// MetadataExtractor extracts metadata from files
type MetadataExtractor struct {
	imageProcessor *ImageProcessor
}

// NewMetadataExtractor creates a new metadata extractor
func NewMetadataExtractor() *MetadataExtractor {
	return &MetadataExtractor{
		imageProcessor: DefaultImageProcessor(),
	}
}

// ExtractMetadata extracts metadata from file content
func (me *MetadataExtractor) ExtractMetadata(content []byte, filename string) (*FileMetadata, error) {
	metadata := &FileMetadata{
		Size:      int64(len(content)),
		Extension: strings.ToLower(filepath.Ext(filename)),
	}

	// Detect MIME type
	mimeType := me.detectMIMEType(content, filename)
	metadata.MimeType = mimeType

	// Set file type flags
	metadata.IsImage = strings.HasPrefix(mimeType, "image/")
	metadata.IsDocument = me.isDocumentMIME(mimeType)

	// Extract image-specific metadata
	if metadata.IsImage {
		width, height, err := me.imageProcessor.GetImageDimensions(content)
		if err == nil {
			metadata.Width = width
			metadata.Height = height
		} else {
			// If we can't extract dimensions, set them to 0
			// This might happen with corrupted or unsupported image formats
			metadata.Width = 0
			metadata.Height = 0
		}
	}

	return metadata, nil
}

// detectMIMEType detects the MIME type of file content
func (me *MetadataExtractor) detectMIMEType(content []byte, filename string) string {
	// First try to detect from content
	mimeType := http.DetectContentType(content)
	
	// If detection fails or returns generic type, try to infer from extension
	if mimeType == "application/octet-stream" || mimeType == "text/plain; charset=utf-8" {
		ext := strings.ToLower(filepath.Ext(filename))
		if knownMIME, exists := me.getKnownMIMETypes()[ext]; exists {
			return knownMIME
		}
	}

	return mimeType
}

// getKnownMIMETypes returns a map of file extensions to MIME types
func (me *MetadataExtractor) getKnownMIMETypes() map[string]string {
	return map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".txt":  "text/plain",
		".md":   "text/markdown",
		".html": "text/html",
		".css":  "text/css",
		".js":   "application/javascript",
		".json": "application/json",
		".xml":  "application/xml",
		".zip":  "application/zip",
		".tar":  "application/x-tar",
		".gz":   "application/gzip",
	}
}

// isDocumentMIME checks if the MIME type represents a document
func (me *MetadataExtractor) isDocumentMIME(mimeType string) bool {
	documentMIMEs := []string{
		"application/pdf",
		"text/plain",
		"text/markdown",
		"text/html",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	}

	for _, docMIME := range documentMIMEs {
		if mimeType == docMIME {
			return true
		}
	}

	return false
}

// ValidateFile validates if a file is acceptable for upload
func (me *MetadataExtractor) ValidateFile(metadata *FileMetadata, allowedMIMEs []string, maxSize int64) error {
	// Check file size
	if metadata.Size > maxSize {
		return fmt.Errorf("file size %d bytes exceeds maximum allowed size of %d bytes", metadata.Size, maxSize)
	}

	// Check MIME type
	if len(allowedMIMEs) > 0 {
		allowed := false
		for _, allowedMIME := range allowedMIMEs {
			if metadata.MimeType == allowedMIME {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("MIME type %s is not allowed", metadata.MimeType)
		}
	}

	// Additional validation for images
	if metadata.IsImage {
		// Only validate dimensions if they were successfully extracted
		// Some images might not have extractable dimensions due to format issues
		if metadata.Width < 0 || metadata.Height < 0 {
			return fmt.Errorf("invalid image dimensions: %dx%d", metadata.Width, metadata.Height)
		}
	}

	return nil
}
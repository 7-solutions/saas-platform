package media

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMetadataExtractor_ExtractMetadata(t *testing.T) {
	extractor := NewMetadataExtractor()

	tests := []struct {
		name         string
		content      []byte
		filename     string
		expectedMIME string
		expectedSize int64
		isImage      bool
		isDocument   bool
	}{
		{
			name:         "text file",
			content:      []byte("Hello, world!"),
			filename:     "test.txt",
			expectedMIME: "text/plain",
			expectedSize: 13,
			isImage:      false,
			isDocument:   true,
		},
		{
			name:         "PDF file by extension",
			content:      []byte("%PDF-1.4"),
			filename:     "document.pdf",
			expectedMIME: "application/pdf",
			expectedSize: 8,
			isImage:      false,
			isDocument:   true,
		},
		{
			name:         "JPEG file by extension",
			content:      []byte{0xFF, 0xD8, 0xFF}, // JPEG header
			filename:     "image.jpg",
			expectedMIME: "image/jpeg",
			expectedSize: 3,
			isImage:      true,
			isDocument:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadata, err := extractor.ExtractMetadata(tt.content, tt.filename)

			assert.NoError(t, err)
			assert.NotNil(t, metadata)
			assert.Equal(t, tt.expectedMIME, metadata.MimeType)
			assert.Equal(t, tt.expectedSize, metadata.Size)
			assert.Equal(t, tt.isImage, metadata.IsImage)
			assert.Equal(t, tt.isDocument, metadata.IsDocument)
		})
	}
}

func TestMetadataExtractor_ValidateFile(t *testing.T) {
	extractor := NewMetadataExtractor()

	tests := []struct {
		name         string
		metadata     *FileMetadata
		allowedMIMEs []string
		maxSize      int64
		expectError  bool
		errorMsg     string
	}{
		{
			name: "valid file",
			metadata: &FileMetadata{
				MimeType: "image/jpeg",
				Size:     1024,
				IsImage:  true,
				Width:    100,
				Height:   100,
			},
			allowedMIMEs: []string{"image/jpeg", "image/png"},
			maxSize:      2048,
			expectError:  false,
		},
		{
			name: "file too large",
			metadata: &FileMetadata{
				MimeType: "image/jpeg",
				Size:     2048,
				IsImage:  true,
				Width:    100,
				Height:   100,
			},
			allowedMIMEs: []string{"image/jpeg"},
			maxSize:      1024,
			expectError:  true,
			errorMsg:     "file size",
		},
		{
			name: "disallowed MIME type",
			metadata: &FileMetadata{
				MimeType: "application/pdf",
				Size:     1024,
				IsImage:  false,
			},
			allowedMIMEs: []string{"image/jpeg", "image/png"},
			maxSize:      2048,
			expectError:  true,
			errorMsg:     "MIME type",
		},
		{
			name: "invalid image dimensions",
			metadata: &FileMetadata{
				MimeType: "image/jpeg",
				Size:     1024,
				IsImage:  true,
				Width:    -1,
				Height:   100,
			},
			allowedMIMEs: []string{"image/jpeg"},
			maxSize:      2048,
			expectError:  true,
			errorMsg:     "invalid image dimensions",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := extractor.ValidateFile(tt.metadata, tt.allowedMIMEs, tt.maxSize)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMetadataExtractor_detectMIMEType(t *testing.T) {
	extractor := NewMetadataExtractor()

	tests := []struct {
		name         string
		content      []byte
		filename     string
		expectedMIME string
	}{
		{
			name:         "JPEG by content",
			content:      []byte{0xFF, 0xD8, 0xFF},
			filename:     "test.jpg",
			expectedMIME: "image/jpeg",
		},
		{
			name:         "PNG by content",
			content:      []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
			filename:     "test.png",
			expectedMIME: "image/png",
		},
		{
			name:         "PDF by extension fallback",
			content:      []byte("some binary content"),
			filename:     "document.pdf",
			expectedMIME: "application/pdf",
		},
		{
			name:         "text file",
			content:      []byte("Hello, world!"),
			filename:     "test.txt",
			expectedMIME: "text/plain",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mimeType := extractor.detectMIMEType(tt.content, tt.filename)
			assert.Equal(t, tt.expectedMIME, mimeType)
		})
	}
}

func TestMetadataExtractor_isDocumentMIME(t *testing.T) {
	extractor := NewMetadataExtractor()

	tests := []struct {
		name     string
		mimeType string
		expected bool
	}{
		{
			name:     "PDF document",
			mimeType: "application/pdf",
			expected: true,
		},
		{
			name:     "plain text",
			mimeType: "text/plain",
			expected: true,
		},
		{
			name:     "markdown",
			mimeType: "text/markdown",
			expected: true,
		},
		{
			name:     "JPEG image",
			mimeType: "image/jpeg",
			expected: false,
		},
		{
			name:     "unknown type",
			mimeType: "application/unknown",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractor.isDocumentMIME(tt.mimeType)
			assert.Equal(t, tt.expected, result)
		})
	}
}
package models

import (
	"time"
)

// Media represents a media file document in CouchDB
type Media struct {
	ID           string    `json:"_id"`
	Rev          string    `json:"_rev,omitempty"`
	Type         string    `json:"type"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	Size         int64     `json:"size"`
	URL          string    `json:"url"`
	AltText      string    `json:"alt_text,omitempty"`
	UploadedBy   string    `json:"uploaded_by"`
	CreatedAt    time.Time `json:"created_at"`
}

// NewMedia creates a new media document with default values
func NewMedia(filename, originalName, mimeType, uploadedBy string, size int64) *Media {
	now := time.Now()
	return &Media{
		ID:           "media:" + filename,
		Type:         "media",
		Filename:     filename,
		OriginalName: originalName,
		MimeType:     mimeType,
		Size:         size,
		URL:          "/uploads/" + filename,
		UploadedBy:   uploadedBy,
		CreatedAt:    now,
	}
}
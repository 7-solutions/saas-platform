package services

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	mediav1 "github.com/7-solutions/saas-platformbackend/gen/media/v1"
	"github.com/7-solutions/saas-platformbackend/internal/models"
	ports "github.com/7-solutions/saas-platformbackend/internal/ports"
	"github.com/7-solutions/saas-platformbackend/internal/repository"
	"github.com/7-solutions/saas-platformbackend/internal/utils/media"
)

// MediaService implements the media service
// Adapter pattern: constructor now accepts ports for DI. Shim retained for compatibility.
type MediaService struct {
	mediav1.UnimplementedMediaServiceServer
	mediaRepo         repository.MediaRepository
	fileStorage       media.FileStorageInterface
	imageProcessor    *media.ImageProcessor
	metadataExtractor *media.MetadataExtractor

	// Optional future-use dependencies via ports (can be nil; not used yet)
	uow ports.UnitOfWork
}

// NewMediaServiceWithPorts constructs MediaService with ports-based dependencies.
// Adapter pattern: constructor now accepts ports for DI. Shim retained for compatibility.
func NewMediaServiceWithPorts(
	mediaRepo repository.MediaRepository, // keep concrete repo until a port exists
	uow ports.UnitOfWork,
) *MediaService {
	// Preserve existing behavior using default utils while storing optional ports.
	svc := &MediaService{
		mediaRepo:         mediaRepo,
		fileStorage:       media.NewFileStorage(media.DefaultStorageConfig()),
		imageProcessor:    media.DefaultImageProcessor(),
		metadataExtractor: media.NewMetadataExtractor(),
		uow:               uow,
	}
	return svc
}

// NewMediaService creates a new media service (backward-compatible shim).
// Deprecated: prefer NewMediaServiceWithPorts. Shim retained for compatibility.
func NewMediaService(mediaRepo repository.MediaRepository) *MediaService {
	return NewMediaServiceWithPorts(mediaRepo, nil)
}

// NewMediaServiceWithDependencies creates a new media service with custom dependencies
func NewMediaServiceWithDependencies(
	mediaRepo repository.MediaRepository,
	fileStorage media.FileStorageInterface,
	imageProcessor *media.ImageProcessor,
	metadataExtractor *media.MetadataExtractor,
) *MediaService {
	// Use defaults if nil dependencies are provided
	if fileStorage == nil {
		fileStorage = media.NewFileStorage(media.DefaultStorageConfig())
	}
	if imageProcessor == nil {
		imageProcessor = media.DefaultImageProcessor()
	}
	if metadataExtractor == nil {
		metadataExtractor = media.NewMetadataExtractor()
	}

	return &MediaService{
		mediaRepo:         mediaRepo,
		fileStorage:       fileStorage,
		imageProcessor:    imageProcessor,
		metadataExtractor: metadataExtractor,
	}
}

// UploadFile uploads a file
func (s *MediaService) UploadFile(ctx context.Context, req *mediav1.UploadFileRequest) (*mediav1.File, error) {
	if req.Filename == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filename is required")
	}

	if len(req.Content) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "file content is required")
	}

	// Extract metadata from file
	metadata, err := s.metadataExtractor.ExtractMetadata(req.Content, req.Filename)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to extract metadata: %v", err)
	}

	// Use detected MIME type if not provided
	mimeType := req.MimeType
	if mimeType == "" {
		mimeType = metadata.MimeType
	}

	// Validate file
	storageConfig := media.DefaultStorageConfig()
	if err := s.metadataExtractor.ValidateFile(metadata, storageConfig.AllowedMIME, storageConfig.MaxFileSize); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "file validation failed: %v", err)
	}

	// Process image if it's an image file
	processedContent := req.Content
	if metadata.IsImage {
		processedContent, err = s.imageProcessor.ProcessImage(req.Content, mimeType)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to process image: %v", err)
		}
	}

	// Save file to storage
	filename, url, err := s.fileStorage.SaveFile(processedContent, req.Filename, mimeType)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save file: %v", err)
	}

	// Create media document
	mediaDoc := models.NewMedia(filename, req.Filename, mimeType, "user-123", int64(len(processedContent))) // TODO: Get user from auth context
	mediaDoc.AltText = req.AltText
	mediaDoc.URL = url

	// Save to database
	if err := s.mediaRepo.Create(ctx, mediaDoc); err != nil {
		// Clean up file if database save fails
		s.fileStorage.DeleteFile(filename)
		return nil, status.Errorf(codes.Internal, "failed to save media record: %v", err)
	}

	// Convert to protobuf response
	file := &mediav1.File{
		Id:           mediaDoc.ID,
		Filename:     mediaDoc.Filename,
		OriginalName: mediaDoc.OriginalName,
		MimeType:     mediaDoc.MimeType,
		Size:         mediaDoc.Size,
		Url:          mediaDoc.URL,
		AltText:      mediaDoc.AltText,
		UploadedBy:   mediaDoc.UploadedBy,
		CreatedAt:    timestamppb.New(mediaDoc.CreatedAt),
	}

	return file, nil
}

// GetFile retrieves file information
func (s *MediaService) GetFile(ctx context.Context, req *mediav1.GetFileRequest) (*mediav1.File, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "file ID is required")
	}

	// Get media document from database
	mediaDoc, err := s.mediaRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "file not found: %v", err)
	}

	// Verify file exists on disk
	if !s.fileStorage.FileExists(mediaDoc.Filename) {
		return nil, status.Errorf(codes.NotFound, "file not found on disk: %s", mediaDoc.Filename)
	}

	// Convert to protobuf response
	file := &mediav1.File{
		Id:           mediaDoc.ID,
		Filename:     mediaDoc.Filename,
		OriginalName: mediaDoc.OriginalName,
		MimeType:     mediaDoc.MimeType,
		Size:         mediaDoc.Size,
		Url:          mediaDoc.URL,
		AltText:      mediaDoc.AltText,
		UploadedBy:   mediaDoc.UploadedBy,
		CreatedAt:    timestamppb.New(mediaDoc.CreatedAt),
	}

	return file, nil
}

// DeleteFile deletes a file
func (s *MediaService) DeleteFile(ctx context.Context, req *mediav1.DeleteFileRequest) (*emptypb.Empty, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "file ID is required")
	}

	// Get media document from database
	mediaDoc, err := s.mediaRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "file not found: %v", err)
	}

	// Delete from database first
	if err := s.mediaRepo.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete media record: %v", err)
	}

	// Delete file from storage
	if err := s.fileStorage.DeleteFile(mediaDoc.Filename); err != nil {
		// Log error but don't fail the request since database record is already deleted
		// In production, you might want to implement a cleanup job for orphaned files
		fmt.Printf("Warning: failed to delete file from storage: %v\n", err)
	}

	return &emptypb.Empty{}, nil
}

// ListFiles lists files with filtering
func (s *MediaService) ListFiles(ctx context.Context, req *mediav1.ListFilesRequest) (*mediav1.ListFilesResponse, error) {
	// Set default page size if not provided
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 100 {
		pageSize = 100 // Limit maximum page size
	}

	// Parse page token to get skip value
	skip := 0
	if req.PageToken != "" {
		if parsedSkip, err := strconv.Atoi(req.PageToken); err == nil {
			skip = parsedSkip
		}
	}

	// Set up list options
	listOptions := repository.ListOptions{
		Limit: int(pageSize),
		Skip:  skip,
	}

	// Get media documents from database
	mediaList, err := s.mediaRepo.List(ctx, listOptions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list media: %v", err)
	}

	// Filter by MIME type if specified
	var filteredMedia []*models.Media
	if req.MimeTypeFilter != "" {
		for _, media := range mediaList {
			if strings.HasPrefix(media.MimeType, req.MimeTypeFilter) {
				filteredMedia = append(filteredMedia, media)
			}
		}
	} else {
		filteredMedia = mediaList
	}

	// Filter by search term if specified
	if req.Search != "" {
		var searchFiltered []*models.Media
		searchTerm := strings.ToLower(req.Search)
		for _, media := range filteredMedia {
			if strings.Contains(strings.ToLower(media.OriginalName), searchTerm) ||
				strings.Contains(strings.ToLower(media.AltText), searchTerm) {
				searchFiltered = append(searchFiltered, media)
			}
		}
		filteredMedia = searchFiltered
	}

	// Convert to protobuf response
	files := make([]*mediav1.File, len(filteredMedia))
	for i, media := range filteredMedia {
		files[i] = &mediav1.File{
			Id:           media.ID,
			Filename:     media.Filename,
			OriginalName: media.OriginalName,
			MimeType:     media.MimeType,
			Size:         media.Size,
			Url:          media.URL,
			AltText:      media.AltText,
			UploadedBy:   media.UploadedBy,
			CreatedAt:    timestamppb.New(media.CreatedAt),
		}
	}

	// Calculate next page token
	nextPageToken := ""
	if len(files) == int(pageSize) {
		nextPageToken = strconv.Itoa(skip + int(pageSize))
	}

	return &mediav1.ListFilesResponse{
		Files:         files,
		NextPageToken: nextPageToken,
		TotalCount:    int32(len(files)),
	}, nil
}

// UpdateFile updates file metadata
func (s *MediaService) UpdateFile(ctx context.Context, req *mediav1.UpdateFileRequest) (*mediav1.File, error) {
	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "file ID is required")
	}

	// Get existing media document
	mediaDoc, err := s.mediaRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "file not found: %v", err)
	}

	// Update fields if provided
	if req.AltText != "" {
		mediaDoc.AltText = req.AltText
	}

	// Note: We don't allow changing the filename as it would require moving the file
	// and updating all references. This could be implemented as a separate operation.

	// Update in database
	if err := s.mediaRepo.Update(ctx, mediaDoc); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update media record: %v", err)
	}

	// Convert to protobuf response
	file := &mediav1.File{
		Id:           mediaDoc.ID,
		Filename:     mediaDoc.Filename,
		OriginalName: mediaDoc.OriginalName,
		MimeType:     mediaDoc.MimeType,
		Size:         mediaDoc.Size,
		Url:          mediaDoc.URL,
		AltText:      mediaDoc.AltText,
		UploadedBy:   mediaDoc.UploadedBy,
		CreatedAt:    timestamppb.New(mediaDoc.CreatedAt),
	}

	return file, nil
}

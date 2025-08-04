package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	mediav1 "github.com/7-solutions/saas-platformbackend/gen/media/v1"
	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/7-solutions/saas-platformbackend/internal/repository"
)

// MockMediaRepository is a mock implementation of MediaRepository
type MockMediaRepository struct {
	mock.Mock
}

// MockFileStorage is a mock implementation of FileStorage
type MockFileStorage struct {
	mock.Mock
}

func (m *MockFileStorage) SaveFile(content []byte, originalName, mimeType string) (string, string, error) {
	args := m.Called(content, originalName, mimeType)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockFileStorage) GetFile(filename string) ([]byte, error) {
	args := m.Called(filename)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockFileStorage) DeleteFile(filename string) error {
	args := m.Called(filename)
	return args.Error(0)
}

func (m *MockFileStorage) FileExists(filename string) bool {
	args := m.Called(filename)
	return args.Bool(0)
}

func (m *MockMediaRepository) Create(ctx context.Context, media *models.Media) error {
	args := m.Called(ctx, media)
	return args.Error(0)
}

func (m *MockMediaRepository) GetByID(ctx context.Context, id string) (*models.Media, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Media), args.Error(1)
}

func (m *MockMediaRepository) GetByFilename(ctx context.Context, filename string) (*models.Media, error) {
	args := m.Called(ctx, filename)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Media), args.Error(1)
}

func (m *MockMediaRepository) Update(ctx context.Context, media *models.Media) error {
	args := m.Called(ctx, media)
	return args.Error(0)
}

func (m *MockMediaRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockMediaRepository) List(ctx context.Context, options repository.ListOptions) ([]*models.Media, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Media), args.Error(1)
}

func (m *MockMediaRepository) ListByUploader(ctx context.Context, uploaderID string, options repository.ListOptions) ([]*models.Media, error) {
	args := m.Called(ctx, uploaderID, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Media), args.Error(1)
}

func TestMediaService_UploadFile(t *testing.T) {
	// Setup
	mockRepo := new(MockMediaRepository)
	mockStorage := new(MockFileStorage)
	service := NewMediaServiceWithDependencies(mockRepo, mockStorage, nil, nil)
	ctx := context.Background()

	// Use simple text content for testing
	testContent := []byte("test file content")

	tests := []struct {
		name        string
		request     *mediav1.UploadFileRequest
		setupMock   func()
		expectError bool
		errorCode   string
	}{
		{
			name: "successful text file upload",
			request: &mediav1.UploadFileRequest{
				Content:  testContent,
				Filename: "test.txt",
				MimeType: "text/plain",
				AltText:  "Test file",
			},
			setupMock: func() {
				mockStorage.On("SaveFile", testContent, "test.txt", "text/plain").Return("test_123_abc.txt", "/uploads/test_123_abc.txt", nil)
				mockRepo.On("Create", ctx, mock.AnythingOfType("*models.Media")).Return(nil)
			},
			expectError: false,
		},
		{
			name: "empty filename",
			request: &mediav1.UploadFileRequest{
				Content:  testContent,
				Filename: "",
				MimeType: "text/plain",
			},
			setupMock:   func() {},
			expectError: true,
			errorCode:   "InvalidArgument",
		},
		{
			name: "empty content",
			request: &mediav1.UploadFileRequest{
				Content:  []byte{},
				Filename: "test.txt",
				MimeType: "text/plain",
			},
			setupMock:   func() {},
			expectError: true,
			errorCode:   "InvalidArgument",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockStorage.ExpectedCalls = nil
			tt.setupMock()

			// Execute
			response, err := service.UploadFile(ctx, tt.request)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, response)
				if tt.errorCode != "" {
					assert.Contains(t, err.Error(), tt.errorCode)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tt.request.AltText, response.AltText)
				assert.NotEmpty(t, response.Id)
				assert.NotEmpty(t, response.Url)
			}

			mockRepo.AssertExpectations(t)
			mockStorage.AssertExpectations(t)
		})
	}
}

func TestMediaService_GetFile(t *testing.T) {
	// Setup
	mockRepo := new(MockMediaRepository)
	mockStorage := new(MockFileStorage)
	service := NewMediaServiceWithDependencies(mockRepo, mockStorage, nil, nil)
	ctx := context.Background()

	testMedia := &models.Media{
		ID:           "media:test.png",
		Type:         "media",
		Filename:     "test_123_abc.png",
		OriginalName: "test.png",
		MimeType:     "image/png",
		Size:         1024,
		URL:          "/uploads/test_123_abc.png",
		AltText:      "Test image",
		UploadedBy:   "user-123",
		CreatedAt:    time.Now(),
	}

	tests := []struct {
		name        string
		request     *mediav1.GetFileRequest
		setupMock   func()
		expectError bool
	}{
		{
			name: "successful file retrieval",
			request: &mediav1.GetFileRequest{
				Id: "media:test.png",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:test.png").Return(testMedia, nil)
				mockStorage.On("FileExists", "test_123_abc.png").Return(true)
			},
			expectError: false,
		},
		{
			name: "empty file ID",
			request: &mediav1.GetFileRequest{
				Id: "",
			},
			setupMock:   func() {},
			expectError: true,
		},
		{
			name: "file not found",
			request: &mediav1.GetFileRequest{
				Id: "media:nonexistent.png",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:nonexistent.png").Return(nil, assert.AnError)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockStorage.ExpectedCalls = nil
			tt.setupMock()

			// Execute
			response, err := service.GetFile(ctx, tt.request)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, testMedia.ID, response.Id)
				assert.Equal(t, testMedia.Filename, response.Filename)
				assert.Equal(t, testMedia.OriginalName, response.OriginalName)
				assert.Equal(t, testMedia.MimeType, response.MimeType)
				assert.Equal(t, testMedia.Size, response.Size)
				assert.Equal(t, testMedia.URL, response.Url)
				assert.Equal(t, testMedia.AltText, response.AltText)
				assert.Equal(t, testMedia.UploadedBy, response.UploadedBy)
			}

			mockRepo.AssertExpectations(t)
			mockStorage.AssertExpectations(t)
		})
	}
}

func TestMediaService_DeleteFile(t *testing.T) {
	// Setup
	mockRepo := new(MockMediaRepository)
	mockStorage := new(MockFileStorage)
	service := NewMediaServiceWithDependencies(mockRepo, mockStorage, nil, nil)
	ctx := context.Background()

	testMedia := &models.Media{
		ID:           "media:test.png",
		Type:         "media",
		Filename:     "test_123_abc.png",
		OriginalName: "test.png",
		MimeType:     "image/png",
		Size:         1024,
		URL:          "/uploads/test_123_abc.png",
		AltText:      "Test image",
		UploadedBy:   "user-123",
		CreatedAt:    time.Now(),
	}

	tests := []struct {
		name        string
		request     *mediav1.DeleteFileRequest
		setupMock   func()
		expectError bool
	}{
		{
			name: "successful file deletion",
			request: &mediav1.DeleteFileRequest{
				Id: "media:test.png",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:test.png").Return(testMedia, nil)
				mockRepo.On("Delete", ctx, "media:test.png").Return(nil)
				mockStorage.On("DeleteFile", "test_123_abc.png").Return(nil)
			},
			expectError: false,
		},
		{
			name: "empty file ID",
			request: &mediav1.DeleteFileRequest{
				Id: "",
			},
			setupMock:   func() {},
			expectError: true,
		},
		{
			name: "file not found",
			request: &mediav1.DeleteFileRequest{
				Id: "media:nonexistent.png",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:nonexistent.png").Return(nil, assert.AnError)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockStorage.ExpectedCalls = nil
			tt.setupMock()

			// Execute
			response, err := service.DeleteFile(ctx, tt.request)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
			}

			mockRepo.AssertExpectations(t)
			mockStorage.AssertExpectations(t)
		})
	}
}

func TestMediaService_ListFiles(t *testing.T) {
	// Setup
	mockRepo := new(MockMediaRepository)
	mockStorage := new(MockFileStorage)
	service := NewMediaServiceWithDependencies(mockRepo, mockStorage, nil, nil)
	ctx := context.Background()

	testMediaList := []*models.Media{
		{
			ID:           "media:test1.png",
			Type:         "media",
			Filename:     "test1_123_abc.png",
			OriginalName: "test1.png",
			MimeType:     "image/png",
			Size:         1024,
			URL:          "/uploads/test1_123_abc.png",
			AltText:      "Test image 1",
			UploadedBy:   "user-123",
			CreatedAt:    time.Now(),
		},
		{
			ID:           "media:test2.jpg",
			Type:         "media",
			Filename:     "test2_456_def.jpg",
			OriginalName: "test2.jpg",
			MimeType:     "image/jpeg",
			Size:         2048,
			URL:          "/uploads/test2_456_def.jpg",
			AltText:      "Test image 2",
			UploadedBy:   "user-123",
			CreatedAt:    time.Now(),
		},
	}

	tests := []struct {
		name           string
		request        *mediav1.ListFilesRequest
		setupMock      func()
		expectError    bool
		expectedCount  int
		expectedFilter bool
	}{
		{
			name: "successful file listing",
			request: &mediav1.ListFilesRequest{
				PageSize: 10,
			},
			setupMock: func() {
				mockRepo.On("List", ctx, mock.AnythingOfType("repository.ListOptions")).Return(testMediaList, nil)
			},
			expectError:   false,
			expectedCount: 2,
		},
		{
			name: "file listing with MIME type filter",
			request: &mediav1.ListFilesRequest{
				PageSize:       10,
				MimeTypeFilter: "image/png",
			},
			setupMock: func() {
				mockRepo.On("List", ctx, mock.AnythingOfType("repository.ListOptions")).Return(testMediaList, nil)
			},
			expectError:    false,
			expectedCount:  1,
			expectedFilter: true,
		},
		{
			name: "file listing with search",
			request: &mediav1.ListFilesRequest{
				PageSize: 10,
				Search:   "test1",
			},
			setupMock: func() {
				mockRepo.On("List", ctx, mock.AnythingOfType("repository.ListOptions")).Return(testMediaList, nil)
			},
			expectError:   false,
			expectedCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockStorage.ExpectedCalls = nil
			tt.setupMock()

			// Execute
			response, err := service.ListFiles(ctx, tt.request)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Len(t, response.Files, tt.expectedCount)
				assert.Equal(t, int32(tt.expectedCount), response.TotalCount)

				if tt.expectedFilter && len(response.Files) > 0 {
					// Check that filtered results match the filter
					for _, file := range response.Files {
						if tt.request.MimeTypeFilter != "" {
							assert.Contains(t, file.MimeType, tt.request.MimeTypeFilter)
						}
					}
				}
			}

			mockRepo.AssertExpectations(t)
			mockStorage.AssertExpectations(t)
		})
	}
}

func TestMediaService_UpdateFile(t *testing.T) {
	// Setup
	mockRepo := new(MockMediaRepository)
	mockStorage := new(MockFileStorage)
	service := NewMediaServiceWithDependencies(mockRepo, mockStorage, nil, nil)
	ctx := context.Background()

	testMedia := &models.Media{
		ID:           "media:test.png",
		Type:         "media",
		Filename:     "test_123_abc.png",
		OriginalName: "test.png",
		MimeType:     "image/png",
		Size:         1024,
		URL:          "/uploads/test_123_abc.png",
		AltText:      "Test image",
		UploadedBy:   "user-123",
		CreatedAt:    time.Now(),
	}

	tests := []struct {
		name        string
		request     *mediav1.UpdateFileRequest
		setupMock   func()
		expectError bool
	}{
		{
			name: "successful file update",
			request: &mediav1.UpdateFileRequest{
				Id:      "media:test.png",
				AltText: "Updated alt text",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:test.png").Return(testMedia, nil)
				mockRepo.On("Update", ctx, mock.AnythingOfType("*models.Media")).Return(nil)
			},
			expectError: false,
		},
		{
			name: "empty file ID",
			request: &mediav1.UpdateFileRequest{
				Id:      "",
				AltText: "Updated alt text",
			},
			setupMock:   func() {},
			expectError: true,
		},
		{
			name: "file not found",
			request: &mediav1.UpdateFileRequest{
				Id:      "media:nonexistent.png",
				AltText: "Updated alt text",
			},
			setupMock: func() {
				mockRepo.On("GetByID", ctx, "media:nonexistent.png").Return(nil, assert.AnError)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockStorage.ExpectedCalls = nil
			tt.setupMock()

			// Execute
			response, err := service.UpdateFile(ctx, tt.request)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tt.request.AltText, response.AltText)
			}

			mockRepo.AssertExpectations(t)
			mockStorage.AssertExpectations(t)
		})
	}
}

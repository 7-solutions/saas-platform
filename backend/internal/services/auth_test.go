package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authv1 "github.com/7-solutions/saas-platformbackend/gen/auth/v1"
	"github.com/7-solutions/saas-platformbackend/internal/models"
	"github.com/7-solutions/saas-platformbackend/internal/repository"
	"github.com/7-solutions/saas-platformbackend/internal/utils/auth"
)

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, options repository.ListOptions) ([]*models.User, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) ListByRole(ctx context.Context, role string, options repository.ListOptions) ([]*models.User, error) {
	args := m.Called(ctx, role, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.User), args.Error(1)
}

func TestAuthService_Login(t *testing.T) {
	tests := []struct {
		name           string
		request        *authv1.LoginRequest
		setupMock      func(*MockUserRepository)
		expectedError  bool
		expectedCode   codes.Code
		validateResult func(*testing.T, *authv1.LoginResponse)
	}{
		{
			name: "successful login",
			request: &authv1.LoginRequest{
				Email:    "admin@example.com",
				Password: "password123",
			},
			setupMock: func(mockRepo *MockUserRepository) {
				hashedPassword, _ := auth.HashPassword("password123")
				user := &models.User{
					ID:           "user:admin@example.com",
					Email:        "admin@example.com",
					PasswordHash: hashedPassword,
					Role:         models.UserRoleAdmin,
					Profile: models.Profile{
						Name: "Admin User",
					},
					CreatedAt: time.Now(),
				}
				mockRepo.On("GetByEmail", mock.Anything, "admin@example.com").Return(user, nil)
				mockRepo.On("Update", mock.Anything, mock.AnythingOfType("*models.User")).Return(nil)
			},
			expectedError: false,
			validateResult: func(t *testing.T, resp *authv1.LoginResponse) {
				assert.NotEmpty(t, resp.AccessToken)
				assert.NotEmpty(t, resp.RefreshToken)
				assert.Equal(t, "admin@example.com", resp.User.Email)
				assert.Equal(t, authv1.UserRole_USER_ROLE_ADMIN, resp.User.Role)
				assert.Equal(t, int64(3600), resp.ExpiresIn)
			},
		},
		{
			name: "missing email",
			request: &authv1.LoginRequest{
				Email:    "",
				Password: "password123",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.InvalidArgument,
		},
		{
			name: "missing password",
			request: &authv1.LoginRequest{
				Email:    "admin@example.com",
				Password: "",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.InvalidArgument,
		},
		{
			name: "user not found",
			request: &authv1.LoginRequest{
				Email:    "nonexistent@example.com",
				Password: "password123",
			},
			setupMock: func(mockRepo *MockUserRepository) {
				mockRepo.On("GetByEmail", mock.Anything, "nonexistent@example.com").Return(nil, assert.AnError)
			},
			expectedError: true,
			expectedCode:  codes.NotFound,
		},
		{
			name: "invalid password",
			request: &authv1.LoginRequest{
				Email:    "admin@example.com",
				Password: "wrongpassword",
			},
			setupMock: func(mockRepo *MockUserRepository) {
				hashedPassword, _ := auth.HashPassword("password123")
				user := &models.User{
					ID:           "user:admin@example.com",
					Email:        "admin@example.com",
					PasswordHash: hashedPassword,
					Role:         models.UserRoleAdmin,
				}
				mockRepo.On("GetByEmail", mock.Anything, "admin@example.com").Return(user, nil)
			},
			expectedError: true,
			expectedCode:  codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.setupMock(mockRepo)

			service := NewAuthService(mockRepo)
			resp, err := service.Login(context.Background(), tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, resp)
				if tt.expectedCode != codes.OK {
					st, ok := status.FromError(err)
					assert.True(t, ok)
					assert.Equal(t, tt.expectedCode, st.Code())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, resp)
				if tt.validateResult != nil {
					tt.validateResult(t, resp)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAuthService_ValidateToken(t *testing.T) {
	// Create a test user and token
	hashedPassword, _ := auth.HashPassword("password123")
	testUser := &models.User{
		ID:           "user:admin@example.com",
		Email:        "admin@example.com",
		PasswordHash: hashedPassword,
		Role:         models.UserRoleAdmin,
		Profile: models.Profile{
			Name: "Admin User",
		},
		CreatedAt: time.Now(),
	}

	validToken, err := auth.GenerateToken(testUser.ID, testUser.Email, testUser.Role, testUser.Profile.Name)
	assert.NoError(t, err)

	tests := []struct {
		name           string
		request        *authv1.ValidateTokenRequest
		setupMock      func(*MockUserRepository)
		expectedError  bool
		expectedCode   codes.Code
		validateResult func(*testing.T, *authv1.User)
	}{
		{
			name: "valid token",
			request: &authv1.ValidateTokenRequest{
				Token: validToken,
			},
			setupMock: func(mockRepo *MockUserRepository) {
				mockRepo.On("GetByID", mock.Anything, testUser.ID).Return(testUser, nil)
			},
			expectedError: false,
			validateResult: func(t *testing.T, user *authv1.User) {
				assert.Equal(t, testUser.ID, user.Id)
				assert.Equal(t, testUser.Email, user.Email)
				assert.Equal(t, authv1.UserRole_USER_ROLE_ADMIN, user.Role)
			},
		},
		{
			name: "empty token",
			request: &authv1.ValidateTokenRequest{
				Token: "",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.InvalidArgument,
		},
		{
			name: "invalid token",
			request: &authv1.ValidateTokenRequest{
				Token: "invalid-token",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.Unauthenticated,
		},
		{
			name: "user not found",
			request: &authv1.ValidateTokenRequest{
				Token: validToken,
			},
			setupMock: func(mockRepo *MockUserRepository) {
				mockRepo.On("GetByID", mock.Anything, testUser.ID).Return(nil, assert.AnError)
			},
			expectedError: true,
			expectedCode:  codes.NotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.setupMock(mockRepo)

			service := NewAuthService(mockRepo)
			resp, err := service.ValidateToken(context.Background(), tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, resp)
				if tt.expectedCode != codes.OK {
					st, ok := status.FromError(err)
					assert.True(t, ok)
					assert.Equal(t, tt.expectedCode, st.Code())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, resp)
				if tt.validateResult != nil {
					tt.validateResult(t, resp)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAuthService_RefreshToken(t *testing.T) {
	// Create a test user and token
	hashedPassword, _ := auth.HashPassword("password123")
	testUser := &models.User{
		ID:           "user:admin@example.com",
		Email:        "admin@example.com",
		PasswordHash: hashedPassword,
		Role:         models.UserRoleAdmin,
		Profile: models.Profile{
			Name: "Admin User",
		},
		CreatedAt: time.Now(),
	}

	validRefreshToken, err := auth.GenerateToken(testUser.ID, testUser.Email, testUser.Role, testUser.Profile.Name)
	assert.NoError(t, err)

	tests := []struct {
		name           string
		request        *authv1.RefreshTokenRequest
		setupMock      func(*MockUserRepository)
		expectedError  bool
		expectedCode   codes.Code
		validateResult func(*testing.T, *authv1.LoginResponse)
	}{
		{
			name: "valid refresh token",
			request: &authv1.RefreshTokenRequest{
				RefreshToken: validRefreshToken,
			},
			setupMock: func(mockRepo *MockUserRepository) {
				mockRepo.On("GetByID", mock.Anything, testUser.ID).Return(testUser, nil)
			},
			expectedError: false,
			validateResult: func(t *testing.T, resp *authv1.LoginResponse) {
				assert.NotEmpty(t, resp.AccessToken)
				assert.NotEmpty(t, resp.RefreshToken)
				assert.Equal(t, testUser.Email, resp.User.Email)
				assert.Equal(t, authv1.UserRole_USER_ROLE_ADMIN, resp.User.Role)
			},
		},
		{
			name: "empty refresh token",
			request: &authv1.RefreshTokenRequest{
				RefreshToken: "",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.InvalidArgument,
		},
		{
			name: "invalid refresh token",
			request: &authv1.RefreshTokenRequest{
				RefreshToken: "invalid-token",
			},
			setupMock:     func(mockRepo *MockUserRepository) {},
			expectedError: true,
			expectedCode:  codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.setupMock(mockRepo)

			service := NewAuthService(mockRepo)
			resp, err := service.RefreshToken(context.Background(), tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, resp)
				if tt.expectedCode != codes.OK {
					st, ok := status.FromError(err)
					assert.True(t, ok)
					assert.Equal(t, tt.expectedCode, st.Code())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, resp)
				if tt.validateResult != nil {
					tt.validateResult(t, resp)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAuthService_Logout(t *testing.T) {
	// Create a valid token for testing
	validToken, err := auth.GenerateToken("user:test@example.com", "test@example.com", "admin", "Test User")
	assert.NoError(t, err)

	tests := []struct {
		name          string
		request       *authv1.LogoutRequest
		expectedError bool
		expectedCode  codes.Code
	}{
		{
			name: "successful logout with valid token",
			request: &authv1.LogoutRequest{
				Token: validToken,
			},
			expectedError: false,
		},
		{
			name: "successful logout with empty token",
			request: &authv1.LogoutRequest{
				Token: "",
			},
			expectedError: false,
		},
		{
			name: "logout with invalid token",
			request: &authv1.LogoutRequest{
				Token: "invalid-token",
			},
			expectedError: true,
			expectedCode:  codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			service := NewAuthService(mockRepo)

			resp, err := service.Logout(context.Background(), tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, resp)
				if tt.expectedCode != codes.OK {
					st, ok := status.FromError(err)
					assert.True(t, ok)
					assert.Equal(t, tt.expectedCode, st.Code())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, resp)
				assert.True(t, resp.Success)
			}
		})
	}
}

func TestAuthService_modelToProtoUser(t *testing.T) {
	service := NewAuthService(nil)
	now := time.Now()

	tests := []struct {
		name     string
		user     *models.User
		expected *authv1.User
	}{
		{
			name: "admin user conversion",
			user: &models.User{
				ID:    "user:admin@example.com",
				Email: "admin@example.com",
				Role:  models.UserRoleAdmin,
				Profile: models.Profile{
					Name:   "Admin User",
					Avatar: "avatar.jpg",
				},
				CreatedAt: now,
				LastLogin: now,
			},
			expected: &authv1.User{
				Id:    "user:admin@example.com",
				Email: "admin@example.com",
				Role:  authv1.UserRole_USER_ROLE_ADMIN,
				Profile: &authv1.UserProfile{
					Name:   "Admin User",
					Avatar: "avatar.jpg",
				},
			},
		},
		{
			name: "editor user conversion",
			user: &models.User{
				ID:    "user:editor@example.com",
				Email: "editor@example.com",
				Role:  models.UserRoleEditor,
				Profile: models.Profile{
					Name: "Editor User",
				},
				CreatedAt: now,
				LastLogin: now,
			},
			expected: &authv1.User{
				Id:    "user:editor@example.com",
				Email: "editor@example.com",
				Role:  authv1.UserRole_USER_ROLE_EDITOR,
				Profile: &authv1.UserProfile{
					Name:   "Editor User",
					Avatar: "",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.modelToProtoUser(tt.user)

			assert.Equal(t, tt.expected.Id, result.Id)
			assert.Equal(t, tt.expected.Email, result.Email)
			assert.Equal(t, tt.expected.Role, result.Role)
			assert.Equal(t, tt.expected.Profile.Name, result.Profile.Name)
			assert.Equal(t, tt.expected.Profile.Avatar, result.Profile.Avatar)
			assert.NotNil(t, result.CreatedAt)
			assert.NotNil(t, result.LastLogin)
		})
	}
}

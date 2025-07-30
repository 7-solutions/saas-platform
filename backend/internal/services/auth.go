package services

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	authv1 "github.com/saas-startup-platform/backend/gen/auth/v1"
	"github.com/saas-startup-platform/backend/internal/models"
	"github.com/saas-startup-platform/backend/internal/repository"
	"github.com/saas-startup-platform/backend/internal/utils/auth"
)

// AuthService implements the auth service
type AuthService struct {
	authv1.UnimplementedAuthServiceServer
	userRepo repository.UserRepository
}

// NewAuthService creates a new auth service
func NewAuthService(userRepo repository.UserRepository) *AuthService {
	return &AuthService{
		userRepo: userRepo,
	}
}

// Login authenticates a user
func (s *AuthService) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.LoginResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, status.Errorf(codes.InvalidArgument, "email and password are required")
	}

	// Get user from database
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "invalid email or password")
	}

	// Verify password
	if !auth.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, status.Errorf(codes.Unauthenticated, "invalid email or password")
	}

	// Update last login time
	user.LastLogin = time.Now()
	if err := s.userRepo.Update(ctx, user); err != nil {
		// Log error but don't fail the login
		fmt.Printf("Failed to update last login time: %v\n", err)
	}

	// Generate JWT token
	accessToken, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.Profile.Name)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate access token")
	}

	// Generate refresh token (for now, same as access token but with longer expiration)
	refreshToken, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.Profile.Name)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate refresh token")
	}

	// Convert to protobuf user
	pbUser := s.modelToProtoUser(user)

	return &authv1.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         pbUser,
		ExpiresIn:    3600, // 1 hour
	}, nil
}

// ValidateToken validates a JWT token
func (s *AuthService) ValidateToken(ctx context.Context, req *authv1.ValidateTokenRequest) (*authv1.User, error) {
	if req.Token == "" {
		return nil, status.Errorf(codes.InvalidArgument, "token is required")
	}

	// Validate JWT token
	claims, err := auth.ValidateToken(req.Token)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}

	// Get user from database to ensure they still exist
	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	// Convert to protobuf user
	pbUser := s.modelToProtoUser(user)

	return pbUser, nil
}

// RefreshToken refreshes an access token
func (s *AuthService) RefreshToken(ctx context.Context, req *authv1.RefreshTokenRequest) (*authv1.LoginResponse, error) {
	if req.RefreshToken == "" {
		return nil, status.Errorf(codes.InvalidArgument, "refresh token is required")
	}

	// Validate refresh token
	claims, err := auth.ValidateToken(req.RefreshToken)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid refresh token: %v", err)
	}

	// Get user from database to ensure they still exist
	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	// Generate new access token
	newAccessToken, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.Profile.Name)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate new access token")
	}

	// Generate new refresh token
	newRefreshToken, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.Profile.Name)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate new refresh token")
	}

	// Convert to protobuf user
	pbUser := s.modelToProtoUser(user)

	return &authv1.LoginResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		User:         pbUser,
		ExpiresIn:    3600,
	}, nil
}

// Logout invalidates tokens
func (s *AuthService) Logout(ctx context.Context, req *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
	// For now, we'll just validate the token to ensure it's valid
	// In a production system, you would add the token to a blacklist
	if req.Token != "" {
		_, err := auth.ValidateToken(req.Token)
		if err != nil {
			return nil, status.Errorf(codes.Unauthenticated, "invalid token")
		}
	}

	// TODO: Implement token blacklisting in a production system
	// This could involve storing blacklisted tokens in Redis or database
	// with their expiration times

	return &authv1.LogoutResponse{
		Success: true,
	}, nil
}

// modelToProtoUser converts a models.User to authv1.User
func (s *AuthService) modelToProtoUser(user *models.User) *authv1.User {
	var role authv1.UserRole
	switch user.Role {
	case models.UserRoleAdmin:
		role = authv1.UserRole_USER_ROLE_ADMIN
	case models.UserRoleEditor:
		role = authv1.UserRole_USER_ROLE_EDITOR
	default:
		role = authv1.UserRole_USER_ROLE_UNSPECIFIED
	}

	return &authv1.User{
		Id:    user.ID,
		Email: user.Email,
		Role:  role,
		Profile: &authv1.UserProfile{
			Name:   user.Profile.Name,
			Avatar: user.Profile.Avatar,
		},
		CreatedAt: timestamppb.New(user.CreatedAt),
		LastLogin: timestamppb.New(user.LastLogin),
	}
}
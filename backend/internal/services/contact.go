package services

import (
	"context"
	"fmt"
	"net/mail"
	"strconv"
	"strings"

	contactv1 "github.com/saas-startup-platform/backend/gen/contact/v1"
	"github.com/saas-startup-platform/backend/internal/models"
	"github.com/saas-startup-platform/backend/internal/repository"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ContactService struct {
	contactv1.UnimplementedContactServiceServer
	contactRepo  repository.ContactRepository
	emailService *EmailService
}

func NewContactService(contactRepo repository.ContactRepository, emailService *EmailService) *ContactService {
	return &ContactService{
		contactRepo:  contactRepo,
		emailService: emailService,
	}
}

// SubmitContactForm handles contact form submissions
func (s *ContactService) SubmitContactForm(ctx context.Context, req *contactv1.SubmitContactFormRequest) (*contactv1.ContactSubmission, error) {
	// Validate input
	if err := s.validateContactFormRequest(req); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "validation failed: %v", err)
	}

	// Basic spam protection - check for suspicious patterns
	if s.isSpamSubmission(req) {
		return nil, status.Errorf(codes.InvalidArgument, "submission rejected")
	}

	// Extract client information from context
	ipAddress, userAgent := s.extractClientInfo(ctx)

	// Create contact submission
	submission := models.NewContactSubmission(
		req.Name,
		req.Email,
		req.Company,
		req.Message,
		ipAddress,
		userAgent,
	)

	// Save to database
	createdSubmission, err := s.contactRepo.CreateContactSubmission(ctx, submission)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create contact submission: %v", err)
	}

	// Send email notifications asynchronously
	go func() {
		// Send notification to admin
		if err := s.emailService.SendContactNotification(createdSubmission); err != nil {
			fmt.Printf("Failed to send admin notification email: %v\n", err)
		}
		
		// Send confirmation to submitter
		if err := s.emailService.SendContactConfirmation(createdSubmission); err != nil {
			fmt.Printf("Failed to send confirmation email: %v\n", err)
		}
	}()

	// Convert to protobuf response
	return s.modelToProto(createdSubmission), nil
}

// ListContactSubmissions lists contact submissions (admin only)
func (s *ContactService) ListContactSubmissions(ctx context.Context, req *contactv1.ListContactSubmissionsRequest) (*contactv1.ListContactSubmissionsResponse, error) {
	// TODO: Add authentication check for admin role

	// Parse pagination
	pageSize := int(req.PageSize)
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 50
	}

	skip := 0
	if req.PageToken != "" {
		var err error
		skip, err = strconv.Atoi(req.PageToken)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
	}

	// Build list options
	opts := repository.ListOptions{
		Limit:  pageSize,
		Skip:   skip,
		Search: req.Search,
	}

	// Convert status filter
	if req.Status != contactv1.ContactStatus_CONTACT_STATUS_UNSPECIFIED {
		opts.Status = s.protoStatusToModel(req.Status)
	}

	// Get submissions from repository
	submissions, paginationInfo, err := s.contactRepo.ListContactSubmissions(ctx, opts)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list contact submissions: %v", err)
	}

	// Convert to protobuf response
	protoSubmissions := make([]*contactv1.ContactSubmission, len(submissions))
	for i, submission := range submissions {
		protoSubmissions[i] = s.modelToProto(submission)
	}

	response := &contactv1.ListContactSubmissionsResponse{
		Submissions: protoSubmissions,
		TotalCount:  int32(paginationInfo.TotalCount),
	}

	if paginationInfo.HasMore {
		response.NextPageToken = paginationInfo.NextPageToken
	}

	return response, nil
}

// GetContactSubmission gets a specific contact submission (admin only)
func (s *ContactService) GetContactSubmission(ctx context.Context, req *contactv1.GetContactSubmissionRequest) (*contactv1.ContactSubmission, error) {
	// TODO: Add authentication check for admin role

	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "id is required")
	}

	submission, err := s.contactRepo.GetContactSubmission(ctx, req.Id)
	if err != nil {
		if err == repository.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "contact submission not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get contact submission: %v", err)
	}

	return s.modelToProto(submission), nil
}

// MarkContactSubmissionAsRead marks a contact submission as read (admin only)
func (s *ContactService) MarkContactSubmissionAsRead(ctx context.Context, req *contactv1.MarkContactSubmissionAsReadRequest) (*contactv1.ContactSubmission, error) {
	// TODO: Add authentication check for admin role

	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "id is required")
	}

	// Get existing submission
	submission, err := s.contactRepo.GetContactSubmission(ctx, req.Id)
	if err != nil {
		if err == repository.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "contact submission not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get contact submission: %v", err)
	}

	// Mark as read
	submission.MarkAsRead()

	// Update in database
	updatedSubmission, err := s.contactRepo.UpdateContactSubmission(ctx, submission)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update contact submission: %v", err)
	}

	return s.modelToProto(updatedSubmission), nil
}

// DeleteContactSubmission deletes a contact submission (admin only)
func (s *ContactService) DeleteContactSubmission(ctx context.Context, req *contactv1.DeleteContactSubmissionRequest) (*emptypb.Empty, error) {
	// TODO: Add authentication check for admin role

	if req.Id == "" {
		return nil, status.Errorf(codes.InvalidArgument, "id is required")
	}

	// Get existing submission to get revision
	submission, err := s.contactRepo.GetContactSubmission(ctx, req.Id)
	if err != nil {
		if err == repository.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "contact submission not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get contact submission: %v", err)
	}

	// Delete from database
	if err := s.contactRepo.DeleteContactSubmission(ctx, submission.ID, submission.Rev); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete contact submission: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// validateContactFormRequest validates the contact form request
func (s *ContactService) validateContactFormRequest(req *contactv1.SubmitContactFormRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("name is required")
	}

	if strings.TrimSpace(req.Email) == "" {
		return fmt.Errorf("email is required")
	}

	// Validate email format
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return fmt.Errorf("invalid email format")
	}

	if strings.TrimSpace(req.Message) == "" {
		return fmt.Errorf("message is required")
	}

	// Check message length
	if len(req.Message) > 5000 {
		return fmt.Errorf("message too long (max 5000 characters)")
	}

	return nil
}

// isSpamSubmission performs basic spam detection
func (s *ContactService) isSpamSubmission(req *contactv1.SubmitContactFormRequest) bool {
	// Check for suspicious patterns
	suspiciousPatterns := []string{
		"http://",
		"https://",
		"www.",
		"<a href",
		"<script",
		"viagra",
		"casino",
		"lottery",
		"winner",
		"congratulations",
	}

	message := strings.ToLower(req.Message)
	name := strings.ToLower(req.Name)
	
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(message, pattern) || strings.Contains(name, pattern) {
			return true
		}
	}

	// Check for excessive repetition
	words := strings.Fields(message)
	if len(words) > 10 {
		wordCount := make(map[string]int)
		for _, word := range words {
			wordCount[word]++
			if wordCount[word] > 5 {
				return true
			}
		}
	}

	return false
}

// extractClientInfo extracts IP address and user agent from context
func (s *ContactService) extractClientInfo(ctx context.Context) (string, string) {
	// Try to get from HTTP headers if available
	if md, ok := ctx.Value("metadata").(map[string]string); ok {
		ipAddress := md["x-forwarded-for"]
		if ipAddress == "" {
			ipAddress = md["x-real-ip"]
		}
		if ipAddress == "" {
			ipAddress = md["remote-addr"]
		}
		
		userAgent := md["user-agent"]
		
		return ipAddress, userAgent
	}

	return "", ""
}



// modelToProto converts a contact submission model to protobuf
func (s *ContactService) modelToProto(submission *models.ContactSubmission) *contactv1.ContactSubmission {
	return &contactv1.ContactSubmission{
		Id:        submission.ID,
		Name:      submission.Name,
		Email:     submission.Email,
		Company:   submission.Company,
		Message:   submission.Message,
		IpAddress: submission.IPAddress,
		UserAgent: submission.UserAgent,
		Status:    s.modelStatusToProto(submission.Status),
		CreatedAt: timestamppb.New(submission.CreatedAt),
		UpdatedAt: timestamppb.New(submission.UpdatedAt),
	}
}

// modelStatusToProto converts model status to protobuf status
func (s *ContactService) modelStatusToProto(status string) contactv1.ContactStatus {
	switch status {
	case models.ContactStatusNew:
		return contactv1.ContactStatus_CONTACT_STATUS_NEW
	case models.ContactStatusRead:
		return contactv1.ContactStatus_CONTACT_STATUS_READ
	case models.ContactStatusReplied:
		return contactv1.ContactStatus_CONTACT_STATUS_REPLIED
	case models.ContactStatusSpam:
		return contactv1.ContactStatus_CONTACT_STATUS_SPAM
	default:
		return contactv1.ContactStatus_CONTACT_STATUS_UNSPECIFIED
	}
}

// protoStatusToModel converts protobuf status to model status
func (s *ContactService) protoStatusToModel(status contactv1.ContactStatus) string {
	switch status {
	case contactv1.ContactStatus_CONTACT_STATUS_NEW:
		return models.ContactStatusNew
	case contactv1.ContactStatus_CONTACT_STATUS_READ:
		return models.ContactStatusRead
	case contactv1.ContactStatus_CONTACT_STATUS_REPLIED:
		return models.ContactStatusReplied
	case contactv1.ContactStatus_CONTACT_STATUS_SPAM:
		return models.ContactStatusSpam
	default:
		return models.ContactStatusNew
	}
}
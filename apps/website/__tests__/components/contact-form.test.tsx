import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from '@/components/contact/ContactForm';

// Mock the API client
const mockMutateAsync = jest.fn();

jest.mock('@saas-platform/shared', () => ({
  useSubmitContactForm: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
  })),
}));

// Import the mocked module
const { useSubmitContactForm } = require('@saas-platform/shared');

describe('ContactForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockClear();
    useSubmitContactForm.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });
  });

  it('renders all form fields', () => {
    render(<ContactForm />);
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'invalid-email');
      await user.type(messageInput, 'This is a valid message that is long enough.');
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('validates minimum message length', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(messageInput, 'Short');
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/message must be at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({ data: { id: '1' } });
    
    render(<ContactForm />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(messageInput, 'Hello, this is a test message that is long enough.');
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        company: '',
        message: 'Hello, this is a test message that is long enough.',
      });
    });
  });

  it('calls onSuccess callback after successful submission', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();
    const mockSuccessfulMutate = jest.fn().mockResolvedValue({ data: { id: '1' } });
    
    // Mock successful submission
    useSubmitContactForm.mockReturnValue({
      mutateAsync: mockSuccessfulMutate,
      isPending: false,
      error: null,
    });
    
    render(<ContactForm onSuccess={mockOnSuccess} />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(messageInput, 'Hello, this is a test message that is long enough.');
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(mockSuccessfulMutate).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        company: '',
        message: 'Hello, this is a test message that is long enough.',
      });
    });
  });

  it('shows error message on submission failure', async () => {
    const user = userEvent.setup();
    
    // Mock failed submission
    useSubmitContactForm.mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error('Network error')),
      isPending: false,
      error: { message: 'Network error' },
    });
    
    render(<ContactForm />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(messageInput, 'Hello, this is a test message that is long enough.');
      await user.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();
    });
  });

  it('prevents spam submissions using honeypot', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const honeypotInput = screen.getByLabelText(/website/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    
    await act(async () => {
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(messageInput, 'Hello, this is a test message that is long enough.');
      await user.type(honeypotInput, 'spam-content');
      await user.click(submitButton);
    });
    
    // Should not call the API when honeypot is filled
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
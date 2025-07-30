import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageEditorForm } from '@/components/editor/page-editor-form';

// Mock the API client
jest.mock('@saas-platform/shared', () => ({
  useCreatePageMutation: () => ({
    mutate: jest.fn(),
    isLoading: false,
    error: null,
  }),
  useUpdatePageMutation: () => ({
    mutate: jest.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock TipTap editor
jest.mock('@tiptap/react', () => ({
  useEditor: () => ({
    getHTML: () => '<p>Test content</p>',
    commands: {
      setContent: jest.fn(),
    },
  }),
  EditorContent: ({ editor }: any) => <div data-testid="editor-content">Editor</div>,
}));

describe('PageEditorForm', () => {
  it('renders form fields for new page', () => {
    render(<PageEditorForm />);
    
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save page/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm />);
    
    const saveButton = screen.getByRole('button', { name: /save page/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('auto-generates slug from title', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm />);
    
    const titleInput = screen.getByLabelText(/title/i);
    const slugInput = screen.getByLabelText(/slug/i);
    
    await user.type(titleInput, 'My New Page');
    
    await waitFor(() => {
      expect(slugInput).toHaveValue('my-new-page');
    });
  });

  it('allows manual slug editing', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm />);
    
    const slugInput = screen.getByLabelText(/slug/i);
    
    await user.clear(slugInput);
    await user.type(slugInput, 'custom-slug');
    
    expect(slugInput).toHaveValue('custom-slug');
  });

  it('shows loading state during save', () => {
    // Mock loading state
    jest.doMock('@saas-platform/shared', () => ({
      useCreatePageMutation: () => ({
        mutate: jest.fn(),
        isLoading: true,
        error: null,
      }),
    }));
    
    render(<PageEditorForm />);
    
    const saveButton = screen.getByRole('button', { name: /saving/i });
    expect(saveButton).toBeDisabled();
  });
});
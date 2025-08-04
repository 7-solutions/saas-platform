import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageEditorForm } from '@/components/editor/page-editor-form';

// Mock the API client
const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();

jest.mock('@saas-platform/shared', () => ({
  useCreatePageMutation: jest.fn(() => ({
    mutate: mockCreateMutate,
    isLoading: false,
    error: null,
  })),
  useUpdatePageMutation: jest.fn(() => ({
    mutate: mockUpdateMutate,
    isLoading: false,
    error: null,
  })),
}));

// Mock TipTap editor
const mockEditor = {
  getHTML: jest.fn(() => '<p>Test content</p>'),
  commands: {
    setContent: jest.fn(),
  },
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
};

jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => mockEditor),
  EditorContent: ({ editor }: any) => <div data-testid="editor-content">Editor</div>,
}));

// Mock TipTap extensions
jest.mock('@tiptap/starter-kit', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@tiptap/extension-image', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@tiptap/extension-link', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('PageEditorForm', () => {
  const mockProps = {
    onSave: jest.fn(),
    onPreview: jest.fn(),
    onImageUpload: jest.fn().mockResolvedValue('http://example.com/image.jpg'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateMutate.mockClear();
    mockUpdateMutate.mockClear();
    mockProps.onSave.mockClear();
    mockProps.onPreview.mockClear();
    mockProps.onImageUpload.mockClear();
  });

  it('renders form fields for new page', () => {
    render(<PageEditorForm {...mockProps} />);
    
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save page/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm {...mockProps} />);
    
    const saveButton = screen.getByRole('button', { name: /save page/i });
    
    await act(async () => {
      await user.click(saveButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('auto-generates slug from title', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm {...mockProps} />);
    
    const titleInput = screen.getByLabelText(/title/i);
    const slugInput = screen.getByLabelText(/slug/i);
    
    await act(async () => {
      await user.type(titleInput, 'My New Page');
    });
    
    await waitFor(() => {
      expect(slugInput).toHaveValue('my-new-page');
    });
  });

  it('allows manual slug editing', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm {...mockProps} />);
    
    const slugInput = screen.getByLabelText(/slug/i);
    
    await act(async () => {
      await user.clear(slugInput);
      await user.type(slugInput, 'custom-slug');
    });
    
    expect(slugInput).toHaveValue('custom-slug');
  });

  it('renders existing page data when editing', () => {
    const existingPage = {
      id: '1',
      title: 'Existing Page',
      slug: 'existing-page',
      content: '<p>Existing content</p>',
      status: 'published' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<PageEditorForm {...mockProps} page={existingPage} />);
    
    expect(screen.getByDisplayValue('Existing Page')).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update page/i })).toBeInTheDocument();
  });

  it('calls onSave when form is submitted with valid data', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm {...mockProps} />);
    
    const titleInput = screen.getByLabelText(/title/i);
    const saveButton = screen.getByRole('button', { name: /save page/i });
    
    await act(async () => {
      await user.type(titleInput, 'Test Page');
      await user.click(saveButton);
    });
    
    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Page',
          slug: 'test-page',
          content: '<p>Test content</p>',
        })
      );
    });
  });

  it('calls onPreview when preview button is clicked', async () => {
    const user = userEvent.setup();
    render(<PageEditorForm {...mockProps} />);
    
    const titleInput = screen.getByLabelText(/title/i);
    const previewButton = screen.getByRole('button', { name: /preview/i });
    
    await act(async () => {
      await user.type(titleInput, 'Test Page');
      await user.click(previewButton);
    });
    
    expect(mockProps.onPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Page',
        slug: 'test-page',
        content: '<p>Test content</p>',
      })
    );
  });
});
# API Client Documentation

This package provides a comprehensive TypeScript API client for the SaaS platform, built on top of gRPC Gateway REST endpoints with React Query integration.

## Features

- ✅ **Type-safe API client** with generated TypeScript types
- ✅ **Authentication token management** with automatic refresh
- ✅ **Request/response interceptors** for error handling and logging
- ✅ **React Query hooks** for data fetching and caching
- ✅ **Comprehensive error handling** with custom error types
- ✅ **Retry logic** for failed requests
- ✅ **React Provider** for easy integration

## Quick Start

### 1. Setup the API Provider

Wrap your app with the `ApiProvider`:

```tsx
import { ApiProvider } from '@saas-platform/shared';

function App() {
  return (
    <ApiProvider
      config={{
        baseUrl: process.env.NEXT_PUBLIC_API_URL,
        onTokenRefresh: (tokens) => {
          console.log('Tokens refreshed:', tokens);
        },
        onAuthError: () => {
          console.log('Authentication error');
        },
      }}
    >
      <YourAppContent />
    </ApiProvider>
  );
}
```

### 2. Use Authentication

```tsx
import { useAuth, useLogin } from '@saas-platform/shared';

function LoginForm() {
  const { isAuthenticated, logout } = useAuth();
  const loginMutation = useLogin();

  const handleLogin = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({ email, password });
    if (result.data) {
      console.log('Login successful:', result.data.user);
    }
  };

  if (isAuthenticated) {
    return <button onClick={logout}>Logout</button>;
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      handleLogin(formData.get('email'), formData.get('password'));
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 3. Fetch Data with React Query Hooks

```tsx
import { usePages, useCreatePage } from '@saas-platform/shared';

function PagesList() {
  const { data: pagesResponse, isLoading, error } = usePages({
    status: 'PAGE_STATUS_PUBLISHED',
    page_size: 10,
  });

  const createPageMutation = useCreatePage();

  const handleCreatePage = async () => {
    const result = await createPageMutation.mutateAsync({
      title: 'New Page',
      slug: 'new-page',
      content: { blocks: [] },
      meta: { title: 'New Page', description: 'A new page', keywords: [] },
      status: 'PAGE_STATUS_DRAFT',
    });
    
    if (result.data) {
      console.log('Page created:', result.data);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={handleCreatePage}>Create Page</button>
      <ul>
        {pagesResponse?.data?.pages.map(page => (
          <li key={page.id}>{page.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API Client Usage

### Direct API Client Usage

If you need to use the API client directly without React Query:

```tsx
import { createApiClient, handleApiResponse } from '@saas-platform/shared';

const client = createApiClient({
  baseUrl: 'http://localhost:8080',
  onTokenRefresh: (tokens) => {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  },
});

// Set tokens if available
const accessToken = localStorage.getItem('access_token');
const refreshToken = localStorage.getItem('refresh_token');
if (accessToken && refreshToken) {
  client.setTokens(accessToken, refreshToken);
}

// Make API calls
const response = await client.get('/api/v1/pages');
const data = await handleApiResponse(response);
```

### Error Handling

The API client provides comprehensive error handling:

```tsx
import { 
  handleApiResponse, 
  ApiResponseError, 
  isApiError 
} from '@saas-platform/shared';

try {
  const response = await client.post('/api/v1/pages', pageData);
  const page = await handleApiResponse(response);
  console.log('Page created:', page);
} catch (error) {
  if (error instanceof ApiResponseError) {
    if (error.isValidationError()) {
      const fieldErrors = error.getFieldErrorsMap();
      console.log('Validation errors:', fieldErrors);
    } else if (error.isAuthError()) {
      console.log('Authentication error:', error.message);
    } else {
      console.log('API error:', error.code, error.message);
    }
  }
}
```

### Retry Logic

For operations that might fail due to network issues:

```tsx
import { createRetryFunction } from '@saas-platform/shared';

const retryableApiCall = createRetryFunction(
  () => client.get('/api/v1/pages'),
  {
    maxRetries: 3,
    retryDelay: 1000,
    shouldRetry: (error) => !error.isAuthError(),
  }
);

const response = await retryableApiCall();
```

## Available Hooks

### Authentication Hooks

- `useLogin()` - Login mutation
- `useLogout()` - Logout mutation
- `useAuth()` - Authentication state and actions
- `useCurrentUser()` - Current user data

### Content Hooks

- `usePages(filters?)` - List pages with optional filters
- `usePage(id)` - Get single page by ID
- `useCreatePage()` - Create page mutation
- `useUpdatePage()` - Update page mutation
- `useDeletePage()` - Delete page mutation
- `usePublishedPages()` - List only published pages
- `useDraftPages()` - List only draft pages

### Media Hooks

- `useMediaFiles(filters?)` - List media files
- `useMediaFile(id)` - Get single media file
- `useUploadFile()` - Upload file mutation
- `useUpdateMediaFile()` - Update media file mutation
- `useDeleteMediaFile()` - Delete media file mutation
- `useImageFiles()` - List only image files

## Type Safety

All API responses are fully typed:

```tsx
import type { 
  Page, 
  MediaFile, 
  User, 
  ApiResponse,
  CreatePageRequest 
} from '@saas-platform/shared';

// TypeScript will enforce correct types
const createPageData: CreatePageRequest = {
  title: 'My Page',
  slug: 'my-page',
  content: { blocks: [] },
  meta: { title: 'My Page', description: 'Description', keywords: [] },
  status: 'PAGE_STATUS_DRAFT', // TypeScript will validate this enum
};
```

## Configuration Options

### ApiClientConfig

```tsx
interface ApiClientConfig {
  baseUrl: string;
  onTokenRefresh?: (tokens: { access_token: string; refresh_token: string }) => void;
  onAuthError?: () => void;
  onRequestStart?: (url: string, options: RequestInit) => void;
  onRequestEnd?: (url: string, response: Response) => void;
  onError?: (error: ApiError, url: string) => void;
}
```

### Query Client Configuration

You can provide your own React Query client:

```tsx
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
    },
  },
});

<ApiProvider queryClient={queryClient}>
  <App />
</ApiProvider>
```

## Testing

The API client is fully tested with comprehensive unit tests. When testing components that use the API hooks, you can mock the API client:

```tsx
import { setApiClient } from '@saas-platform/shared';
import { vi } from 'vitest';

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  login: vi.fn(),
} as any;

setApiClient(mockApiClient);
```

## Best Practices

1. **Always use the ApiProvider** at the root of your application
2. **Handle loading and error states** in your components
3. **Use the utility functions** like `handleApiResponse` for consistent error handling
4. **Leverage React Query's caching** by using the provided hooks
5. **Use TypeScript** to catch type errors at compile time
6. **Implement proper error boundaries** for unhandled errors
7. **Use the retry functionality** for network-sensitive operations

## Migration Guide

If you're migrating from a different API client, here are the key changes:

1. Replace direct fetch calls with the provided hooks
2. Update error handling to use `ApiResponseError`
3. Use the `ApiProvider` instead of manual client setup
4. Leverage React Query's caching and background updates
5. Update TypeScript types to use the generated API types
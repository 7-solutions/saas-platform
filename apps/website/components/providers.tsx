'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { createApiClient, defaultApiClientConfig, setApiClient, initializeErrorLogger } from '@saas-platform/shared';
import { ErrorBoundary } from '@saas-platform/ui';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            retry: (failureCount: number, error: any) => {
              // Don't retry on 404s
              if (error?.status === 404) return false;
              // Retry up to 3 times for other errors
              return failureCount < 3;
            },
          },
        },
      })
  );

  // Initialize API client and error logger for client-side usage
  useState(() => {
    const apiClient = createApiClient({
      ...defaultApiClientConfig,
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    });
    
    setApiClient(apiClient);

    // Initialize error logger
    initializeErrorLogger({
      apiUrl: '/api/v1/errors/report',
      enableConsoleLog: process.env.NODE_ENV === 'development',
    });
  });

  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('Website Error Boundary:', error, errorInfo);
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
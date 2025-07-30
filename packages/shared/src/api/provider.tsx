import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClient, createApiClient, defaultApiClientConfig, type ApiClientConfig } from './client';
import { setApiClient } from './hooks';

interface ApiProviderProps {
  children: React.ReactNode;
  config?: Partial<ApiClientConfig>;
  queryClient?: QueryClient;
}

interface ApiContextValue {
  client: ApiClient;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children, config = {}, queryClient }: ApiProviderProps) {
  const [client] = useState(() => {
    const finalConfig = { ...defaultApiClientConfig, ...config } as ApiClientConfig;
    return createApiClient(finalConfig);
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [defaultQueryClient] = useState(() => 
    queryClient || new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failureCount, error: any) => {
            // Don't retry on auth errors
            if (error?.response?.status === 401) {
              return false;
            }
            return failureCount < 3;
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        },
        mutations: {
          retry: false,
        },
      },
    })
  );

  useEffect(() => {
    // Set the API client for hooks
    setApiClient(client);

    // Check for existing tokens on mount
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (accessToken && refreshToken) {
        client.setTokens(accessToken, refreshToken);
        setIsAuthenticated(true);
      }
    }
  }, [client]);

  const login = (accessToken: string, refreshToken: string) => {
    client.setTokens(accessToken, refreshToken);
    setIsAuthenticated(true);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
  };

  const logout = () => {
    client.clearTokens();
    setIsAuthenticated(false);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    
    // Clear all cached data
    defaultQueryClient.clear();
  };

  const contextValue: ApiContextValue = {
    client,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <ApiContext.Provider value={contextValue}>
      <QueryClientProvider client={defaultQueryClient}>
        {children}
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApiContext(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider');
  }
  return context;
}

// Convenience hook for authentication state
export function useAuth() {
  const { isAuthenticated, login, logout } = useApiContext();
  return { isAuthenticated, login, logout };
}
import React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { ApiClient, type ApiClientConfig } from './client';
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
export declare function ApiProvider({ children, config, queryClient }: ApiProviderProps): React.JSX.Element;
export declare function useApiContext(): ApiContextValue;
export declare function useAuth(): {
    isAuthenticated: boolean;
    login: (accessToken: string, refreshToken: string) => void;
    logout: () => void;
};
export {};
//# sourceMappingURL=provider.d.ts.map
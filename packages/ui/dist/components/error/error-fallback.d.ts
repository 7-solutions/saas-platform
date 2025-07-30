import React from 'react';
interface ErrorFallbackProps {
    error?: Error;
    resetError?: () => void;
    title?: string;
    description?: string;
    showHomeButton?: boolean;
    showRetryButton?: boolean;
    showDetails?: boolean;
}
export declare function ErrorFallback({ error, resetError, title, description, showHomeButton, showRetryButton, showDetails, }: ErrorFallbackProps): React.JSX.Element;
export declare function NetworkErrorFallback({ resetError }: {
    resetError?: () => void;
}): React.JSX.Element;
export declare function NotFoundErrorFallback(): React.JSX.Element;
export declare function UnauthorizedErrorFallback(): React.JSX.Element;
export declare function ServerErrorFallback({ resetError }: {
    resetError?: () => void;
}): React.JSX.Element;
export {};
//# sourceMappingURL=error-fallback.d.ts.map
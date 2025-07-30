'use client';
import React from 'react';
import { Button } from '../ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
export function ErrorFallback({ error, resetError, title = 'Something went wrong', description = "We're sorry, but something unexpected happened. Please try again.", showHomeButton = true, showRetryButton = true, showDetails = false, }) {
    const handleGoHome = () => {
        window.location.href = '/';
    };
    const handleReload = () => {
        window.location.reload();
    };
    return (<div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full mx-auto text-center">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-6"/>
        
        <h1 className="text-3xl font-bold text-foreground mb-4">
          {title}
        </h1>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {description}
        </p>

        <div className="space-y-3 mb-6">
          {showRetryButton && resetError && (<Button onClick={resetError} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4"/>
              Try Again
            </Button>)}
          
          {showRetryButton && !resetError && (<Button onClick={handleReload} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4"/>
              Reload Page
            </Button>)}
          
          {showHomeButton && (<Button variant="outline" onClick={handleGoHome} className="w-full">
              <Home className="mr-2 h-4 w-4"/>
              Go Home
            </Button>)}
        </div>

        {showDetails && error && (<details className="text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
              Technical Details
            </summary>
            <div className="p-4 bg-muted rounded-lg text-xs font-mono text-left">
              <div className="mb-3">
                <strong className="text-foreground">Error:</strong>
                <div className="mt-1 text-destructive">{error.message}</div>
              </div>
              
              {error.stack && (<div>
                  <strong className="text-foreground">Stack Trace:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-muted-foreground overflow-x-auto">
                    {error.stack}
                  </pre>
                </div>)}
            </div>
          </details>)}
      </div>
    </div>);
}
// Specific error fallbacks for different scenarios
export function NetworkErrorFallback({ resetError }) {
    return (<ErrorFallback title="Connection Problem" description="We're having trouble connecting to our servers. Please check your internet connection and try again." resetError={resetError} showHomeButton={false}/>);
}
export function NotFoundErrorFallback() {
    return (<ErrorFallback title="Page Not Found" description="The page you're looking for doesn't exist or has been moved." showRetryButton={false}/>);
}
export function UnauthorizedErrorFallback() {
    return (<ErrorFallback title="Access Denied" description="You don't have permission to access this page. Please log in or contact an administrator." showRetryButton={false}/>);
}
export function ServerErrorFallback({ resetError }) {
    return (<ErrorFallback title="Server Error" description="Our servers are experiencing issues. We're working to fix this as quickly as possible." resetError={resetError} showHomeButton={false}/>);
}

'use client';

import { useEffect } from 'react';
import { Button } from '@saas-platform/ui';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to external service
    console.error('Website error:', error);
    
    // Report error to backend
    if (typeof window !== 'undefined') {
      fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'website_error',
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto text-center p-6">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-6" />
        
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Something went wrong
        </h1>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          We encountered an unexpected error. Our team has been notified and is working to fix this issue.
        </p>

        <div className="space-y-4">
          <Button onClick={reset} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Error Details (Development)
            </summary>
            <div className="mt-2 p-4 bg-muted rounded-lg text-xs font-mono">
              <div className="mb-2">
                <strong>Message:</strong> {error.message}
              </div>
              {error.digest && (
                <div className="mb-2">
                  <strong>Digest:</strong> {error.digest}
                </div>
              )}
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap mt-1 text-destructive">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
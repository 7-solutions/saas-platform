'use client';
import React, { Component } from 'react';
import { Button } from '../ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }
    componentDidCatch(error, errorInfo) {
        this.setState({
            error,
            errorInfo,
        });
        // Log error to external service
        this.logError(error, errorInfo);
        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }
    logError = (error, errorInfo) => {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error Boundary caught an error:', error);
            console.error('Error Info:', errorInfo);
        }
        // Send to error reporting service
        if (typeof window !== 'undefined') {
            try {
                // Store error in localStorage for debugging
                const errorData = {
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                };
                const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
                existingErrors.push(errorData);
                // Keep only last 10 errors
                if (existingErrors.length > 10) {
                    existingErrors.splice(0, existingErrors.length - 10);
                }
                localStorage.setItem('error_logs', JSON.stringify(existingErrors));
                // Send to external error reporting service
                this.reportError(errorData);
            }
            catch (loggingError) {
                console.error('Failed to log error:', loggingError);
            }
        }
    };
    reportError = async (errorData) => {
        try {
            // Send to backend error reporting endpoint
            await fetch('/api/v1/errors/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'client_error',
                    ...errorData,
                }),
            });
        }
        catch (reportingError) {
            console.error('Failed to report error:', reportingError);
        }
    };
    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };
    handleReload = () => {
        window.location.reload();
    };
    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // Default error UI
            return (<div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full mx-auto p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4"/>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Something went wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                We're sorry, but something unexpected happened. Please try again.
              </p>

              <div className="space-y-3">
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4"/>
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleReload} className="w-full">
                  Reload Page
                </Button>
              </div>

              {this.props.showDetails && this.state.error && (<details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (<div className="mb-2">
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1">
                          {this.state.error.stack}
                        </pre>
                      </div>)}
                    {this.state.errorInfo?.componentStack && (<div>
                        <strong>Component Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>)}
                  </div>
                </details>)}
            </div>
          </div>
        </div>);
        }
        return this.props.children;
    }
}
// Hook for functional components to trigger error boundary
export const useErrorHandler = () => {
    const [, setState] = React.useState();
    return React.useCallback((error) => {
        setState(() => {
            throw error;
        });
    }, []);
};
// Higher-order component for wrapping components with error boundary
export function withErrorBoundary(Component, errorBoundaryProps) {
    const WrappedComponent = (props) => (<ErrorBoundary {...errorBoundaryProps}>
      <Component {...props}/>
    </ErrorBoundary>);
    WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
    return WrappedComponent;
}

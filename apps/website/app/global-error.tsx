'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error
    console.error('Global error:', error);
    
    // Report critical error to backend
    if (typeof window !== 'undefined') {
      fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'global_error',
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          critical: true,
        }),
      }).catch(console.error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#fafafa',
          padding: '1rem',
        }}>
          <div style={{
            maxWidth: '400px',
            textAlign: 'center',
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
            }}>⚠️</div>
            
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#1f2937',
            }}>
              Critical Error
            </h1>
            
            <p style={{
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.5',
            }}>
              A critical error occurred that prevented the application from loading. 
              Please refresh the page or contact support if the problem persists.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Go Home
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '2rem', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280' }}>
                  Error Details (Development)
                </summary>
                <div style={{
                  marginTop: '0.5rem',
                  padding: '1rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.digest && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Digest:</strong> {error.digest}
                    </div>
                  )}
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem', color: '#dc2626' }}>
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
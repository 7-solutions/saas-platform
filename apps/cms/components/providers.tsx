'use client'

import { SessionProvider } from 'next-auth/react'
import { ApiProvider, initializeErrorLogger } from '@saas-platform/shared'
import { ErrorBoundary } from '@saas-platform/ui'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize error logger
  useState(() => {
    if (typeof window !== 'undefined') {
      initializeErrorLogger({
        apiUrl: '/api/v1/errors/report',
        enableConsoleLog: process.env.NODE_ENV === 'development',
      });
    }
  });

  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('CMS Error Boundary:', error, errorInfo);
      }}
    >
      <SessionProvider>
        <ApiProvider>
          {children}
        </ApiProvider>
      </SessionProvider>
    </ErrorBoundary>
  )
}
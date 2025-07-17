'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId, setErrorId] = useState<string>('');
  
  useEffect(() => {
    // Generate a unique error ID for reference
    const uniqueErrorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    setErrorId(uniqueErrorId);
    
    // Log the error
    logger.error('Global error caught', {
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      errorId: uniqueErrorId,
    }, error, {
      globalError: true,
      digest: error.digest,
    });

    // Send to Sentry
    captureError(error, {
      source: 'global_error_boundary',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      digest: error.digest,
      errorId: uniqueErrorId,
    });
    
    // Add security measures - if this is a critical error, we might want to:
    // 1. Clear sensitive session data
    // 2. Force re-authentication for security-critical operations
    // 3. Block certain operations until the issue is resolved
    
    // For now, we'll just ensure we don't expose sensitive information
    
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Error - Direct Fan Platform</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* Add CSP headers to prevent XSS in error pages */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <div className="mt-4 text-center">
              <h1 className="text-lg font-medium text-gray-900">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
              {errorId && (
                <p className="mt-1 text-xs text-gray-400">
                  Error reference: {errorId}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col space-y-3">
              <button
                onClick={() => reset()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-label="Try again"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-label="Go to home page"
              >
                Go to Home Page
              </button>
            </div>

            {/* Only show error details in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap">{error.stack}</pre>
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
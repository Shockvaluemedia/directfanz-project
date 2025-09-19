'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to our logging service
    logger.error('Global error handler caught an unhandled error', {
      error: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className='min-h-screen flex items-center justify-center bg-gray-50'>
          <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center'>
            <div className='w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
              <svg
                className='w-6 h-6 text-red-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h1 className='text-xl font-semibold text-gray-900 mb-2'>Something went wrong!</h1>
            <p className='text-gray-600 mb-4'>
              We encountered an unexpected error. Our team has been notified.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className='text-left bg-gray-50 p-3 rounded border text-sm text-gray-700 mb-4'>
                <summary className='cursor-pointer font-medium'>
                  Error Details (Development Mode)
                </summary>
                <pre className='mt-2 whitespace-pre-wrap overflow-auto'>
                  {error.message}
                  {error.stack && '\n\n' + error.stack}
                  {error.digest && '\n\nDigest: ' + error.digest}
                </pre>
              </details>
            )}
            <div className='space-y-2'>
              <button
                onClick={reset}
                className='w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className='w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors'
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

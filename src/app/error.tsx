'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for monitoring
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-4 text-base text-gray-600">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-300">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

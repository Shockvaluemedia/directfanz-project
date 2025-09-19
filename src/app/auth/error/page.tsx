'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // Log the auth error
    logger.warn('Authentication error', {
      error,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
  }, [error]);

  // Map error codes to user-friendly messages
  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'CredentialsSignin':
        return 'Invalid email or password. Please try again.';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'EmailCreateAccount':
      case 'Callback':
        return 'There was a problem with your authentication provider. Please try again.';
      case 'OAuthAccountNotLinked':
        return 'To confirm your identity, sign in with the same account you used originally.';
      case 'EmailSignin':
        return 'The email could not be sent. Please try again later.';
      case 'SessionRequired':
        return 'Please sign in to access this page.';
      case 'AccessDenied':
        return 'You do not have permission to access this resource.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6'>
        <div className='flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full'>
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
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
            />
          </svg>
        </div>

        <div className='mt-4 text-center'>
          <h3 className='text-lg font-medium text-gray-900'>Authentication Error</h3>
          <p className='mt-2 text-sm text-gray-500'>{getErrorMessage(error)}</p>
        </div>

        <div className='mt-6 flex flex-col space-y-3'>
          <Link
            href='/auth/signin'
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          >
            Try Signing In Again
          </Link>

          <Link
            href='/'
            className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          >
            Go to Home Page
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6'>
        <div className='flex items-center justify-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600'></div>
        </div>
        <div className='mt-4 text-center'>
          <h3 className='text-lg font-medium text-gray-900'>Loading...</h3>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthErrorContent />
    </Suspense>
  );
}

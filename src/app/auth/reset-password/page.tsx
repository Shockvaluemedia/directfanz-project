'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

function responseError(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Unable to reset your password. Please request a new link.';
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This password reset link is invalid. Please request a new one.');
      return;
    }

    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(responseError(payload));
        return;
      }

      setIsComplete(true);
    } catch {
      setError('Unable to reset your password. Please request a new link.');
    } finally {
      setIsLoading(false);
    }
  }

  if (isComplete) {
    return (
      <div className='space-y-6 text-center'>
        <div
          className='border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 rounded-md'
          role='status'
        >
          Your password has been reset.
        </div>
        <Link href='/auth/signin' className='font-medium text-indigo-600 hover:text-indigo-500'>
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
      {error && (
        <div
          className='border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 rounded-md'
          role='alert'
        >
          {error}
        </div>
      )}

      <div className='rounded-md shadow-sm -space-y-px'>
        <div>
          <label htmlFor='password' className='sr-only'>
            New password
          </label>
          <input
            id='password'
            name='password'
            type='password'
            autoComplete='new-password'
            required
            minLength={8}
            maxLength={128}
            className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm'
            placeholder='New password'
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor='password-confirmation' className='sr-only'>
            Confirm new password
          </label>
          <input
            id='password-confirmation'
            name='password-confirmation'
            type='password'
            autoComplete='new-password'
            required
            minLength={8}
            maxLength={128}
            className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm'
            placeholder='Confirm new password'
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
          />
        </div>
      </div>

      <button
        type='submit'
        disabled={isLoading}
        className='w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        {isLoading ? 'Resetting...' : 'Reset password'}
      </button>
    </form>
  );
}

function LoadingFallback() {
  return <p className='text-center text-sm text-gray-600'>Loading...</p>;
}

export default function ResetPasswordPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h1 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Choose a new password
          </h1>
          <p className='mt-2 text-center text-sm text-gray-600'>
            <Link
              href='/auth/forgot-password'
              className='font-medium text-indigo-600 hover:text-indigo-500'
            >
              Request another link
            </Link>
          </p>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

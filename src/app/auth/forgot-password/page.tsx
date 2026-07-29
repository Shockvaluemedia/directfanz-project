'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const SUCCESS_MESSAGE =
  "If an account with that email exists, we've sent a password reset link.";

function responseError(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  return 'Unable to send a reset link. Please try again.';
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(responseError(payload));
        return;
      }

      setIsSubmitted(true);
    } catch {
      setError('Unable to send a reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h1 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Reset your password
          </h1>
          <p className='mt-2 text-center text-sm text-gray-600'>
            <Link href='/auth/signin' className='font-medium text-indigo-600 hover:text-indigo-500'>
              Return to sign in
            </Link>
          </p>
        </div>

        {isSubmitted ? (
          <div
            className='border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 rounded-md'
            role='status'
          >
            {SUCCESS_MESSAGE}
          </div>
        ) : (
          <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
            {error && (
              <div
                className='border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 rounded-md'
                role='alert'
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor='email' className='sr-only'>
                Email address
              </label>
              <input
                id='email'
                name='email'
                type='email'
                autoComplete='email'
                required
                maxLength={254}
                className='appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
                placeholder='Email address'
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>

            <button
              type='submit'
              disabled={isLoading}
              className='w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

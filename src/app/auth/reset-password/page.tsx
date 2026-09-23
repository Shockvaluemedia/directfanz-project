'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <Shell title='Invalid reset link'>
        <p className='text-center text-sm text-gray-600'>
          This link is missing its reset token. Request a new one to continue.
        </p>
        <p className='text-center text-sm'>
          <Link
            href='/auth/forgot-password'
            className='font-medium text-indigo-600 hover:text-indigo-500'
          >
            Request a new reset link
          </Link>
        </p>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell title='Password updated'>
        <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm text-center'>
          Your password has been reset. You can now sign in with your new password.
        </div>
        <p className='text-center text-sm'>
          <Link href='/auth/signin' className='font-medium text-indigo-600 hover:text-indigo-500'>
            Go to sign in
          </Link>
        </p>
      </Shell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSuccess(true);
      } else if (typeof data?.error === 'string') {
        setError(data.error);
      } else {
        setError('This reset link is invalid or has expired. Please request a new one.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Shell title='Choose a new password'>
      <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
        {error && (
          <div className='bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded'>
            {error}{' '}
            {error.toLowerCase().includes('expired') && (
              <Link href='/auth/forgot-password' className='underline font-medium'>
                Request a new link
              </Link>
            )}
          </div>
        )}

        <div className='rounded-md shadow-sm -space-y-px'>
          <div>
            <label htmlFor='newPassword' className='sr-only'>
              New password
            </label>
            <input
              id='newPassword'
              name='newPassword'
              type='password'
              autoComplete='new-password'
              required
              minLength={8}
              className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm'
              placeholder='New password (at least 8 characters)'
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor='confirmPassword' className='sr-only'>
              Confirm new password
            </label>
            <input
              id='confirmPassword'
              name='confirmPassword'
              type='password'
              autoComplete='new-password'
              required
              minLength={8}
              className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm'
              placeholder='Confirm new password'
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <div>
          <button
            type='submit'
            disabled={isLoading}
            className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isLoading ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function LoadingFallback() {
  return (
    <Shell title='Loading...'>
      <div className='flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600'></div>
      </div>
    </Shell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

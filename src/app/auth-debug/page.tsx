'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

export default function AuthDebugPage() {
  const { data: session, status } = useSession();

  return (
    <div className='min-h-screen bg-gray-50 p-8'>
      <div className='max-w-4xl mx-auto bg-white rounded-lg shadow p-6'>
        <h1 className='text-2xl font-bold mb-6 text-gray-900'>Authentication Debug</h1>
        
        <div className='space-y-6'>
          <div className='bg-gray-100 p-4 rounded'>
            <h2 className='font-semibold mb-2'>Session Status:</h2>
            <p className='font-mono text-sm'>
              Status: <span className='font-bold'>{status}</span>
            </p>
          </div>

          <div className='bg-gray-100 p-4 rounded'>
            <h2 className='font-semibold mb-2'>Session Data:</h2>
            <pre className='font-mono text-xs overflow-x-auto bg-white p-2 rounded border'>
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>

          <div className='bg-gray-100 p-4 rounded'>
            <h2 className='font-semibold mb-2'>User Info:</h2>
            {session?.user ? (
              <div className='space-y-1 text-sm'>
                <p><strong>Email:</strong> {session.user.email || 'Not available'}</p>
                <p><strong>Role:</strong> {session.user.role || 'Not available'}</p>
                <p><strong>ID:</strong> {session.user.id || 'Not available'}</p>
                <p><strong>Name:</strong> {session.user.name || 'Not available'}</p>
              </div>
            ) : (
              <p className='text-red-600'>No user data available</p>
            )}
          </div>

          <div className='bg-blue-50 p-4 rounded'>
            <h2 className='font-semibold mb-2 text-blue-900'>Next Steps:</h2>
            <div className='space-y-2 text-sm text-blue-800'>
              {status === 'loading' && (
                <p>⏳ Still loading session... This should not take long.</p>
              )}
              {status === 'unauthenticated' && (
                <div>
                  <p>🔒 You are not signed in.</p>
                  <a href="/auth/signin" className='inline-block mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'>
                    Sign In
                  </a>
                </div>
              )}
              {status === 'authenticated' && session?.user?.role !== 'ARTIST' && (
                <div>
                  <p>👤 You are signed in as a FAN. Upload requires ARTIST role.</p>
                  <p>You may need to create a new artist account.</p>
                </div>
              )}
              {status === 'authenticated' && session?.user?.role === 'ARTIST' && (
                <div>
                  <p>✅ Perfect! You're signed in as an ARTIST.</p>
                  <p>The upload pages should work for you.</p>
                </div>
              )}
            </div>
          </div>

          <div className='border-t pt-4'>
            <div className='flex space-x-4'>
              <a href="/auth/signin" className='bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700'>
                Sign In
              </a>
              <a href="/auth/signup" className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'>
                Sign Up as Artist
              </a>
              <a href="/upload-simple" className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'>
                Try Simple Upload
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
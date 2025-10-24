'use client';

import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function StripeRefreshPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refreshOnboarding = async () => {
      try {
        const response = await fetch('/api/artist/stripe/connect', {
          method: 'POST',
        });

        const result = await response.json();

        if (result.success && result.url) {
          // Redirect back to Stripe onboarding
          window.location.href = result.url;
        } else {
          setError(result.error || 'Failed to refresh onboarding');
        }
      } catch (err) {
        setError('Failed to refresh onboarding. Please try again.');
      }
    };

    refreshOnboarding();
  }, []);

  return (
    <div className='min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center px-4'>
      <div className='max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center'>
        {!error ? (
          <>
            <div className='w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6'>
              <ArrowPathIcon className='w-12 h-12 text-indigo-600 animate-spin' />
            </div>
            <h1 className='text-2xl font-bold text-gray-900 mb-3'>Refreshing Onboarding...</h1>
            <p className='text-gray-600'>Please wait while we prepare your onboarding session.</p>
          </>
        ) : (
          <>
            <h1 className='text-2xl font-bold text-gray-900 mb-3'>Something Went Wrong</h1>
            <p className='text-red-600 mb-6'>{error}</p>
            <a
              href='/dashboard/artist'
              className='inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors'
            >
              Return to Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}

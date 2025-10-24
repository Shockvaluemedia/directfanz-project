'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function StripeSuccessPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Update onboarding progress
    const updateProgress = async () => {
      try {
        await fetch('/api/artist/onboarding/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'stripe',
            completed: true,
          }),
        });
      } catch (error) {
        console.error('Failed to update onboarding progress:', error);
      }
    };

    updateProgress();

    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      setRedirecting(true);
      router.push('/dashboard/artist');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleContinue = () => {
    setRedirecting(true);
    router.push('/dashboard/artist');
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4'>
      <div className='max-w-md w-full'>
        <div className='bg-white rounded-2xl shadow-xl p-8 text-center'>
          {/* Success icon */}
          <div className='w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6'>
            <CheckCircleIcon className='w-12 h-12 text-green-600' />
          </div>

          {/* Success message */}
          <h1 className='text-2xl font-bold text-gray-900 mb-3'>Stripe Connected! 🎉</h1>
          <p className='text-gray-600 mb-6'>
            Your Stripe account has been successfully connected. You're now ready to receive
            payments from your fans.
          </p>

          {/* Next steps */}
          <div className='bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-6 text-left'>
            <h3 className='text-sm font-semibold text-gray-900 mb-2'>What's Next:</h3>
            <ul className='space-y-2 text-sm text-gray-700'>
              <li className='flex items-start'>
                <span className='text-indigo-600 mr-2'>1.</span>
                Create your first subscription tier
              </li>
              <li className='flex items-start'>
                <span className='text-indigo-600 mr-2'>2.</span>
                Upload exclusive content for fans
              </li>
              <li className='flex items-start'>
                <span className='text-indigo-600 mr-2'>3.</span>
                Share your profile and start earning
              </li>
            </ul>
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={redirecting}
            className='w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50'
          >
            {redirecting ? (
              'Redirecting...'
            ) : (
              <>
                Continue to Dashboard
                <ArrowRightIcon className='w-5 h-5 ml-2' />
              </>
            )}
          </button>

          <p className='text-xs text-gray-500 mt-4'>
            Redirecting automatically in 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
}

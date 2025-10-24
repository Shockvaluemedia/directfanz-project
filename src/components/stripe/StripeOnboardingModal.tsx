'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CreditCardIcon,
  CheckIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  trigger?: 'tier_creation' | 'payout_settings' | 'dashboard_banner';
}

export function StripeOnboardingModal({ isOpen, onClose, onSuccess, trigger = 'tier_creation' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectStripe = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/artist/stripe/connect', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success && result.url) {
        // Redirect to Stripe Connect onboarding
        window.location.href = result.url;
      } else {
        setError(result.error || 'Failed to connect Stripe');
      }
    } catch (err: any) {
      setError('Failed to connect Stripe. Please try again.');
      console.error('Stripe connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getTitleAndMessage = () => {
    switch (trigger) {
      case 'tier_creation':
        return {
          title: 'Connect Stripe to Create Tiers',
          message: 'You need to connect your Stripe account before creating paid subscription tiers.',
          isBlocking: true,
        };
      case 'payout_settings':
        return {
          title: 'Set Up Payouts',
          message: 'Connect Stripe to start receiving payments from your fans.',
          isBlocking: false,
        };
      case 'dashboard_banner':
        return {
          title: 'Get Paid for Your Content',
          message: 'Connect Stripe to receive payouts and start monetizing your fanbase.',
          isBlocking: false,
        };
      default:
        return {
          title: 'Connect Stripe Account',
          message: 'Connect Stripe to receive payments.',
          isBlocking: false,
        };
    }
  };

  const { title, message, isBlocking } = getTitleAndMessage();

  return (
    <AnimatePresence>
      <div className='fixed inset-0 z-50 flex items-center justify-center px-4'>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='absolute inset-0 bg-black/50 backdrop-blur-sm'
          onClick={!isBlocking ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className='relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden'
        >
          {/* Header */}
          <div className='relative bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white'>
            {!isBlocking && (
              <button
                onClick={onClose}
                className='absolute top-4 right-4 text-white/80 hover:text-white transition-colors'
              >
                <XMarkIcon className='w-6 h-6' />
              </button>
            )}

            <div className='flex items-center justify-center mb-4'>
              <div className='w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center'>
                <CreditCardIcon className='w-8 h-8 text-white' />
              </div>
            </div>

            <h2 className='text-2xl font-bold text-center'>{title}</h2>
            <p className='text-center text-indigo-100 mt-2'>{message}</p>
          </div>

          {/* Content */}
          <div className='px-6 py-6'>
            {/* Benefits */}
            <div className='space-y-3 mb-6'>
              <BenefitItem text='Daily payouts to your bank account' />
              <BenefitItem text='You keep 80% of all revenue' />
              <BenefitItem text='Secure & PCI compliant payments' />
              <BenefitItem text='Takes just 2 minutes to set up' />
            </div>

            {/* Warning for blocking */}
            {isBlocking && (
              <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6'>
                <div className='flex items-start'>
                  <ExclamationTriangleIcon className='w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0' />
                  <div>
                    <h4 className='text-sm font-semibold text-amber-900'>
                      Stripe Connection Required
                    </h4>
                    <p className='text-xs text-amber-700 mt-1'>
                      You cannot create paid tiers without connecting Stripe. This is required to
                      process payments and send you payouts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className='bg-red-50 border border-red-200 rounded-lg p-4 mb-6'>
                <p className='text-sm text-red-700'>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className='flex flex-col gap-3'>
              <button
                onClick={handleConnectStripe}
                disabled={loading}
                className='w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? (
                  <span className='flex items-center'>
                    <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-white' fill='none' viewBox='0 0 24 24'>
                      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  <span className='flex items-center'>
                    Connect with Stripe
                    <ArrowRightIcon className='w-5 h-5 ml-2' />
                  </span>
                )}
              </button>

              {!isBlocking && (
                <button
                  onClick={onClose}
                  className='w-full px-6 py-3 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors'
                >
                  Maybe Later
                </button>
              )}
            </div>

            {/* Footer note */}
            <p className='text-xs text-center text-gray-500 mt-4'>
              By connecting, you agree to{' '}
              <a href='https://stripe.com/connect-account/legal' target='_blank' rel='noopener noreferrer' className='text-indigo-600 hover:underline'>
                Stripe's Connected Account Agreement
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className='flex items-start'>
      <div className='flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3'>
        <CheckIcon className='w-4 h-4 text-green-600' />
      </div>
      <p className='text-sm text-gray-700'>{text}</p>
    </div>
  );
}

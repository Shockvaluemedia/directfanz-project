'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  SparklesIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface TrialStatusBannerProps {
  subscription: {
    id: string;
    isTrialing: boolean;
    trialStartDate: Date | null;
    trialEndDate: Date | null;
    amount: number;
    artist: {
      displayName: string;
    };
    tier: {
      name: string;
    };
  };
}

export default function TrialStatusBanner({ subscription }: TrialStatusBannerProps) {
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    if (subscription.isTrialing && subscription.trialEndDate) {
      const remaining = Math.ceil(
        (new Date(subscription.trialEndDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );
      setDaysRemaining(Math.max(0, remaining));
    }
  }, [subscription]);

  if (!subscription.isTrialing) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6"
    >
      <div className="flex items-start gap-3">
        <SparklesIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Free Trial Active
            </h3>
            <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
            </span>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            You're currently on a free trial of{' '}
            <strong>{subscription.artist.displayName}'s</strong>{' '}
            <strong>{subscription.tier.name}</strong> tier.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ClockIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">
                Trial ends on{' '}
                <strong className="text-gray-900 dark:text-white">
                  {new Date(subscription.trialEndDate!).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                After trial: <strong className="text-gray-900 dark:text-white">
                  ${Number(subscription.amount).toFixed(2)}/month
                </strong>
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Cancel anytime before trial ends to avoid charges
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

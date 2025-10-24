'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SetupChecklist } from './SetupChecklist';
import { SetupProgressBar } from './SetupProgressBar';

interface OnboardingProgress {
  id: string;
  profileComplete: boolean;
  stripeConnected: boolean;
  firstTierCreated: boolean;
  firstContentUploaded: boolean;
  profileShared: boolean;
  completionPercentage: number;
  currentStep: string | null;
  dismissedAt: string | null;
  completedAt: string | null;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  action: string;
  link: string;
  weight: number;
  field: string;
  completed: boolean;
  isActive: boolean;
  required?: boolean;
  templates?: Array<{ name: string; price: number; description: string }>;
  suggestions?: string[];
}

interface WizardData {
  progress: OnboardingProgress;
  steps: SetupStep[];
  nextStep: SetupStep | null;
  isComplete: boolean;
  isDismissed: boolean;
}

export default function ArtistSetupWizard() {
  const { data: session } = useSession();
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (session?.user?.role === 'ARTIST') {
      fetchOnboardingProgress();
    }
  }, [session]);

  const fetchOnboardingProgress = async () => {
    try {
      const response = await fetch('/api/artist/onboarding/progress');
      const result = await response.json();

      if (result.success) {
        setWizardData(result.data);

        // Show wizard if not completed and not dismissed
        setShowWizard(
          !result.data.isComplete &&
          !result.data.isDismissed &&
          result.data.progress.completionPercentage < 100
        );
      }
    } catch (error) {
      console.error('Failed to fetch onboarding progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await fetch('/api/artist/onboarding/dismiss', {
        method: 'POST',
      });
      setShowWizard(false);
    } catch (error) {
      console.error('Failed to dismiss wizard:', error);
    }
  };

  const handleReopen = () => {
    setShowWizard(true);
  };

  if (loading || !wizardData || session?.user?.role !== 'ARTIST') {
    return null;
  }

  // If completed, show success banner
  if (wizardData.isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6'
      >
        <div className='flex items-center'>
          <CheckCircleIcon className='w-6 h-6 text-green-600 mr-3' />
          <div className='flex-1'>
            <h3 className='text-sm font-semibold text-green-900'>Setup Complete! 🎉</h3>
            <p className='text-xs text-green-700'>
              You're all set to start earning. Share your profile and start creating content!
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Collapsed banner when dismissed
  if (!showWizard) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className='bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6'
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <SparklesIcon className='w-5 h-5 text-indigo-600 mr-3' />
            <div>
              <h3 className='text-sm font-semibold text-gray-900'>
                Complete your setup ({wizardData.progress.completionPercentage}%)
              </h3>
              <p className='text-xs text-gray-600'>
                {5 - wizardData.steps.filter(s => s.completed).length} steps remaining
              </p>
            </div>
          </div>
          <button
            onClick={handleReopen}
            className='text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors'
          >
            Continue Setup
          </button>
        </div>
      </motion.div>
    );
  }

  // Full wizard
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className='bg-white border-2 border-indigo-200 rounded-2xl shadow-lg p-6 mb-6 relative overflow-hidden'
      >
        {/* Background decoration */}
        <div className='absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-30 -z-10' />

        {/* Header */}
        <div className='flex items-start justify-between mb-6'>
          <div className='flex-1'>
            <div className='flex items-center mb-2'>
              <SparklesIcon className='w-6 h-6 text-indigo-600 mr-2' />
              <h2 className='text-xl font-bold text-gray-900'>Complete Your Setup</h2>
            </div>
            <p className='text-sm text-gray-600'>
              Get your account ready to start earning in just a few steps
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className='text-gray-400 hover:text-gray-600 transition-colors'
            aria-label='Dismiss wizard'
          >
            <XMarkIcon className='w-5 h-5' />
          </button>
        </div>

        {/* Progress Bar */}
        <SetupProgressBar
          percentage={wizardData.progress.completionPercentage}
          completedSteps={wizardData.steps.filter(s => s.completed).length}
          totalSteps={wizardData.steps.length}
        />

        {/* Checklist */}
        <SetupChecklist
          steps={wizardData.steps}
          onStepComplete={(stepId) => {
            // Refresh progress after completing a step
            fetchOnboardingProgress();
          }}
        />

        {/* Footer */}
        <div className='mt-6 pt-6 border-t border-gray-200'>
          <div className='flex items-center justify-between'>
            <button
              onClick={handleDismiss}
              className='text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              I'll do this later
            </button>
            {wizardData.nextStep && (
              <a
                href={wizardData.nextStep.link}
                className='inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors'
              >
                {wizardData.nextStep.action}
                <ArrowRightIcon className='w-4 h-4 ml-2' />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

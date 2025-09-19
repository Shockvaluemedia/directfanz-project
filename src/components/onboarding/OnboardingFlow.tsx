'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  MusicNoteIcon,
  HeartIcon,
  StarIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  component: React.ComponentType<any>;
  icon: React.ComponentType<any>;
  color: string;
}

// Step 1: Welcome
const WelcomeStep = ({ onNext }: { onNext: () => void }) => (
  <div className='text-center'>
    <div className='w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center'>
      <StarIcon className='w-12 h-12 text-white' />
    </div>
    <h1 className='text-3xl font-bold text-gray-900 mb-4'>Welcome to DirectFanz</h1>
    <p className='text-lg text-gray-600 mb-8 max-w-md mx-auto'>
      Connect directly with your fans, monetize your content, and build a sustainable creative
      career.
    </p>
    <div className='grid grid-cols-3 gap-6 mb-8'>
      <div className='text-center'>
        <div className='w-12 h-12 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center'>
          <CheckIcon className='w-6 h-6 text-green-600' />
        </div>
        <p className='text-sm font-medium text-gray-900'>No Algorithm</p>
        <p className='text-xs text-gray-500'>Direct fan connection</p>
      </div>
      <div className='text-center'>
        <div className='w-12 h-12 bg-blue-100 rounded-full mx-auto mb-3 flex items-center justify-center'>
          <CheckIcon className='w-6 h-6 text-blue-600' />
        </div>
        <p className='text-sm font-medium text-gray-900'>80% Revenue</p>
        <p className='text-xs text-gray-500'>You keep more</p>
      </div>
      <div className='text-center'>
        <div className='w-12 h-12 bg-purple-100 rounded-full mx-auto mb-3 flex items-center justify-center'>
          <CheckIcon className='w-6 h-6 text-purple-600' />
        </div>
        <p className='text-sm font-medium text-gray-900'>Daily Payouts</p>
        <p className='text-xs text-gray-500'>Get paid fast</p>
      </div>
    </div>
    <button
      onClick={onNext}
      className='bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto'
    >
      Let's Get Started
      <ArrowRightIcon className='w-5 h-5 ml-2' />
    </button>
  </div>
);

// Step 2: Role Selection
const RoleSelectionStep = ({
  onNext,
  onPrev,
  selectedRole,
  setSelectedRole,
}: {
  onNext: () => void;
  onPrev: () => void;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
}) => (
  <div className='text-center'>
    <h2 className='text-2xl font-bold text-gray-900 mb-2'>How do you want to use the platform?</h2>
    <p className='text-gray-600 mb-8'>Choose your primary role to customize your experience</p>

    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
          selectedRole === 'ARTIST'
            ? 'border-indigo-500 bg-indigo-50 shadow-lg'
            : 'border-gray-200 hover:border-indigo-300'
        }`}
        onClick={() => setSelectedRole('ARTIST')}
      >
        <div className='w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center'>
          <MusicNoteIcon className='w-8 h-8 text-white' />
        </div>
        <h3 className='text-xl font-semibold text-gray-900 mb-2'>I'm a Creator</h3>
        <p className='text-gray-600 mb-4'>I create content and want to monetize my fanbase</p>
        <div className='text-sm text-gray-500 space-y-1'>
          <p>• Upload exclusive content</p>
          <p>• Set subscription tiers</p>
          <p>• Live stream to fans</p>
          <p>• Direct fan messaging</p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
          selectedRole === 'FAN'
            ? 'border-pink-500 bg-pink-50 shadow-lg'
            : 'border-gray-200 hover:border-pink-300'
        }`}
        onClick={() => setSelectedRole('FAN')}
      >
        <div className='w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center'>
          <HeartIcon className='w-8 h-8 text-white' />
        </div>
        <h3 className='text-xl font-semibold text-gray-900 mb-2'>I'm a Fan</h3>
        <p className='text-gray-600 mb-4'>I want to support my favorite creators directly</p>
        <div className='text-sm text-gray-500 space-y-1'>
          <p>• Access exclusive content</p>
          <p>• Support favorite creators</p>
          <p>• Join live streams</p>
          <p>• Direct creator messaging</p>
        </div>
      </motion.div>
    </div>

    <div className='flex justify-between'>
      <button
        onClick={onPrev}
        className='flex items-center px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors'
      >
        <ArrowLeftIcon className='w-5 h-5 mr-2' />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={!selectedRole}
        className='bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed'
      >
        Continue
        <ArrowRightIcon className='w-5 h-5 ml-2' />
      </button>
    </div>
  </div>
);

// Step 3: Profile Setup
const ProfileSetupStep = ({
  onNext,
  onPrev,
  selectedRole,
  profileData,
  setProfileData,
}: {
  onNext: () => void;
  onPrev: () => void;
  selectedRole: string;
  profileData: any;
  setProfileData: (data: any) => void;
}) => (
  <div className='text-center max-w-md mx-auto'>
    <h2 className='text-2xl font-bold text-gray-900 mb-2'>
      {selectedRole === 'ARTIST' ? 'Set Up Your Creator Profile' : 'Complete Your Profile'}
    </h2>
    <p className='text-gray-600 mb-8'>
      {selectedRole === 'ARTIST'
        ? 'Help fans discover and connect with you'
        : 'Personalize your experience on the platform'}
    </p>

    <form className='space-y-6 text-left'>
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>Display Name *</label>
        <input
          type='text'
          value={profileData.displayName || ''}
          onChange={e => setProfileData({ ...profileData, displayName: e.target.value })}
          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
          placeholder={selectedRole === 'ARTIST' ? 'Your stage/artist name' : 'Your display name'}
        />
      </div>

      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>Bio</label>
        <textarea
          value={profileData.bio || ''}
          onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
          rows={3}
          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
          placeholder={
            selectedRole === 'ARTIST'
              ? 'Tell fans about your music and what you create...'
              : 'Tell us a bit about yourself...'
          }
        />
      </div>

      {selectedRole === 'ARTIST' && (
        <>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Content Type</label>
            <select
              value={profileData.contentType || ''}
              onChange={e => setProfileData({ ...profileData, contentType: e.target.value })}
              className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
            >
              <option value=''>Select your primary content type</option>
              <option value='music'>Music</option>
              <option value='podcast'>Podcast</option>
              <option value='video'>Video Content</option>
              <option value='art'>Visual Art</option>
              <option value='writing'>Writing</option>
              <option value='other'>Other</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Website/Social Links
            </label>
            <input
              type='url'
              value={profileData.website || ''}
              onChange={e => setProfileData({ ...profileData, website: e.target.value })}
              className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
              placeholder='https://your-website.com'
            />
          </div>
        </>
      )}
    </form>

    <div className='flex justify-between mt-8'>
      <button
        onClick={onPrev}
        className='flex items-center px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors'
      >
        <ArrowLeftIcon className='w-5 h-5 mr-2' />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={!profileData.displayName}
        className='bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed'
      >
        Continue
        <ArrowRightIcon className='w-5 h-5 ml-2' />
      </button>
    </div>
  </div>
);

// Step 4: Completion
const CompletionStep = ({
  selectedRole,
  onComplete,
}: {
  selectedRole: string;
  onComplete: () => void;
}) => (
  <div className='text-center'>
    <div className='w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center'>
      <CheckIcon className='w-12 h-12 text-white' />
    </div>
    <h2 className='text-3xl font-bold text-gray-900 mb-4'>Welcome to the Platform! 🎉</h2>
    <p className='text-lg text-gray-600 mb-8 max-w-md mx-auto'>
      {selectedRole === 'ARTIST'
        ? 'Your creator profile is ready! Start uploading content and building your fanbase.'
        : 'Your profile is complete! Start discovering and supporting amazing creators.'}
    </p>

    <div className='bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8 max-w-md mx-auto'>
      <h3 className='font-semibold text-gray-900 mb-4'>
        {selectedRole === 'ARTIST' ? 'Next Steps for Creators:' : 'What You Can Do Now:'}
      </h3>
      <div className='text-left space-y-2 text-sm text-gray-700'>
        {selectedRole === 'ARTIST' ? (
          <>
            <p>• Upload your first exclusive content</p>
            <p>• Set up subscription tiers</p>
            <p>• Connect your Stripe account for payouts</p>
            <p>• Share your profile link with fans</p>
          </>
        ) : (
          <>
            <p>• Browse and discover amazing creators</p>
            <p>• Subscribe to your favorites</p>
            <p>• Join live streams and events</p>
            <p>• Engage with exclusive content</p>
          </>
        )}
      </div>
    </div>

    <button
      onClick={onComplete}
      className='bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto'
    >
      {selectedRole === 'ARTIST' ? 'Start Creating' : 'Explore Platform'}
      <ArrowRightIcon className='w-5 h-5 ml-2' />
    </button>
  </div>
);

const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    subtitle: 'Get started',
    component: WelcomeStep,
    icon: StarIcon,
    color: 'indigo',
  },
  {
    id: 'role',
    title: 'Role Selection',
    subtitle: 'Choose your path',
    component: RoleSelectionStep,
    icon: UserIcon,
    color: 'purple',
  },
  {
    id: 'profile',
    title: 'Profile Setup',
    subtitle: 'Personalize',
    component: ProfileSetupStep,
    icon: UserIcon,
    color: 'blue',
  },
  {
    id: 'complete',
    title: 'Complete',
    subtitle: 'All done!',
    component: CompletionStep,
    icon: CheckIcon,
    color: 'green',
  },
];

interface OnboardingFlowProps {
  onComplete: (data: { role: string; profile: any }) => void;
  onSkip?: () => void;
}

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState('');
  const [profileData, setProfileData] = useState({});
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Here you would typically save the onboarding data to your backend
      await onComplete({
        role: selectedRole,
        profile: profileData,
      });

      // Redirect based on role
      if (selectedRole === 'ARTIST') {
        router.push('/dashboard/artist');
      } else {
        router.push('/discover');
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className='min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl'>
        {/* Progress Bar */}
        <div className='mb-8'>
          <div className='flex items-center justify-between mb-4'>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {index < currentStep ? <CheckIcon className='w-5 h-5' /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className='text-center'>
            <p className='text-sm text-gray-500'>
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className='bg-white rounded-2xl shadow-xl p-8'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CurrentStepComponent
                onNext={handleNext}
                onPrev={handlePrev}
                onComplete={handleComplete}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                profileData={profileData}
                setProfileData={setProfileData}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip Option */}
        {onSkip && currentStep < steps.length - 1 && (
          <div className='text-center mt-6'>
            <button
              onClick={onSkip}
              className='text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              Skip onboarding for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

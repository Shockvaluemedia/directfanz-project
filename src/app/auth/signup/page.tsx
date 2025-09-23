'use client';

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { UserIcon, MicrophoneIcon, HeartIcon, CameraIcon } from '@heroicons/react/24/solid';

// Password validation helpers
const passwordChecks = {
  minLength: (password: string) => password.length >= 8,
  hasUpperCase: (password: string) => /[A-Z]/.test(password),
  hasLowerCase: (password: string) => /[a-z]/.test(password),
  hasNumbers: (password: string) => /\d/.test(password),
  hasSpecialChar: (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
};

const getPasswordStrength = (password: string) => {
  const checks = Object.values(passwordChecks);
  const passedChecks = checks.filter(check => check(password)).length;
  if (passedChecks <= 2) return { strength: 'weak', color: 'red', width: '33%' };
  if (passedChecks <= 4) return { strength: 'medium', color: 'yellow', width: '66%' };
  return { strength: 'strong', color: 'green', width: '100%' };
};

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'FAN' as 'ARTIST' | 'FAN',
    agreedToTerms: false,
    emailUpdates: true,
  });
  
  const [uiState, setUiState] = useState({
    isLoading: false,
    showPassword: false,
    showConfirmPassword: false,
    currentStep: 1,
    maxSteps: 3,
  });
  
  const [validation, setValidation] = useState({
    error: '',
    passwordStrength: { strength: 'weak', color: 'red', width: '0%' },
    emailValid: false,
    passwordsMatch: false,
  });

  const router = useRouter();

  // Real-time validation
  useEffect(() => {
    setValidation(prev => ({
      ...prev,
      passwordStrength: getPasswordStrength(formData.password),
      emailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
      passwordsMatch: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
    }));
  }, [formData.password, formData.confirmPassword, formData.email]);

  const canProceedToNext = () => {
    if (uiState.currentStep === 1) {
      return formData.displayName.trim().length >= 2 && validation.emailValid;
    }
    if (uiState.currentStep === 2) {
      return validation.passwordStrength.strength !== 'weak' && validation.passwordsMatch;
    }
    if (uiState.currentStep === 3) {
      return formData.role && formData.agreedToTerms;
    }
    return false;
  };

  const nextStep = () => {
    if (canProceedToNext() && uiState.currentStep < uiState.maxSteps) {
      setUiState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const prevStep = () => {
    if (uiState.currentStep > 1) {
      setUiState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation
    if (!canProceedToNext()) {
      setValidation(prev => ({ ...prev, error: 'Please complete all required fields correctly.' }));
      return;
    }
    
    setUiState(prev => ({ ...prev, isLoading: true }));
    setValidation(prev => ({ ...prev, error: '' }));

    try {
      // Create account
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Sign in the user after successful registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setValidation(prev => ({ ...prev, error: 'Account created but failed to sign in. Please try signing in manually.' }));
      } else {
        // Redirect based on role with onboarding query
        if (formData.role === 'ARTIST') {
          router.push('/dashboard/artist?onboarding=true');
        } else {
          router.push('/dashboard/fan?onboarding=true');
        }
      }
    } catch (error) {
      setValidation(prev => ({ ...prev, error: error instanceof Error ? error.message : 'An error occurred. Please try again.' }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setUiState(prev => ({ ...prev, isLoading: true }));
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch (error) {
      setValidation(prev => ({ ...prev, error: 'An error occurred. Please try again.' }));
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Step components
  const renderStep1 = () => (
    <div className='space-y-6'>
      <div className='text-center mb-8'>
        <UserIcon className='mx-auto h-16 w-16 text-blue-600 mb-4' />
        <h3 className='text-2xl font-bold text-gray-900'>Let's get to know you</h3>
        <p className='text-gray-600 mt-2'>Tell us your name and email to get started</p>
      </div>

      <div className='space-y-4'>
        <div>
          <label htmlFor='displayName' className='block text-sm font-semibold text-gray-700 mb-2'>
            Display Name
          </label>
          <input
            id='displayName'
            type='text'
            required
            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
              formData.displayName.trim().length >= 2
                ? 'border-green-300 focus:border-green-500 bg-green-50'
                : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder='Your display name'
            value={formData.displayName}
            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
          />
          {formData.displayName.trim().length >= 2 && (
            <div className='flex items-center mt-2 text-green-600'>
              <CheckCircleIcon className='w-4 h-4 mr-1' />
              <span className='text-sm'>Great name!</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor='email' className='block text-sm font-semibold text-gray-700 mb-2'>
            Email Address
          </label>
          <input
            id='email'
            type='email'
            autoComplete='email'
            required
            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
              validation.emailValid
                ? 'border-green-300 focus:border-green-500 bg-green-50'
                : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder='your@email.com'
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          {validation.emailValid && (
            <div className='flex items-center mt-2 text-green-600'>
              <CheckCircleIcon className='w-4 h-4 mr-1' />
              <span className='text-sm'>Valid email format</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className='space-y-6'>
      <div className='text-center mb-8'>
        <div className='mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4'>
          <span className='text-2xl'>🔐</span>
        </div>
        <h3 className='text-2xl font-bold text-gray-900'>Create a secure password</h3>
        <p className='text-gray-600 mt-2'>Your security is our priority</p>
      </div>

      <div className='space-y-4'>
        <div>
          <label htmlFor='password' className='block text-sm font-semibold text-gray-700 mb-2'>
            Password
          </label>
          <div className='relative'>
            <input
              id='password'
              type={uiState.showPassword ? 'text' : 'password'}
              autoComplete='new-password'
              required
              className='w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 transition-all duration-200'
              placeholder='Create a strong password'
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type='button'
              className='absolute inset-y-0 right-0 pr-3 flex items-center'
              onClick={() => setUiState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
            >
              {uiState.showPassword ? (
                <EyeSlashIcon className='h-5 w-5 text-gray-400 hover:text-gray-600' />
              ) : (
                <EyeIcon className='h-5 w-5 text-gray-400 hover:text-gray-600' />
              )}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {formData.password.length > 0 && (
            <div className='mt-3'>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-sm font-medium text-gray-700'>Password Strength:</span>
                <span className={`text-sm font-semibold capitalize ${
                  validation.passwordStrength.color === 'green' ? 'text-green-600' :
                  validation.passwordStrength.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {validation.passwordStrength.strength}
                </span>
              </div>
              <div className='w-full bg-gray-200 rounded-full h-2'>
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    validation.passwordStrength.color === 'green' ? 'bg-green-500' :
                    validation.passwordStrength.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: validation.passwordStrength.width }}
                />
              </div>
            </div>
          )}
          
          {/* Password Requirements */}
          {formData.password.length > 0 && (
            <div className='mt-3 space-y-1'>
              <div className='grid grid-cols-2 gap-2 text-sm'>
                {Object.entries(passwordChecks).map(([key, check]) => {
                  const isValid = check(formData.password);
                  const labels = {
                    minLength: '8+ characters',
                    hasUpperCase: 'Uppercase',
                    hasLowerCase: 'Lowercase', 
                    hasNumbers: 'Numbers',
                    hasSpecialChar: 'Special chars'
                  };
                  
                  return (
                    <div key={key} className={`flex items-center ${
                      isValid ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {isValid ? (
                        <CheckCircleIcon className='w-4 h-4 mr-1' />
                      ) : (
                        <XCircleIcon className='w-4 h-4 mr-1' />
                      )}
                      <span>{labels[key as keyof typeof labels]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor='confirmPassword' className='block text-sm font-semibold text-gray-700 mb-2'>
            Confirm Password
          </label>
          <div className='relative'>
            <input
              id='confirmPassword'
              type={uiState.showConfirmPassword ? 'text' : 'password'}
              required
              className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                validation.passwordsMatch && formData.confirmPassword.length > 0
                  ? 'border-green-300 focus:border-green-500 bg-green-50'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder='Confirm your password'
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
            <button
              type='button'
              className='absolute inset-y-0 right-0 pr-3 flex items-center'
              onClick={() => setUiState(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
            >
              {uiState.showConfirmPassword ? (
                <EyeSlashIcon className='h-5 w-5 text-gray-400 hover:text-gray-600' />
              ) : (
                <EyeIcon className='h-5 w-5 text-gray-400 hover:text-gray-600' />
              )}
            </button>
          </div>
          
          {formData.confirmPassword.length > 0 && (
            <div className='mt-2'>
              {validation.passwordsMatch ? (
                <div className='flex items-center text-green-600'>
                  <CheckCircleIcon className='w-4 h-4 mr-1' />
                  <span className='text-sm'>Passwords match!</span>
                </div>
              ) : (
                <div className='flex items-center text-red-600'>
                  <XCircleIcon className='w-4 h-4 mr-1' />
                  <span className='text-sm'>Passwords don't match</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className='space-y-6'>
      <div className='text-center mb-8'>
        <div className='mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4'>
          <span className='text-2xl'>🎯</span>
        </div>
        <h3 className='text-2xl font-bold text-gray-900'>What brings you to DirectFanZ?</h3>
        <p className='text-gray-600 mt-2'>Choose your role to personalize your experience</p>
      </div>

      <div className='space-y-4'>
        {/* Role Selection Cards */}
        <div className='grid gap-4'>
          <div 
            className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
              formData.role === 'FAN' 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setFormData({ ...formData, role: 'FAN' })}
          >
            <div className='flex items-start space-x-4'>
              <div className='flex-shrink-0'>
                <HeartIcon className='w-8 h-8 text-red-500' />
              </div>
              <div className='flex-1'>
                <div className='flex items-center'>
                  <input
                    type='radio'
                    value='FAN'
                    checked={formData.role === 'FAN'}
                    onChange={() => setFormData({ ...formData, role: 'FAN' })}
                    className='h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500'
                  />
                  <h4 className='ml-3 text-lg font-semibold text-gray-900'>I'm a Fan</h4>
                </div>
                <p className='mt-2 text-gray-600 text-sm leading-relaxed'>
                  I want to discover amazing creators, support their work, and get access to exclusive content
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <span className='inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full'>
                    Exclusive Content
                  </span>
                  <span className='inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full'>
                    Support Creators
                  </span>
                  <span className='inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full'>
                    Community Access
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
              formData.role === 'ARTIST' 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setFormData({ ...formData, role: 'ARTIST' })}
          >
            <div className='flex items-start space-x-4'>
              <div className='flex-shrink-0'>
                <MicrophoneIcon className='w-8 h-8 text-purple-500' />
              </div>
              <div className='flex-1'>
                <div className='flex items-center'>
                  <input
                    type='radio'
                    value='ARTIST'
                    checked={formData.role === 'ARTIST'}
                    onChange={() => setFormData({ ...formData, role: 'ARTIST' })}
                    className='h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500'
                  />
                  <h4 className='ml-3 text-lg font-semibold text-gray-900'>I'm a Creator</h4>
                </div>
                <p className='mt-2 text-gray-600 text-sm leading-relaxed'>
                  I want to share my creative work, build a community of fans, and earn from my passion
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <span className='inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full'>
                    Monetize Content
                  </span>
                  <span className='inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full'>
                    Build Fanbase
                  </span>
                  <span className='inline-block px-2 py-1 text-xs bg-pink-100 text-pink-800 rounded-full'>
                    Creative Tools
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Privacy */}
        <div className='pt-4 space-y-4'>
          <div className='flex items-start'>
            <input
              id='agreedToTerms'
              type='checkbox'
              checked={formData.agreedToTerms}
              onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
              className='h-4 w-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
            />
            <label htmlFor='agreedToTerms' className='ml-3 text-sm text-gray-700 leading-relaxed'>
              I agree to the{' '}
              <Link href='/terms' className='text-blue-600 hover:text-blue-700 underline'>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href='/privacy' className='text-blue-600 hover:text-blue-700 underline'>
                Privacy Policy
              </Link>
            </label>
          </div>
          
          <div className='flex items-start'>
            <input
              id='emailUpdates'
              type='checkbox'
              checked={formData.emailUpdates}
              onChange={e => setFormData({ ...formData, emailUpdates: e.target.checked })}
              className='h-4 w-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
            />
            <label htmlFor='emailUpdates' className='ml-3 text-sm text-gray-700 leading-relaxed'>
              I'd like to receive updates about new features and creator spotlights (optional)
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold text-gray-900 mb-2'>Join DirectFanZ</h1>
          <p className='text-gray-600'>
            Already have an account?{' '}
            <Link href='/auth/signin' className='font-semibold text-blue-600 hover:text-blue-700 transition-colors'>
              Sign in here
            </Link>
          </p>
        </div>

        {/* Progress Bar */}
        <div className='mb-8'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-700'>Step {uiState.currentStep} of {uiState.maxSteps}</span>
            <span className='text-sm text-gray-500'>{Math.round((uiState.currentStep / uiState.maxSteps) * 100)}% complete</span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div 
              className='bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out'
              style={{ width: `${(uiState.currentStep / uiState.maxSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-8'>
          <form onSubmit={handleSubmit}>
            {/* Error Display */}
            {validation.error && (
              <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl'>
                <div className='flex items-center'>
                  <XCircleIcon className='w-5 h-5 text-red-500 mr-2' />
                  <span className='text-red-700 text-sm font-medium'>{validation.error}</span>
                </div>
              </div>
            )}

            {/* Step Content */}
            {uiState.currentStep === 1 && renderStep1()}
            {uiState.currentStep === 2 && renderStep2()}
            {uiState.currentStep === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className='flex items-center justify-between pt-8 mt-8 border-t border-gray-200'>
              <div>
                {uiState.currentStep > 1 ? (
                  <button
                    type='button'
                    onClick={prevStep}
                    disabled={uiState.isLoading}
                    className='flex items-center px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                    </svg>
                    Back
                  </button>
                ) : (
                  <div /> // Empty div for spacing
                )}
              </div>

              <div className='flex items-center gap-4'>
                {uiState.currentStep < uiState.maxSteps ? (
                  <button
                    type='button'
                    onClick={nextStep}
                    disabled={!canProceedToNext() || uiState.isLoading}
                    className='flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold'
                  >
                    Continue
                    <svg className='w-5 h-5 ml-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                    </svg>
                  </button>
                ) : (
                  <button
                    type='submit'
                    disabled={!canProceedToNext() || uiState.isLoading}
                    className='flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl'
                  >
                    {uiState.isLoading ? (
                      <>
                        <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-white' fill='none' viewBox='0 0 24 24'>
                          <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                          <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create My Account
                        <span className='ml-2 text-lg'>🎉</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* OAuth Section - Only show on first step */}
          {uiState.currentStep === 1 && (
            <>
              <div className='relative mt-8'>
                <div className='absolute inset-0 flex items-center'>
                  <div className='w-full border-t border-gray-300' />
                </div>
                <div className='relative flex justify-center text-sm'>
                  <span className='px-4 bg-white text-gray-500 font-medium'>Or sign up with</span>
                </div>
              </div>

              <div className='mt-6 grid grid-cols-2 gap-4'>
                <button
                  type='button'
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={uiState.isLoading}
                  className='flex items-center justify-center px-4 py-3 border-2 border-gray-200 rounded-xl bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group'
                >
                  <svg className='w-5 h-5 mr-3 group-hover:scale-110 transition-transform' viewBox='0 0 24 24'>
                    <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
                    <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
                    <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' />
                    <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' />
                  </svg>
                  <span className='font-semibold text-gray-700'>Google</span>
                </button>

                <button
                  type='button'
                  onClick={() => handleOAuthSignIn('facebook')}
                  disabled={uiState.isLoading}
                  className='flex items-center justify-center px-4 py-3 border-2 border-gray-200 rounded-xl bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group'
                >
                  <svg className='w-5 h-5 mr-3 text-blue-600 group-hover:scale-110 transition-transform' fill='currentColor' viewBox='0 0 24 24'>
                    <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
                  </svg>
                  <span className='font-semibold text-gray-700'>Facebook</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

          <div>
            <button
              type='submit'
              disabled={isLoading}
              className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <div className='mt-6'>
            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <div className='w-full border-t border-gray-300' />
              </div>
              <div className='relative flex justify-center text-sm'>
                <span className='px-2 bg-gray-50 text-gray-500'>Or continue with</span>
              </div>
            </div>

            <div className='mt-6 grid grid-cols-2 gap-3'>
              <button
                type='button'
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
                className='w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <svg className='w-5 h-5' viewBox='0 0 24 24'>
                  <path
                    fill='currentColor'
                    d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                  />
                  <path
                    fill='currentColor'
                    d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                  />
                  <path
                    fill='currentColor'
                    d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                  />
                  <path
                    fill='currentColor'
                    d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                  />
                </svg>
                <span className='ml-2'>Google</span>
              </button>

              <button
                type='button'
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={isLoading}
                className='w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
                </svg>
                <span className='ml-2'>Facebook</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

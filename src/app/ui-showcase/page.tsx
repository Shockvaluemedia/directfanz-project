'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/ui/file-upload';
import { useToast } from '@/components/ui/toast';
import {
  FadeIn,
  Stagger,
  HoverScale,
  Pulse,
  Floating,
  SkeletonShimmer,
  Typewriter,
  Magnetic,
  LoadingDots,
  Ripple,
  ProgressRing,
} from '@/components/ui/animations';
import {
  LoadingState,
  ContentLoading,
  ConnectionStatus,
  InlineLoading,
  LoadingOverlay,
  PulseLoading,
  Shimmer,
  DataLoading,
} from '@/components/ui/enhanced-loading';
import {
  ContentCardSkeleton,
  CommentSkeleton,
  AnalyticsCardSkeleton,
  PlaylistItemSkeleton,
  NotificationSkeleton,
  UserProfileSkeleton,
  ContentGridSkeleton,
  CommentListSkeleton,
  DashboardSkeleton,
} from '@/components/ui/skeleton';

export default function UIShowcasePage() {
  const { addToast } = useToast();
  const [showOverlay, setShowOverlay] = useState(false);
  const [progress, setProgress] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('connected');

  const handleFileUpload = async (files: any[]) => {
    addToast({
      type: 'success',
      title: 'Upload Complete',
      message: `Successfully uploaded ${files.length} file(s)`,
    });
  };

  const showToasts = () => {
    addToast({
      type: 'success',
      title: 'Success!',
      message: 'Your action was completed successfully.',
    });

    setTimeout(() => {
      addToast({
        type: 'warning',
        title: 'Warning',
        message: 'This is a warning message with an action.',
        action: {
          label: 'Undo',
          onClick: () => console.log('Undo clicked'),
        },
      });
    }, 1000);

    setTimeout(() => {
      addToast({
        type: 'info',
        title: 'Information',
        message: "Here's some helpful information for you.",
      });
    }, 2000);

    setTimeout(() => {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong. Please try again.',
        duration: 0,
      });
    }, 3000);
  };

  const toggleOverlay = () => {
    setShowOverlay(true);
    setTimeout(() => setShowOverlay(false), 3000);
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className='container mx-auto px-4 py-8 space-y-8'>
      {/* Page Header */}
      <FadeIn>
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-gray-100'>
            UI Components Showcase
          </h1>
          <Typewriter
            text='Experience the polished interface of DirectFanz'
            speed={50}
            className='text-lg text-gray-600 dark:text-gray-400'
          />
        </div>
      </FadeIn>

      {/* Animation Components */}
      <Stagger staggerDelay={200} className='space-y-8'>
        {/* Toast Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Pulse color='green'>
                <div className='w-3 h-3 rounded-full' />
              </Pulse>
              <span>Toast Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-gray-600 dark:text-gray-400'>
              Elegant toast notifications with animations and progress indicators.
            </p>
            <Button onClick={showToasts}>Show Toast Examples</Button>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Drag & Drop File Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload onFileUpload={handleFileUpload} maxFiles={3} className='mb-4' />
          </CardContent>
        </Card>

        {/* Animation Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Micro-Interactions & Animations</CardTitle>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {/* Hover Scale */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Hover Scale</h4>
                <HoverScale>
                  <Card className='p-4 cursor-pointer'>
                    <p>Hover me!</p>
                  </Card>
                </HoverScale>
              </div>

              {/* Magnetic Effect */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Magnetic Button</h4>
                <Magnetic>
                  <Button>Magnetic Button</Button>
                </Magnetic>
              </div>

              {/* Ripple Effect */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Ripple Effect</h4>
                <Ripple className='inline-block'>
                  <Button variant='outline'>Click for Ripple</Button>
                </Ripple>
              </div>

              {/* Floating Animation */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Floating Animation</h4>
                <Floating>
                  <Badge variant='secondary'>Floating Badge</Badge>
                </Floating>
              </div>

              {/* Progress Ring */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Progress Ring</h4>
                <div className='flex justify-center'>
                  <ProgressRing progress={progress} size={80}>
                    <span className='text-sm font-semibold'>{progress}%</span>
                  </ProgressRing>
                </div>
                <Button size='sm' onClick={simulateProgress} className='mt-2'>
                  Animate
                </Button>
              </div>

              {/* Loading Dots */}
              <div className='text-center'>
                <h4 className='font-medium mb-3'>Loading Dots</h4>
                <LoadingDots />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading States */}
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Loading States</CardTitle>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              <div className='text-center space-y-3'>
                <h4 className='font-medium'>Upload State</h4>
                <LoadingState type='upload' progress={65} size='sm' />
              </div>

              <div className='text-center space-y-3'>
                <h4 className='font-medium'>Processing State</h4>
                <LoadingState type='processing' message='Analyzing content...' />
              </div>

              <div className='text-center space-y-3'>
                <h4 className='font-medium'>Connection Status</h4>
                <div className='space-y-2'>
                  <ConnectionStatus isConnected={connectionStatus === 'connected'} />
                  <ConnectionStatus
                    isConnected={false}
                    isReconnecting={connectionStatus === 'reconnecting'}
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setConnectionStatus('reconnecting');
                      setTimeout(() => setConnectionStatus('connected'), 2000);
                    }}
                  >
                    Test Connection
                  </Button>
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Content Loading</h4>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                <ContentLoading type='audio' />
                <ContentLoading type='video' />
                <ContentLoading type='image' />
                <ContentLoading type='document' />
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Inline & Overlay Loading</h4>
              <div className='flex items-center space-x-4'>
                <InlineLoading text='Saving...' />
                <PulseLoading isLoading={isLoading}>
                  <Button
                    onClick={() => {
                      setIsLoading(true);
                      setTimeout(() => setIsLoading(false), 2000);
                    }}
                  >
                    Pulse Loading Button
                  </Button>
                </PulseLoading>
                <Button onClick={toggleOverlay}>Show Overlay</Button>
              </div>

              {/* Overlay Demo */}
              <div className='relative bg-gray-100 dark:bg-gray-800 rounded-lg p-8 min-h-[200px]'>
                <h5 className='font-medium mb-2'>Content Area</h5>
                <p className='text-gray-600 dark:text-gray-400'>
                  This area will be covered by the loading overlay when activated.
                </p>
                <LoadingOverlay isVisible={showOverlay} message='Processing your request...' />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skeleton Components */}
        <Card>
          <CardHeader>
            <CardTitle>Loading Skeletons</CardTitle>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-4'>
              <h4 className='font-medium'>Individual Skeletons</h4>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <div>
                  <h5 className='text-sm font-medium mb-3 text-gray-700 dark:text-gray-300'>
                    Content Card
                  </h5>
                  <ContentCardSkeleton />
                </div>
                <div>
                  <h5 className='text-sm font-medium mb-3 text-gray-700 dark:text-gray-300'>
                    User Profile
                  </h5>
                  <UserProfileSkeleton />
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Comment List</h4>
              <CommentListSkeleton count={3} />
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Data Loading States</h4>
              <div className='space-y-6'>
                <div>
                  <h5 className='text-sm font-medium mb-3 text-gray-700 dark:text-gray-300'>
                    Cards Layout
                  </h5>
                  <DataLoading type='cards' />
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Custom Shimmer</h4>
              <div className='space-y-2'>
                <Shimmer className='h-4' />
                <Shimmer className='h-6 w-3/4' />
                <Shimmer className='h-3 w-1/2' />
              </div>
            </div>
          </CardContent>
        </Card>
      </Stagger>
    </div>
  );
}

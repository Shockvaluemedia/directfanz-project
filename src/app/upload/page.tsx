'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ContentUploader from '@/components/upload/ContentUploader';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploadingCount, setUploadingCount] = useState(0);

  // Redirect if not authenticated or not an artist
  React.useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin?callbackUrl=/upload');
      return;
    }

    if (session.user.role !== 'ARTIST') {
      toast.error('Only artists can upload content');
      router.push('/');
      return;
    }
  }, [session, status, router]);

  // ContentUploader handles its own upload flow, so we just need to track overall progress
  // The ContentUploader component manages uploads internally

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-4'>Upload Content</h1>
          <p className='text-gray-600 dark:text-gray-400'>
            Share your exclusive content with your fans. Upload images, audio, video, or documents.
          </p>
        </div>

        {/* Upload Guidelines */}
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8'>
          <div className='flex'>
            <svg
              className='w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                clipRule='evenodd'
              />
            </svg>
            <div className='ml-4'>
              <h3 className='text-lg font-medium text-blue-900 dark:text-blue-200 mb-2'>
                Upload Guidelines
              </h3>
              <div className='text-sm text-blue-800 dark:text-blue-300 space-y-2'>
                <p>
                  • <strong>High-quality content:</strong> Ensure your files are high resolution and
                  good quality
                </p>
                <p>
                  • <strong>Appropriate titles:</strong> Use descriptive, engaging titles for better
                  discoverability
                </p>
                <p>
                  • <strong>File sizes:</strong> Images (10MB), Audio (100MB), Video (500MB),
                  Documents (50MB)
                </p>
                <p>
                  • <strong>Supported formats:</strong> JPG/PNG, MP3/WAV, MP4/MOV, PDF/DOC
                </p>
                <p>
                  • <strong>Public vs Private:</strong> Public content is visible to everyone,
                  private content requires tier subscription
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Interface */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
          <ContentUploader />
        </div>

        {/* ContentUploader handles its own upload status display */}

        {/* Navigation Links */}
        <div className='mt-8 flex justify-center space-x-4'>
          <button
            onClick={() => router.push('/dashboard/content')}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
          >
            View My Content
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

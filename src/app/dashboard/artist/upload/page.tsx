'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ArtistUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (session.user.role !== 'ARTIST') {
      router.push('/dashboard/fan');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Content</h1>
          <p className="mt-2 text-gray-600">Share new content with your fans</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="text-6xl mb-4">📤</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Content Upload Studio</h3>
            <p className="text-gray-600 mb-6">
              This feature is coming soon! You'll be able to upload videos, photos, audio,
              and other content to share with your fans and subscribers.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/dashboard/artist')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium mr-4"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/upload')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Try Simple Upload
              </button>
            </div>
          </div>
        </div>

        {/* Upload options preview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-3">🎵</div>
            <h3 className="font-semibold text-gray-900 mb-2">Audio</h3>
            <p className="text-gray-600 text-sm">Upload songs, podcasts, and voice notes</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-3">🎥</div>
            <h3 className="font-semibold text-gray-900 mb-2">Video</h3>
            <p className="text-gray-600 text-sm">Share videos and live recordings</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-3">📷</div>
            <h3 className="font-semibold text-gray-900 mb-2">Photos</h3>
            <p className="text-gray-600 text-sm">Upload behind-the-scenes photos</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="font-semibold text-gray-900 mb-2">Posts</h3>
            <p className="text-gray-600 text-sm">Create text posts and updates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
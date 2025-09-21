'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ArtistContentPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Content Library</h1>
          <p className="mt-2 text-gray-600">Manage your uploaded content and media</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Your Content Library</h3>
            <p className="text-gray-600 mb-6">
              This feature is coming soon! You'll be able to manage all your uploaded content,
              organize media files, edit metadata, and track performance metrics.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/dashboard/artist')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium mr-4"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/dashboard/artist/upload')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Upload Content
              </button>
            </div>
          </div>
        </div>

        {/* Content management preview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">📊 Content Analytics</h3>
            <p className="text-gray-600 text-sm">Track views, likes, and engagement</p>
            <div className="mt-4 bg-gray-100 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-400">0</div>
              <div className="text-sm text-gray-500">Total Content Items</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">🗂️ Organize Content</h3>
            <p className="text-gray-600 text-sm">Create folders and manage categories</p>
            <div className="mt-4 space-y-2">
              <div className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-500">📁 Music</div>
              <div className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-500">📁 Videos</div>
              <div className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-500">📁 Photos</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">⚙️ Content Settings</h3>
            <p className="text-gray-600 text-sm">Manage privacy and subscription tiers</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Public</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subscribers Only</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Premium Tier</span>
                <span className="text-sm font-medium">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
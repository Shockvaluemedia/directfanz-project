'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FanCampaignsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (session.user.role !== 'FAN') {
      router.push('/dashboard/artist');
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

  if (!session || session.user.role !== 'FAN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Campaigns</h1>
          <p className="mt-2 text-gray-600">Track your campaign participation and progress</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Your Campaign Activity</h3>
            <p className="text-gray-600 mb-6">
              This feature is coming soon! You'll be able to view all campaigns you've joined,
              track your submissions, and see your progress and rewards.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/dashboard/fan')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium mr-4"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/campaigns')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Discover Campaigns
              </button>
            </div>
          </div>
        </div>

        {/* Sample campaign cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-300">
            <h3 className="font-semibold text-gray-900 mb-2">🎵 Active Campaigns</h3>
            <p className="text-gray-600 text-sm">Campaigns you're currently participating in</p>
            <div className="mt-4 text-2xl font-bold text-blue-600">0</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-300">
            <h3 className="font-semibold text-gray-900 mb-2">🏅 Completed</h3>
            <p className="text-gray-600 text-sm">Campaigns you've successfully completed</p>
            <div className="mt-4 text-2xl font-bold text-green-600">0</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-300">
            <h3 className="font-semibold text-gray-900 mb-2">🎁 Rewards Earned</h3>
            <p className="text-gray-600 text-sm">Total rewards from your participation</p>
            <div className="mt-4 text-2xl font-bold text-yellow-600">0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
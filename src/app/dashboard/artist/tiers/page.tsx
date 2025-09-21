'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ArtistTiersPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Subscription Tiers</h1>
          <p className="mt-2 text-gray-600">Configure your subscription pricing and benefits</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="text-6xl mb-4">💎</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Subscription Tier Management</h3>
            <p className="text-gray-600 mb-6">
              This feature is coming soon! You'll be able to create multiple subscription tiers,
              set pricing, define benefits, and manage subscriber access to exclusive content.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/dashboard/artist')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium mr-4"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/profile/settings')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Profile Settings
              </button>
            </div>
          </div>
        </div>

        {/* Tier examples */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Example Subscription Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-2 border-dashed border-gray-200">
              <div className="text-center">
                <div className="text-3xl mb-3">🥉</div>
                <h3 className="font-semibold text-gray-900 mb-2">Basic Tier</h3>
                <div className="text-2xl font-bold text-gray-600 mb-4">$5/month</div>
                <ul className="text-sm text-gray-600 space-y-2 text-left">
                  <li>• Access to basic content</li>
                  <li>• Monthly updates</li>
                  <li>• Community access</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
              <div className="text-center">
                <div className="text-3xl mb-3">🥈</div>
                <h3 className="font-semibold text-gray-900 mb-2">Premium Tier</h3>
                <div className="text-2xl font-bold text-purple-600 mb-4">$15/month</div>
                <ul className="text-sm text-gray-600 space-y-2 text-left">
                  <li>• All basic benefits</li>
                  <li>• Early access to content</li>
                  <li>• Behind-the-scenes content</li>
                  <li>• Direct messaging</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-2 border-yellow-200">
              <div className="text-center">
                <div className="text-3xl mb-3">🥇</div>
                <h3 className="font-semibold text-gray-900 mb-2">VIP Tier</h3>
                <div className="text-2xl font-bold text-yellow-600 mb-4">$50/month</div>
                <ul className="text-sm text-gray-600 space-y-2 text-left">
                  <li>• All premium benefits</li>
                  <li>• Exclusive live streams</li>
                  <li>• Personal shoutouts</li>
                  <li>• Custom content requests</li>
                  <li>• Priority support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
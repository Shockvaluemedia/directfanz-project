'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.email === 'admin@directfan.com';

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }
  }, [session, status, isAdmin, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="mt-2 text-gray-600">Comprehensive platform performance metrics</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
            <p className="text-gray-600 mb-6">
              This feature is coming soon! You'll be able to view detailed analytics,
              user engagement metrics, revenue reports, and performance dashboards.
            </p>
            <button
              onClick={() => router.back()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface Campaign {
  id: string;
  title: string;
  description: string;
  artistName: string;
  artistAvatar?: string;
  status: 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'DRAFT';
  startDate: string;
  endDate: string;
  goal?: string;
  progress?: number;
  participantCount?: number;
}

function getStatusStyle(status: Campaign['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700';
    case 'UPCOMING':
      return 'bg-blue-100 text-blue-700';
    case 'ENDED':
      return 'bg-gray-100 text-gray-600';
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function FanCampaignsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/campaigns');
      if (!res.ok) {
        throw new Error(`Failed to fetch campaigns: ${res.statusText}`);
      }
      const data = await res.json();
      setCampaigns(data.campaigns ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchCampaigns();
  }, [session, status, router, fetchCampaigns]);

  const filteredCampaigns =
    filterStatus === 'ALL'
      ? campaigns
      : campaigns.filter((c) => c.status === filterStatus);

  if (status === 'loading' || (loading && campaigns.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'FAN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            <p className="mt-2 text-gray-600">
              Discover campaigns from artists you follow
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/fan')}
            className="mt-4 sm:mt-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchCampaigns}
              className="text-red-600 hover:text-red-800 font-medium underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['ALL', 'ACTIVE', 'UPCOMING', 'ENDED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Campaign Cards */}
        {filteredCampaigns.length === 0 && !loading ? (
          <div className="bg-white shadow rounded-lg px-6 py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filterStatus === 'ALL'
                ? 'No campaigns available'
                : `No ${filterStatus.toLowerCase()} campaigns`}
            </h3>
            <p className="text-gray-600">
              Check back later for new campaigns from the artists you follow.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  {/* Status badge + artist */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">{campaign.artistName}</span>
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusStyle(campaign.status)}`}
                    >
                      {campaign.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {campaign.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {campaign.description}
                  </p>

                  {/* Goal & progress */}
                  {campaign.goal && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">{campaign.goal}</p>
                      {typeof campaign.progress === 'number' && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(campaign.progress, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                    <span>
                      {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                    </span>
                    {typeof campaign.participantCount === 'number' && (
                      <span>{campaign.participantCount} participants</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

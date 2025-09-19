'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SimpleNav from '@/components/simple-nav';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  participantCount: number;
  artist: {
    displayName: string;
  };
}

export default function CampaignDiscoveryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch('/api/campaigns');
        if (!response.ok) {
          throw new Error('Failed to load campaigns');
        }
        const data = await response.json();
        setCampaigns(data.campaigns);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, []);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 p-8'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-3xl font-bold mb-8'>Loading Campaigns...</h1>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {[1, 2, 3].map(i => (
              <div key={i} className='bg-white rounded-lg p-6 shadow animate-pulse'>
                <div className='h-4 bg-gray-200 rounded mb-4'></div>
                <div className='h-3 bg-gray-200 rounded mb-2'></div>
                <div className='h-3 bg-gray-200 rounded w-2/3'></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 p-8'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-3xl font-bold mb-8 text-red-600'>Error Loading Campaigns</h1>
          <p className='text-gray-600'>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <SimpleNav />
      <div className='p-8'>
        <div className='max-w-6xl mx-auto'>
          <h1 className='text-3xl font-bold text-gray-900 mb-8'>Discover Campaigns 🎯</h1>

          {campaigns.length === 0 ? (
            <div className='text-center py-12'>
              <h2 className='text-xl text-gray-600'>No campaigns found</h2>
              <p className='text-gray-500 mt-2'>Check back later for new campaigns!</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className='bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow'
                >
                  <div className='flex items-center gap-2 mb-3'>
                    <span className='text-2xl'>
                      {campaign.type === 'PROMOTIONAL' ? '📢' : '🏆'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>

                  <h3 className='text-lg font-bold text-gray-900 mb-2'>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className='hover:text-blue-600 transition-colors'
                    >
                      {campaign.title}
                    </Link>
                  </h3>

                  <p className='text-gray-600 text-sm mb-3 line-clamp-2'>{campaign.description}</p>

                  <p className='text-sm text-gray-500 mb-4'>by {campaign.artist.displayName}</p>

                  <div className='flex justify-between items-center'>
                    <span className='text-sm text-gray-600'>
                      👥 {campaign.participantCount || 0} participants
                    </span>

                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors'
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

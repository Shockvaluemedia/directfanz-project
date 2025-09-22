'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import SimpleNav from '@/components/simple-nav';

// Demo data for fallback when API is unavailable
function getDemoFanCampaigns(): Campaign[] {
  return [
    {
      id: 'demo-1',
      title: 'Summer Music Video Challenge',
      type: 'VIDEO_CONTEST',
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      artist: {
        name: 'Luna Sky',
      },
      userSubmissions: 3,
    },
    {
      id: 'demo-2', 
      title: 'Fan Art Showcase',
      type: 'ART_CONTEST',
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      artist: {
        name: 'Digital Dreams',
      },
      userSubmissions: 1,
    },
    {
      id: 'demo-3',
      title: 'Cover Song Competition', 
      type: 'MUSIC_CONTEST',
      status: 'COMPLETED',
      endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      artist: {
        name: 'Indie Collective',
      },
      userSubmissions: 5,
    },
  ];
}

interface Campaign {
  id: string;
  title: string;
  type: string;
  status: string;
  endDate: string;
  artist: {
    name: string;
  };
  userSubmissions: number;
}

export default function SimpleFanDashboard() {
  const { data: session } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('SimpleFanDashboard: Attempting to load campaigns...', { hasSession: !!session });
        
        // Try to load fan campaigns
        const response = await fetch('/api/fan/campaigns', {
          credentials: 'include', // Include cookies/session
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('SimpleFanDashboard: API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('SimpleFanDashboard: Campaign data loaded:', data);
          setCampaigns(data.campaigns || []);
        } else if (response.status === 401) {
          console.log('SimpleFanDashboard: Unauthorized - using demo data');
          setCampaigns(getDemoFanCampaigns());
        } else if (response.status === 500) {
          console.log('SimpleFanDashboard: Server error - using demo data while API is being fixed');
          setCampaigns(getDemoFanCampaigns());
        } else {
          console.error('SimpleFanDashboard: API error:', response.status, response.statusText);
          setCampaigns(getDemoFanCampaigns());
        }
      } catch (error) {
        console.error('SimpleFanDashboard: Error loading fan data:', error);
        console.log('SimpleFanDashboard: Using demo data as fallback');
        setCampaigns(getDemoFanCampaigns());
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      console.log('SimpleFanDashboard: Session found, loading data...', session.user);
      loadData();
    } else {
      console.log('SimpleFanDashboard: No session, skipping API calls');
      setLoading(false);
    }
  }, [session]);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 p-8'>
        <div className='max-w-6xl mx-auto'>
          <h1 className='text-3xl font-bold mb-8'>Loading Dashboard...</h1>
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

  return (
    <div className='min-h-screen bg-gray-50'>
      <SimpleNav />
      {/* Header */}
      <div className='bg-gradient-to-r from-pink-500 to-indigo-600 text-white p-8'>
        <div className='max-w-6xl mx-auto'>
          <h1 className='text-3xl font-bold mb-2'>
            Welcome back, {session?.user?.name || 'Fan'}! 🎵
          </h1>
          <p className='text-pink-100 text-lg'>
            Join artist campaigns, discover amazing content, and connect with the community.
          </p>
        </div>
      </div>

      <div className='max-w-6xl mx-auto p-8'>
        {/* Quick Actions */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12'>
          <Link
            href='/campaigns'
            className='bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow'
          >
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>🏆</span>
              <div>
                <h3 className='font-semibold'>Discover Campaigns</h3>
                <p className='text-sm text-gray-600'>Find new campaigns</p>
              </div>
            </div>
          </Link>

          <Link
            href='/dashboard/fan/campaigns'
            className='bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow'
          >
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>👥</span>
              <div>
                <h3 className='font-semibold'>My Campaigns</h3>
                <p className='text-sm text-gray-600'>{campaigns.length} active</p>
              </div>
            </div>
          </Link>

          <Link
            href='/messages'
            className='bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow'
          >
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>💬</span>
              <div>
                <h3 className='font-semibold'>Messages</h3>
                <p className='text-sm text-gray-600'>Chat with artists</p>
              </div>
            </div>
          </Link>

          <Link
            href='/dashboard/fan/subscriptions'
            className='bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow'
          >
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>❤️</span>
              <div>
                <h3 className='font-semibold'>Subscriptions</h3>
                <p className='text-sm text-gray-600'>Manage subscriptions</p>
              </div>
            </div>
          </Link>
        </div>

        {/* My Campaigns */}
        <div className='mb-12'>
          <h2 className='text-2xl font-bold mb-6'>My Campaigns</h2>

          {campaigns.length === 0 ? (
            <div className='bg-white rounded-lg p-8 text-center shadow'>
              <span className='text-4xl mb-4 block'>🏆</span>
              <h3 className='text-lg font-semibold mb-2'>No campaigns yet</h3>
              <p className='text-gray-600 mb-4'>
                Join artist campaigns to showcase your creativity
              </p>
              <Link
                href='/campaigns'
                className='bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors'
              >
                Discover Campaigns
              </Link>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className='bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow'
                >
                  <div className='flex items-center gap-2 mb-3'>
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

                  <h4 className='font-semibold text-gray-900 text-sm mb-2'>{campaign.title}</h4>

                  <p className='text-xs text-gray-600 mb-3'>by {campaign.artist.name}</p>

                  <div className='flex items-center justify-between text-xs text-gray-600 mb-4'>
                    <div>📝 {campaign.userSubmissions} submissions</div>
                    <div>📅 Ends {new Date(campaign.endDate).toLocaleDateString()}</div>
                  </div>

                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className='block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors'
                  >
                    View Campaign
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          <div className='bg-white rounded-lg p-6 shadow text-center'>
            <div className='text-2xl font-bold text-purple-600'>{campaigns.length}</div>
            <div className='text-sm text-gray-600'>Active Campaigns</div>
          </div>

          <div className='bg-white rounded-lg p-6 shadow text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {campaigns.reduce((sum, c) => sum + c.userSubmissions, 0)}
            </div>
            <div className='text-sm text-gray-600'>Total Submissions</div>
          </div>

          <div className='bg-white rounded-lg p-6 shadow text-center'>
            <div className='text-2xl font-bold text-yellow-600'>0</div>
            <div className='text-sm text-gray-600'>Featured Content</div>
          </div>

          <div className='bg-white rounded-lg p-6 shadow text-center'>
            <div className='text-2xl font-bold text-pink-600'>0</div>
            <div className='text-sm text-gray-600'>Active Subscriptions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

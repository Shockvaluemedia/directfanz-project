'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  ChartBarIcon,
  UsersIcon,
  TrophyIcon,
  CalendarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  totalParticipants: number;
  totalEngagement: number;
  challenges: Array<{
    id: string;
    title: string;
    status: string;
    participantCount: number;
  }>;
  _count: {
    challenges: number;
    rewards: number;
  };
}

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  ENDED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

const CAMPAIGN_TYPE_LABELS = {
  PROMOTIONAL: 'Promotional',
  CHALLENGE: 'Fan Challenge',
  ENGAGEMENT: 'Engagement',
  LAUNCH: 'Product Launch',
  COMMUNITY: 'Community Building',
  SEASONAL: 'Seasonal',
};

export default function CampaignsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

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

    fetchCampaigns();
  }, [session, status, router]);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');

      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    router.push('/dashboard/artist/campaigns/create');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDaysLeft = (endDate: string) => {
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  if (status === 'loading' || loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <LoadingSpinner size='lg' />
          <p className='mt-3 text-sm text-gray-600'>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        {/* Header */}
        <div className='mb-8 flex justify-between items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
              Campaigns & Challenges
            </h1>
            <p className='text-gray-600 dark:text-gray-400'>
              Create engaging campaigns to connect with your fans and grow your community
            </p>
          </div>
          <Button onClick={handleCreateCampaign} className='flex items-center gap-2'>
            <PlusIcon className='h-4 w-4' />
            Create Campaign
          </Button>
        </div>

        {campaigns.length === 0 ? (
          // Empty State
          <Card>
            <CardContent className='pt-8'>
              <div className='text-center py-12'>
                <TrophyIcon className='h-16 w-16 text-gray-400 mx-auto mb-4' />
                <h3 className='text-xl font-semibold text-gray-900 dark:text-white mb-2'>
                  No campaigns yet
                </h3>
                <p className='text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto'>
                  Start engaging with your fans by creating your first campaign. Set up challenges,
                  offer rewards, and build your community.
                </p>
                <Button onClick={handleCreateCampaign} size='lg'>
                  <PlusIcon className='h-5 w-5 mr-2' />
                  Create Your First Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Campaigns Grid
          <div className='space-y-6'>
            {/* Stats Overview */}
            <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
              <Card>
                <CardContent className='pt-6'>
                  <div className='flex items-center'>
                    <ChartBarIcon className='h-8 w-8 text-blue-600' />
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-gray-600'>Total Campaigns</p>
                      <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                        {campaigns.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className='pt-6'>
                  <div className='flex items-center'>
                    <UsersIcon className='h-8 w-8 text-green-600' />
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-gray-600'>Total Participants</p>
                      <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                        {campaigns.reduce((sum, c) => sum + c.totalParticipants, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className='pt-6'>
                  <div className='flex items-center'>
                    <TrophyIcon className='h-8 w-8 text-yellow-600' />
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-gray-600'>Active Challenges</p>
                      <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                        {campaigns.reduce(
                          (sum, c) =>
                            sum + c.challenges.filter(ch => ch.status === 'ACTIVE').length,
                          0
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className='pt-6'>
                  <div className='flex items-center'>
                    <EyeIcon className='h-8 w-8 text-purple-600' />
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-gray-600'>Total Engagement</p>
                      <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                        {campaigns.reduce((sum, c) => sum + c.totalEngagement, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaigns List */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {campaigns.map(campaign => {
                const daysLeft = calculateDaysLeft(campaign.endDate);
                const isActive = campaign.status === 'ACTIVE';
                const isEnded = campaign.status === 'ENDED' || daysLeft < 0;

                return (
                  <Card
                    key={campaign.id}
                    className='hover:shadow-lg transition-shadow cursor-pointer'
                  >
                    <CardHeader className='pb-3'>
                      <div className='flex justify-between items-start'>
                        <div className='flex-1'>
                          <CardTitle className='text-lg mb-1'>{campaign.title}</CardTitle>
                          <CardDescription className='text-sm line-clamp-2'>
                            {campaign.description}
                          </CardDescription>
                        </div>
                        <Badge
                          className={`ml-2 ${STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}`}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className='space-y-3'>
                        {/* Campaign Type */}
                        <div className='flex items-center text-sm text-gray-600'>
                          <span className='font-medium'>
                            {CAMPAIGN_TYPE_LABELS[
                              campaign.type as keyof typeof CAMPAIGN_TYPE_LABELS
                            ] || campaign.type}
                          </span>
                        </div>

                        {/* Dates */}
                        <div className='flex items-center justify-between text-sm'>
                          <div className='flex items-center text-gray-600'>
                            <CalendarIcon className='h-4 w-4 mr-1' />
                            {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                          </div>
                          {isActive && daysLeft > 0 && (
                            <span className='text-green-600 font-medium'>{daysLeft} days left</span>
                          )}
                          {isEnded && <span className='text-red-600 font-medium'>Ended</span>}
                        </div>

                        {/* Stats */}
                        <div className='grid grid-cols-3 gap-4 pt-3 border-t border-gray-200'>
                          <div className='text-center'>
                            <p className='text-lg font-bold text-gray-900 dark:text-white'>
                              {campaign.totalParticipants}
                            </p>
                            <p className='text-xs text-gray-600'>Participants</p>
                          </div>
                          <div className='text-center'>
                            <p className='text-lg font-bold text-gray-900 dark:text-white'>
                              {campaign._count.challenges}
                            </p>
                            <p className='text-xs text-gray-600'>Challenges</p>
                          </div>
                          <div className='text-center'>
                            <p className='text-lg font-bold text-gray-900 dark:text-white'>
                              {campaign._count.rewards}
                            </p>
                            <p className='text-xs text-gray-600'>Rewards</p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          variant='outline'
                          size='sm'
                          className='w-full mt-3'
                          onClick={() => router.push(`/dashboard/artist/campaigns/${campaign.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CampaignCard, { CampaignCardSkeleton } from '@/components/campaigns/campaign-card';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  targetMetric: string;
  targetValue: number;
  participantCount?: number;
  submissionCount?: number;
  createdAt: string;
  artist?: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  isParticipating?: boolean;
  userSubmissionCount?: number;
}

const CAMPAIGN_TYPES = [
  { value: 'ALL', label: 'All Types', icon: '🎨' },
  { value: 'PROMOTIONAL', label: 'Promotional', icon: '📢' },
  { value: 'CHALLENGE', label: 'Challenge', icon: '🏆' },
  { value: 'ENGAGEMENT', label: 'Engagement', icon: '💬' },
  { value: 'LAUNCH', label: 'Launch', icon: '🚀' },
  { value: 'COMMUNITY', label: 'Community', icon: '👥' },
  { value: 'SEASONAL', label: 'Seasonal', icon: '🎯' },
];

const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'most_participants', label: 'Most Popular' },
  { value: 'least_participants', label: 'Join First' },
];

const FILTER_STATUS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function CampaignDiscoveryPage() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'ACTIVE');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'trending');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mock data for demonstration
  const mockCampaigns: Campaign[] = [
    {
      id: '1',
      title: 'Summer Vibes Photo Contest',
      description: 'Share your best summer moments! Upload photos that capture the essence of summer - whether it\'s beach days, festivals, or just chilling with friends.',
      type: 'CHALLENGE',
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      targetMetric: 'PARTICIPANTS',
      targetValue: 500,
      participantCount: 342,
      submissionCount: 156,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      artist: {
        id: 'artist1',
        displayName: 'Sunny Martinez',
        avatar: undefined
      },
      isParticipating: false
    },
    {
      id: '2',
      title: 'New Album Launch Campaign',
      description: 'Help us celebrate the launch of "Midnight Dreams" - our latest album! Share what this music means to you.',
      type: 'LAUNCH',
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      targetMetric: 'ENGAGEMENT',
      targetValue: 1000,
      participantCount: 789,
      submissionCount: 234,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      artist: {
        id: 'artist2',
        displayName: 'Echo Waves',
        avatar: undefined
      },
      isParticipating: true,
      userSubmissionCount: 2
    },
    {
      id: '3',
      title: 'Fan Art Showcase',
      description: 'Show us your creative side! Draw, paint, or design anything inspired by our music and visual aesthetic.',
      type: 'COMMUNITY',
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      targetMetric: 'SUBMISSIONS',
      targetValue: 100,
      participantCount: 67,
      submissionCount: 45,
      createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      artist: {
        id: 'artist3',
        displayName: 'Neon Dreams',
        avatar: undefined
      },
      isParticipating: false
    },
    {
      id: '4',
      title: 'Holiday Cover Contest',
      description: 'Put your spin on classic holiday songs! Record your unique version and share it with the community.',
      type: 'SEASONAL',
      status: 'COMPLETED',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      targetMetric: 'PARTICIPANTS',
      targetValue: 200,
      participantCount: 234,
      submissionCount: 89,
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      artist: {
        id: 'artist4',
        displayName: 'Winter Harmony',
        avatar: undefined
      },
      isParticipating: true,
      userSubmissionCount: 1
    },
  ];

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedType !== 'ALL') queryParams.set('type', selectedType);
        if (selectedStatus !== 'ALL') queryParams.set('status', selectedStatus);
        queryParams.set('limit', '20');
        
        const response = await fetch(`/api/campaigns?${queryParams}`);
        if (!response.ok) {
          throw new Error('Failed to fetch campaigns');
        }
        
        const data = await response.json();
        const transformedCampaigns = data.campaigns.map((campaign: any) => ({
          id: campaign.id,
          title: campaign.title,
          description: campaign.description || '',
          type: campaign.type,
          status: campaign.status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          targetMetric: campaign.targetMetric,
          targetValue: campaign.targetValue,
          participantCount: campaign.participantCount || 0,
          submissionCount: campaign.submissionCount || 0,
          createdAt: campaign.createdAt,
          artist: {
            id: campaign.artist.id,
            displayName: campaign.artist.displayName,
            avatar: campaign.artist.avatar
          },
          isParticipating: false, // This would be populated from participation data
          userSubmissionCount: 0
        }));
        
        setCampaigns(transformedCampaigns);
      } catch (error) {
        console.error('Error loading campaigns:', error);
        // Fall back to mock data on error
        setCampaigns(mockCampaigns);
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [selectedType, selectedStatus]);

  // Filter and sort campaigns
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = campaigns;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(campaign =>
        campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.artist?.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType !== 'ALL') {
      filtered = filtered.filter(campaign => campaign.type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter(campaign => campaign.status === selectedStatus);
    }

    // Sort campaigns
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'ending_soon':
        filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
        break;
      case 'most_participants':
        filtered.sort((a, b) => (b.participantCount || 0) - (a.participantCount || 0));
        break;
      case 'least_participants':
        filtered.sort((a, b) => (a.participantCount || 0) - (b.participantCount || 0));
        break;
      case 'trending':
      default:
        // Sort by a combination of recent activity and participant count
        filtered.sort((a, b) => {
          const aScore = (a.participantCount || 0) + (a.submissionCount || 0) * 2;
          const bScore = (b.participantCount || 0) + (b.submissionCount || 0) * 2;
          return bScore - aScore;
        });
        break;
    }

    return filtered;
  }, [campaigns, searchTerm, selectedType, selectedStatus, sortBy]);

  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
  const totalParticipants = campaigns.reduce((sum, c) => sum + (c.participantCount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Discover Campaigns
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Join exciting campaigns from your favorite artists and connect with the community
          </p>

          {/* Stats */}
          <div className="flex gap-6 mt-4 text-sm text-gray-600">
            <span>🎯 {activeCount} Active Campaigns</span>
            <span>👥 {totalParticipants.toLocaleString()} Total Participants</span>
            <span>✨ {campaigns.length} Total Campaigns</span>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Search Bar */}
            <div className="mb-4">
              <Input
                placeholder="Search campaigns, artists, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Campaign Types */}
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    variant={selectedType === type.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(type.value)}
                    className="text-xs"
                  >
                    <span className="mr-1">{type.icon}</span>
                    {type.label}
                  </Button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 rounded-md border border-gray-300 text-sm"
              >
                {FILTER_STATUS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 rounded-md border border-gray-300 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Sort: {option.label}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none border-0"
                >
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none border-0"
                >
                  List
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredAndSortedCampaigns.length} campaign{filteredAndSortedCampaigns.length !== 1 ? 's' : ''}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>

        {/* Campaign Grid/List */}
        {loading ? (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} compact={viewMode === 'list'} />
            ))}
          </div>
        ) : filteredAndSortedCampaigns.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredAndSortedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedType !== 'ALL' || selectedStatus !== 'ALL'
                  ? "Try adjusting your filters or search terms"
                  : "No campaigns are currently available"}
              </p>
              {(searchTerm || selectedType !== 'ALL' || selectedStatus !== 'ALL') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('ALL');
                    setSelectedStatus('ACTIVE');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
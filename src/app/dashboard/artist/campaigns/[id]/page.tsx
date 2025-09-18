'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CampaignEditModal from '@/components/campaigns/campaign-edit-modal';
import CampaignAnalytics from '@/components/campaigns/campaign-analytics';

// Types
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
  createdAt: string;
  updatedAt: string;
  // Analytics data
  participantCount?: number;
  submissionCount?: number;
  engagementRate?: number;
  completionRate?: number;
}

const StatusBadge = ({ status }: { status: Campaign['status'] }) => {
  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Badge className={`${getStatusColor(status)} border`}>
      {status}
    </Badge>
  );
};

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const campaignId = params.id as string;

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

    fetchCampaign();
  }, [session, status, router, campaignId]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Campaign not found');
          router.push('/dashboard/artist/campaigns');
          return;
        }
        throw new Error('Failed to fetch campaign');
      }
      
      const data = await response.json();
      setCampaign(data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Campaign['status']) => {
    if (!campaign) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign status');
      }

      const updatedCampaign = await response.json();
      setCampaign(updatedCampaign);
      toast.success(`Campaign ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign status');
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete campaign');
      }

      toast.success('Campaign deleted successfully');
      router.push('/dashboard/artist/campaigns');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    }
  };

  const handleSaveCampaign = (updatedCampaign: Campaign) => {
    setCampaign(updatedCampaign);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
          <Button onClick={() => router.push('/dashboard/artist/campaigns')}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(campaign.endDate);
  const isActive = campaign.status === 'ACTIVE';
  const canEdit = ['DRAFT', 'PAUSED'].includes(campaign.status);
  const canActivate = ['DRAFT', 'PAUSED'].includes(campaign.status);
  const canPause = campaign.status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard/artist/campaigns')}
            >
              ← Back to Campaigns
            </Button>
            
            <div className="flex gap-2">
              {canEdit && (
                <Button 
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Campaign
                </Button>
              )}
              
              {canActivate && (
                <Button 
                  onClick={() => handleStatusChange('ACTIVE')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {campaign.status === 'DRAFT' ? 'Launch Campaign' : 'Resume Campaign'}
                </Button>
              )}
              
              {canPause && (
                <Button 
                  variant="outline"
                  onClick={() => handleStatusChange('PAUSED')}
                >
                  Pause Campaign
                </Button>
              )}
              
              <Button 
                variant="destructive"
                onClick={handleDeleteCampaign}
              >
                Delete
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {campaign.title}
              </h1>
              <div className="flex items-center gap-4">
                <StatusBadge status={campaign.status} />
                <span className="text-sm text-gray-600">
                  {campaign.type.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-600">
                  Created {formatDate(campaign.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-gray-600">{campaign.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Start Date</h4>
                    <p className="text-sm">{formatDate(campaign.startDate)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">End Date</h4>
                    <p className="text-sm">{formatDate(campaign.endDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Target Metric</h4>
                    <p className="text-sm">{campaign.targetMetric}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Target Value</h4>
                    <p className="text-sm">{campaign.targetValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <StatusBadge status={campaign.status} />
                  </div>
                  
                  {isActive && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Days Remaining</span>
                      <span className="text-sm font-medium">
                        {daysRemaining > 0 ? `${daysRemaining} days` : 'Ended'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Participants</span>
                    <span className="text-sm font-medium">
                      {campaign.participantCount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Submissions</span>
                    <span className="text-sm font-medium">
                      {campaign.submissionCount?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Goal Progress</span>
                      <span className="text-sm">
                        {campaign.participantCount || 0}/{campaign.targetValue}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, ((campaign.participantCount || 0) / campaign.targetValue) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  {campaign.engagementRate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Engagement Rate</span>
                      <span className="text-sm font-medium">
                        {campaign.engagementRate.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Analytics Dashboard */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Campaign Analytics</h2>
          <CampaignAnalytics campaign={campaign} />
        </div>
      </div>

      {/* Edit Modal */}
      {campaign && (
        <CampaignEditModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          campaign={campaign}
          onSave={handleSaveCampaign}
        />
      )}
    </div>
  );
}

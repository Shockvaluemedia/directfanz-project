'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Campaign {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  targetMetric: string;
  targetValue: number;
  participantCount?: number;
  submissionCount?: number;
  engagementRate?: number;
  completionRate?: number;
}

interface CampaignAnalyticsProps {
  campaign: Campaign;
}

// Simple chart component for progress visualization
const SimpleProgressChart = ({
  current,
  target,
  label,
  color = 'bg-blue-600',
}: {
  current: number;
  target: number;
  label: string;
  color?: string;
}) => {
  const percentage = Math.min(100, (current / target) * 100);

  return (
    <div className='space-y-2'>
      <div className='flex justify-between text-sm'>
        <span className='text-gray-600'>{label}</span>
        <span className='font-medium'>
          {current.toLocaleString()}/{target.toLocaleString()}
        </span>
      </div>
      <div className='w-full bg-gray-200 rounded-full h-2'>
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className='text-right text-xs text-gray-500'>{percentage.toFixed(1)}% complete</div>
    </div>
  );
};

// Activity timeline component
const ActivityTimeline = ({ campaign }: { campaign: Campaign }) => {
  const activities = [
    {
      date: campaign.startDate,
      type: 'campaign_started',
      title: 'Campaign launched',
      description: 'Campaign went live and started accepting participants',
    },
    // Mock activities - in real implementation, these would come from API
    {
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'milestone',
      title: 'First 50 participants reached',
      description: 'Campaign gained momentum with early adopters',
    },
    {
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'engagement',
      title: 'High engagement day',
      description: 'Received 25 new submissions in a single day',
    },
  ];

  return (
    <div className='space-y-4'>
      {activities.map((activity, index) => (
        <div key={index} className='flex gap-3'>
          <div className='flex-shrink-0'>
            <div className='w-2 h-2 bg-blue-600 rounded-full mt-2'></div>
          </div>
          <div className='flex-1'>
            <div className='flex justify-between items-start'>
              <h4 className='text-sm font-medium'>{activity.title}</h4>
              <span className='text-xs text-gray-500'>
                {new Date(activity.date).toLocaleDateString()}
              </span>
            </div>
            <p className='text-sm text-gray-600 mt-1'>{activity.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// Engagement metrics component
const EngagementMetrics = ({ campaign }: { campaign: Campaign }) => {
  // Mock data - in real implementation, this would come from analytics API
  const metrics = [
    {
      label: 'Daily Active Participants',
      value: Math.floor((campaign.participantCount || 0) * 0.3),
      change: '+12%',
    },
    {
      label: 'Avg. Submissions per User',
      value: (campaign.submissionCount || 0) / (campaign.participantCount || 1),
      change: '+5%',
    },
    {
      label: 'Social Shares',
      value: Math.floor((campaign.participantCount || 0) * 0.8),
      change: '+18%',
    },
    {
      label: 'Conversion Rate',
      value: campaign.completionRate || 0,
      change: '-2%',
      isPercentage: true,
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-4'>
      {metrics.map((metric, index) => (
        <div key={index} className='bg-gray-50 rounded-lg p-3'>
          <div className='text-xs text-gray-500 mb-1'>{metric.label}</div>
          <div className='flex items-end justify-between'>
            <span className='text-lg font-semibold'>
              {metric.isPercentage ? `${metric.value.toFixed(1)}%` : metric.value.toLocaleString()}
            </span>
            <span
              className={`text-xs ${
                metric.change.startsWith('+')
                  ? 'text-green-600'
                  : metric.change.startsWith('-')
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {metric.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function CampaignAnalytics({ campaign }: CampaignAnalyticsProps) {
  const getDaysRunning = () => {
    const start = new Date(campaign.startDate);
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getDaysRemaining = () => {
    const end = new Date(campaign.endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysRunning = getDaysRunning();
  const daysRemaining = getDaysRemaining();
  const totalDays = daysRunning + daysRemaining;
  const campaignProgress = totalDays > 0 ? (daysRunning / totalDays) * 100 : 0;

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {/* Key Metrics Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Primary Goal Progress */}
          <SimpleProgressChart
            current={campaign.participantCount || 0}
            target={campaign.targetValue}
            label={`Goal: ${campaign.targetMetric}`}
            color='bg-blue-600'
          />

          {/* Campaign Timeline Progress */}
          <SimpleProgressChart
            current={daysRunning}
            target={totalDays}
            label='Campaign Timeline'
            color='bg-green-600'
          />

          {/* Submissions Progress (if applicable) */}
          {campaign.submissionCount !== undefined && (
            <SimpleProgressChart
              current={campaign.submissionCount}
              target={Math.max(campaign.submissionCount * 2, 50)} // Mock target
              label='Submissions Received'
              color='bg-purple-600'
            />
          )}
        </CardContent>
      </Card>

      {/* Engagement Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementMetrics campaign={campaign} />
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.participantCount && campaign.participantCount > 0 ? (
            <ActivityTimeline campaign={campaign} />
          ) : (
            <div className='text-center py-8 text-gray-500'>
              <p>No activity yet</p>
              <p className='text-sm'>
                Activity will appear once the campaign starts receiving participants
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Summary</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div className='bg-blue-50 rounded-lg p-3'>
              <div className='text-blue-600 font-semibold'>{campaign.participantCount || 0}</div>
              <div className='text-blue-700'>Total Participants</div>
            </div>

            <div className='bg-green-50 rounded-lg p-3'>
              <div className='text-green-600 font-semibold'>{daysRemaining}</div>
              <div className='text-green-700'>Days Remaining</div>
            </div>

            <div className='bg-purple-50 rounded-lg p-3'>
              <div className='text-purple-600 font-semibold'>{campaign.submissionCount || 0}</div>
              <div className='text-purple-700'>Submissions</div>
            </div>

            <div className='bg-orange-50 rounded-lg p-3'>
              <div className='text-orange-600 font-semibold'>
                {campaign.engagementRate?.toFixed(1) || '0.0'}%
              </div>
              <div className='text-orange-700'>Engagement Rate</div>
            </div>
          </div>

          {campaign.status === 'ACTIVE' && (
            <div className='pt-4 border-t'>
              <div className='flex justify-between text-sm'>
                <span>Campaign Progress</span>
                <span>{campaignProgress.toFixed(1)}% complete</span>
              </div>
              <div className='w-full bg-gray-200 rounded-full h-2 mt-2'>
                <div
                  className='bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500'
                  style={{ width: `${campaignProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

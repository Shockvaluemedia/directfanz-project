'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  // Artist info
  artist?: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  // Additional fan-facing data
  isParticipating?: boolean;
  userSubmissionCount?: number;
}

interface CampaignCardProps {
  campaign: Campaign;
  showActions?: boolean;
  compact?: boolean;
}

const CampaignTypeIcon = ({ type }: { type: string }) => {
  const getIcon = () => {
    switch (type) {
      case 'PROMOTIONAL':
        return '📢';
      case 'CHALLENGE':
        return '🏆';
      case 'ENGAGEMENT':
        return '💬';
      case 'LAUNCH':
        return '🚀';
      case 'COMMUNITY':
        return '👥';
      case 'SEASONAL':
        return '🎯';
      default:
        return '🎨';
    }
  };

  return <span className='text-lg'>{getIcon()}</span>;
};

const StatusBadge = ({ status }: { status: Campaign['status'] }) => {
  const getStatusConfig = (status: Campaign['status']) => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Live' };
      case 'PAUSED':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Paused' };
      case 'COMPLETED':
        return { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Completed' };
      case 'CANCELLED':
        return { color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' };
      case 'DRAFT':
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Draft' };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: status };
    }
  };

  const config = getStatusConfig(status);

  return <Badge className={`${config.color} border text-xs`}>{config.label}</Badge>;
};

const ProgressBar = ({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label?: string;
}) => {
  const percentage = Math.min(100, (current / target) * 100);

  return (
    <div className='space-y-1'>
      {label && (
        <div className='flex justify-between text-xs text-gray-600'>
          <span>{label}</span>
          <span>
            {current.toLocaleString()}/{target.toLocaleString()}
          </span>
        </div>
      )}
      <div className='w-full bg-gray-200 rounded-full h-1.5'>
        <div
          className='bg-blue-600 h-1.5 rounded-full transition-all duration-300'
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const TimeRemaining = ({ endDate }: { endDate: string }) => {
  const getDaysRemaining = () => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const days = getDaysRemaining();

  if (days <= 0) {
    return <span className='text-xs text-red-600'>Ended</span>;
  } else if (days === 1) {
    return <span className='text-xs text-orange-600'>Ends today</span>;
  } else if (days <= 3) {
    return <span className='text-xs text-orange-600'>{days} days left</span>;
  } else if (days <= 7) {
    return <span className='text-xs text-blue-600'>{days} days left</span>;
  } else {
    return <span className='text-xs text-gray-600'>{days} days left</span>;
  }
};

export default function CampaignCard({
  campaign,
  showActions = true,
  compact = false,
}: CampaignCardProps) {
  const canParticipate = campaign.status === 'ACTIVE' && !campaign.isParticipating;
  const isActive = campaign.status === 'ACTIVE';

  return (
    <Card
      className={`hover:shadow-md transition-shadow duration-200 ${compact ? 'h-auto' : 'h-full'}`}
    >
      <CardHeader className={`pb-3 ${compact ? 'p-4' : ''}`}>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3 flex-1 min-w-0'>
            <CampaignTypeIcon type={campaign.type} />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 mb-1'>
                <h3 className={`font-semibold truncate ${compact ? 'text-sm' : 'text-lg'}`}>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className='hover:text-blue-600 transition-colors'
                  >
                    {campaign.title}
                  </Link>
                </h3>
                <StatusBadge status={campaign.status} />
              </div>
              {campaign.artist && (
                <p className='text-sm text-gray-600 truncate'>by {campaign.artist.displayName}</p>
              )}
            </div>
          </div>
        </div>

        {!compact && (
          <p className='text-sm text-gray-600 line-clamp-2 mt-2'>{campaign.description}</p>
        )}
      </CardHeader>

      <CardContent className={`pt-0 ${compact ? 'px-4 pb-4' : ''}`}>
        <div className='space-y-3'>
          {/* Progress */}
          <ProgressBar
            current={campaign.participantCount || 0}
            target={campaign.targetValue}
            label={campaign.targetMetric}
          />

          {/* Stats Row */}
          <div className='flex justify-between text-sm text-gray-600'>
            <div className='flex items-center gap-4'>
              <span>👥 {campaign.participantCount?.toLocaleString() || '0'}</span>
              {campaign.submissionCount !== undefined && (
                <span>📝 {campaign.submissionCount.toLocaleString()}</span>
              )}
            </div>
            {isActive && <TimeRemaining endDate={campaign.endDate} />}
          </div>

          {/* User's participation status */}
          {campaign.isParticipating && (
            <div className='flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2'>
              <span className='text-sm text-blue-800'>✅ Participating</span>
              {campaign.userSubmissionCount !== undefined && campaign.userSubmissionCount > 0 && (
                <span className='text-xs text-blue-600'>
                  {campaign.userSubmissionCount} submission
                  {campaign.userSubmissionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className='flex gap-2'>
              <Button asChild variant='outline' size='sm' className='flex-1'>
                <Link href={`/campaigns/${campaign.id}`}>View Details</Link>
              </Button>

              {canParticipate && (
                <Button size='sm' className='flex-1' asChild>
                  <Link href={`/campaigns/${campaign.id}?action=join`}>Join Campaign</Link>
                </Button>
              )}

              {campaign.isParticipating && isActive && (
                <Button size='sm' variant='default' className='flex-1' asChild>
                  <Link href={`/campaigns/${campaign.id}?action=submit`}>Submit</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton component for loading states
export function CampaignCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className={`animate-pulse ${compact ? 'h-auto' : 'h-full'}`}>
      <CardHeader className={`pb-3 ${compact ? 'p-4' : ''}`}>
        <div className='flex items-start gap-3'>
          <div className='w-6 h-6 bg-gray-200 rounded'></div>
          <div className='flex-1 space-y-2'>
            <div className='h-4 bg-gray-200 rounded w-3/4'></div>
            <div className='h-3 bg-gray-200 rounded w-1/2'></div>
          </div>
        </div>
        {!compact && (
          <div className='space-y-2 mt-2'>
            <div className='h-3 bg-gray-200 rounded'></div>
            <div className='h-3 bg-gray-200 rounded w-2/3'></div>
          </div>
        )}
      </CardHeader>
      <CardContent className={`pt-0 ${compact ? 'px-4 pb-4' : ''}`}>
        <div className='space-y-3'>
          <div className='h-2 bg-gray-200 rounded-full'></div>
          <div className='flex justify-between'>
            <div className='h-3 bg-gray-200 rounded w-16'></div>
            <div className='h-3 bg-gray-200 rounded w-20'></div>
          </div>
          <div className='flex gap-2'>
            <div className='h-8 bg-gray-200 rounded flex-1'></div>
            <div className='h-8 bg-gray-200 rounded flex-1'></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import React, { useState } from 'react';
import { StreamingProvider } from '@/contexts/streaming-context';
import { StreamSetup } from './stream-setup';
import { StreamControlPanel } from './stream-control-panel';
import { StreamViewer } from './stream-viewer';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import {
  Video,
  Play,
  Settings,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  Eye,
  Heart,
  DollarSign,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamingDashboardProps {
  userId: string;
  userInfo: {
    id: string;
    name: string;
    avatar: string;
    isSubscriber: boolean;
    isModerator: boolean;
  };
  mode?: 'streamer' | 'viewer';
  streamId?: string; // For viewer mode
  className?: string;
}

type DashboardView = 'overview' | 'setup' | 'streaming' | 'viewer';

export function StreamingDashboard({ 
  userId, 
  userInfo, 
  mode = 'streamer',
  streamId,
  className 
}: StreamingDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>(
    mode === 'viewer' ? 'viewer' : 'overview'
  );

  // Mock data for demo purposes
  const streamStats = {
    totalStreams: 24,
    totalViewers: 1250,
    totalHours: 87.5,
    totalEarnings: 2459.75,
    avgViewers: 52,
    lastStreamViews: 189,
    followersGained: 45,
    subscriptionsGained: 12
  };

  const recentStreams = [
    {
      id: '1',
      title: 'Late Night Coding Session',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      viewers: 89,
      duration: 180, // minutes
      earnings: 127.50
    },
    {
      id: '2',
      title: 'Music Production Tutorial',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      viewers: 145,
      duration: 120,
      earnings: 203.25
    },
    {
      id: '3',
      title: 'Q&A with Fans',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      viewers: 67,
      duration: 90,
      earnings: 89.75
    }
  ];

  const handleStreamStarted = () => {
    setCurrentView('streaming');
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Streaming Dashboard</h1>
        <p className="text-gray-600">Manage your live streams and connect with your audience</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnhancedCard variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
          <EnhancedCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">Go Live Now</h3>
                <p className="text-sm text-gray-600">Start streaming instantly with quick setup</p>
              </div>
              <EnhancedButton 
                variant="primary" 
                size="lg"
                onClick={() => setCurrentView('setup')}
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </EnhancedButton>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        <EnhancedCard variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
          <EnhancedCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">Schedule Stream</h3>
                <p className="text-sm text-gray-600">Plan your next live stream session</p>
              </div>
              <EnhancedButton variant="secondary" size="lg">
                <Clock className="w-4 h-4 mr-2" />
                Schedule
              </EnhancedButton>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <EnhancedCard variant="elevated">
          <EnhancedCardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">{streamStats.totalStreams}</div>
            <div className="text-sm text-gray-600">Total Streams</div>
          </EnhancedCardContent>
        </EnhancedCard>

        <EnhancedCard variant="elevated">
          <EnhancedCardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">{streamStats.totalViewers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Viewers</div>
          </EnhancedCardContent>
        </EnhancedCard>

        <EnhancedCard variant="elevated">
          <EnhancedCardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">${streamStats.totalEarnings.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Earnings</div>
          </EnhancedCardContent>
        </EnhancedCard>

        <EnhancedCard variant="elevated">
          <EnhancedCardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">{streamStats.totalHours}h</div>
            <div className="text-sm text-gray-600">Hours Streamed</div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>

      {/* Performance Insights */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Performance Insights
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">{streamStats.avgViewers}</div>
              <div className="text-sm text-gray-600">Average Viewers</div>
              <div className="text-xs text-green-600 mt-1">+15% from last month</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600 mb-2">{streamStats.followersGained}</div>
              <div className="text-sm text-gray-600">New Followers</div>
              <div className="text-xs text-green-600 mt-1">+28% from last week</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">{streamStats.subscriptionsGained}</div>
              <div className="text-sm text-gray-600">New Subscribers</div>
              <div className="text-xs text-green-600 mt-1">+42% from last week</div>
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Recent Streams */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle>Recent Streams</EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="space-y-4">
            {recentStreams.map(stream => (
              <div key={stream.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-gray-300 rounded flex items-center justify-center">
                    <Video className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{stream.title}</h4>
                    <p className="text-sm text-gray-600">
                      {stream.date.toLocaleDateString()} • {stream.duration} min
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Eye className="w-4 h-4" />
                    {stream.viewers}
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="w-4 h-4" />
                    {stream.earnings}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'overview':
        return renderOverview();
      case 'setup':
        return <StreamSetup onStreamStarted={handleStreamStarted} />;
      case 'streaming':
        return <StreamControlPanel />;
      case 'viewer':
        return streamId ? <StreamViewer streamId={streamId} /> : null;
      default:
        return renderOverview();
    }
  };

  return (
    <StreamingProvider userId={userId} userInfo={userInfo}>
      <div className={cn("min-h-screen bg-gray-50 p-6", className)}>
        <div className="max-w-7xl mx-auto">
          {/* Navigation */}
          {mode === 'streamer' && currentView !== 'viewer' && (
            <div className="mb-6">
              <nav className="flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setCurrentView('overview')}
                  className={cn(
                    "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                    currentView === 'overview'
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <TrendingUp className="w-5 h-5 inline mr-2" />
                  Overview
                </button>
                <button
                  onClick={() => setCurrentView('setup')}
                  className={cn(
                    "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                    currentView === 'setup'
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <Settings className="w-5 h-5 inline mr-2" />
                  Stream Setup
                </button>
                {currentView === 'streaming' && (
                  <button
                    onClick={() => setCurrentView('streaming')}
                    className="py-2 px-1 border-b-2 border-red-500 text-red-600 font-medium text-sm flex items-center gap-2"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live Now
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* Main Content */}
          {renderContent()}

          {/* Quick Stats Footer */}
          {currentView === 'overview' && (
            <div className="mt-8 p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Ready to go live?</h3>
                  <p className="text-indigo-100">Your audience is waiting for your next stream</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{streamStats.followersGained}</div>
                    <div className="text-xs text-indigo-200">New followers this week</div>
                  </div>
                  <EnhancedButton 
                    variant="secondary" 
                    size="lg"
                    onClick={() => setCurrentView('setup')}
                    className="bg-white text-indigo-600 hover:bg-gray-100"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Start Streaming
                  </EnhancedButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </StreamingProvider>
  );
}
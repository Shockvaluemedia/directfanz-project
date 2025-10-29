'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Bell, 
  Video, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Eye, 
  Heart, 
  Zap,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { EnhancedMessaging } from './EnhancedMessaging';
import { RealtimeNotifications, Notification } from './RealtimeNotifications';
import { LiveStreamInterface } from './LiveStreamInterface';
import { useSocket, usePresence } from '@/hooks/useSocket';

interface DashboardStats {
  totalViews: number;
  totalLikes: number;
  totalMessages: number;
  totalEarnings: number;
  activeViewers: number;
  newFollowers: number;
  engagementRate: number;
}

interface RealtimeDashboardProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  initialStats?: DashboardStats;
  className?: string;
}

const defaultStats: DashboardStats = {
  totalViews: 0,
  totalLikes: 0,
  totalMessages: 0,
  totalEarnings: 0,
  activeViewers: 0,
  newFollowers: 0,
  engagementRate: 0
};

export function RealtimeDashboard({
  userId,
  userName,
  userAvatar,
  initialStats = defaultStats,
  className = ''
}: RealtimeDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [activeTab, setActiveTab] = useState<'overview' | 'messaging' | 'streaming'>('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  
  const { socket, isConnected } = useSocket({ userId });
  const { presence } = usePresence(userId);

  // Real-time stats updates
  useEffect(() => {
    if (!socket) return;

    socket.on('stats_update', (updatedStats: Partial<DashboardStats>) => {
      setStats(prev => ({ ...prev, ...updatedStats }));
    });

    socket.on('new_notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
    });

    socket.on('new_message', (message: any) => {
      setMessages(prev => [message, ...prev.slice(0, 99)]);
    });

    return () => {
      socket.off('stats_update');
      socket.off('new_notification');
      socket.off('new_message');
    };
  }, [socket]);

  const handleNotificationRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    
    if (socket) {
      socket.emit('mark_notification_read', { notificationId, userId });
    }
  };

  const handleNotificationAction = (notification: Notification) => {
    // Handle notification click actions
    if (notification.actionUrl) {
      // Navigate to the relevant page/section
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    
    if (socket) {
      socket.emit('mark_all_notifications_read', { userId });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color = 'indigo' 
  }: {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ComponentType<any>;
    color?: string;
  }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {change !== undefined && (
            <div className={`flex items-center mt-2 ${
              change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-4 h-4 mr-1 ${
                change < 0 ? 'transform rotate-180' : ''
              }`} />
              <span className="text-sm font-medium">
                {change >= 0 ? '+' : ''}{change}%
              </span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </motion.div>
  );

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Views"
          value={stats.totalViews}
          icon={Eye}
          color="blue"
        />
        <StatCard
          title="Total Likes"
          value={stats.totalLikes}
          icon={Heart}
          color="red"
        />
        <StatCard
          title="Messages"
          value={stats.totalMessages}
          icon={MessageCircle}
          color="green"
        />
        <StatCard
          title="Earnings"
          value={`$${formatNumber(stats.totalEarnings)}`}
          icon={DollarSign}
          color="yellow"
        />
      </div>

      {/* Real-time Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Live Activity</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Active Viewers</span>
              <span className="font-medium">{stats.activeViewers}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">New Followers</span>
              <span className="font-medium text-green-600">+{stats.newFollowers}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Engagement Rate</span>
              <span className="font-medium">{stats.engagementRate}%</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Your Status</span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  presence.status === 'online' ? 'bg-green-500' :
                  presence.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                <span className="text-sm font-medium capitalize">{presence.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Notifications</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.slice(0, 5).map(notification => (
              <div key={notification.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  !notification.isRead ? 'bg-blue-500' : 'bg-gray-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500">
                    {notification.timestamp.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const MessagingTab = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-96">
      <EnhancedMessaging
        conversationId="dashboard-chat"
        currentUserId={userId}
        currentUserName={userName}
        messages={messages}
        participants={[
          {
            id: userId,
            name: userName,
            avatar: userAvatar,
            presence: presence.status,
            lastSeen: presence.lastSeen
          }
        ]}
        onSendMessage={async (content, type, replyTo) => {
          // Handle sending message
        }}
        onReactToMessage={async (messageId, emoji) => {
          // Handle message reaction
        }}
        onMarkAsRead={async (messageIds) => {
          // Handle marking messages as read
        }}
        className="h-full"
      />
    </div>
  );

  const StreamingTab = () => (
    <div className="space-y-6">
      <LiveStreamInterface
        stream={{
          id: 'user-stream',
          title: `${userName}'s Live Stream`,
          streamerId: userId,
          streamerName: userName,
          streamerAvatar: userAvatar,
          isLive: false,
          viewerCount: stats.activeViewers,
          startedAt: new Date(),
          category: 'Entertainment'
        }}
        currentUserId={userId}
        isStreamer={true}
        onStreamStart={() => {
          // Handle stream start
        }}
        onStreamEnd={() => {
          // Handle stream end
        }}
        onSendMessage={(message) => {
          // Handle chat message
        }}
        onSendTip={(amount, message) => {
          // Handle tip
        }}
      />
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-100 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                {userAvatar ? (
                  <img 
                    src={userAvatar} 
                    alt={userName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium">
                    {userName.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Real-time Dashboard
                </h1>
                <p className="text-sm text-gray-600">Welcome back, {userName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <RealtimeNotifications
                userId={userId}
                notifications={notifications}
                onNotificationRead={handleNotificationRead}
                onNotificationAction={handleNotificationAction}
                onMarkAllRead={handleMarkAllNotificationsRead}
              />

              <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </motion.button>

              <motion.button
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'messaging', name: 'Messaging', icon: MessageCircle },
              { id: 'streaming', name: 'Live Streaming', icon: Video }
            ].map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </motion.button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${
        isExpanded ? 'max-w-full px-2' : ''
      }`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'messaging' && <MessagingTab />}
            {activeTab === 'streaming' && <StreamingTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
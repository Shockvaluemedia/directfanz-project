'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Heart, 
  MessageCircle, 
  Users, 
  Gift, 
  Star, 
  Zap, 
  Volume2, 
  VolumeX,
  Settings,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  UserPlus,
  Camera,
  Mic,
  Calendar,
  Bookmark
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

export interface Notification {
  id: string;
  type: 
    | 'message' 
    | 'like' 
    | 'comment' 
    | 'follow' 
    | 'tip' 
    | 'subscription' 
    | 'live' 
    | 'system'
    | 'achievement'
    | 'reminder';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId?: string;
  userName?: string;
  userAvatar?: string;
  actionUrl?: string;
  isRead: boolean;
  metadata?: {
    [key: string]: any;
  };
}

interface Toast extends Notification {
  duration?: number;
  showProgress?: boolean;
}

interface RealtimeNotificationsProps {
  userId: string;
  notifications: Notification[];
  onNotificationRead: (notificationId: string) => Promise<void>;
  onNotificationAction: (notification: Notification) => void;
  onMarkAllRead: () => Promise<void>;
  soundEnabled?: boolean;
  onSoundToggle?: (enabled: boolean) => void;
  maxToasts?: number;
  className?: string;
}

const notificationIcons = {
  message: MessageCircle,
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  tip: DollarSign,
  subscription: Star,
  live: Camera,
  system: Info,
  achievement: Zap,
  reminder: Calendar
};

const priorityColors = {
  low: 'bg-gray-100 border-gray-300 text-gray-700',
  medium: 'bg-blue-50 border-blue-300 text-blue-700',
  high: 'bg-orange-50 border-orange-300 text-orange-700',
  urgent: 'bg-red-50 border-red-300 text-red-700'
};

const priorityBgColors = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500'
};

export function RealtimeNotifications({
  userId,
  notifications,
  onNotificationRead,
  onNotificationAction,
  onMarkAllRead,
  soundEnabled = true,
  onSoundToggle,
  maxToasts = 5,
  className = ''
}: RealtimeNotificationsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [soundEnabledState, setSoundEnabledState] = useState(soundEnabled);
  
  const { socket, isConnected } = useSocket();
  const audioRef = useRef<HTMLAudioElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      // Show toast
      showToast({
        ...notification,
        duration: getPriorityDuration(notification.priority),
        showProgress: true
      });

      // Play sound if enabled
      if (soundEnabledState && notification.priority !== 'low') {
        playNotificationSound(notification.type);
      }
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket, soundEnabledState]);

  const getPriorityDuration = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent': return 8000;
      case 'high': return 6000;
      case 'medium': return 4000;
      case 'low': return 3000;
      default: return 4000;
    }
  };

  const playNotificationSound = async (type: Notification['type']) => {
    if (!audioRef.current) return;

    // Different sounds for different notification types
    const soundMap = {
      message: '/sounds/message.mp3',
      like: '/sounds/like.mp3',
      comment: '/sounds/comment.mp3',
      follow: '/sounds/follow.mp3',
      tip: '/sounds/tip.mp3',
      subscription: '/sounds/subscription.mp3',
      live: '/sounds/live.mp3',
      system: '/sounds/system.mp3',
      achievement: '/sounds/achievement.mp3',
      reminder: '/sounds/reminder.mp3'
    };

    try {
      audioRef.current.src = soundMap[type] || '/sounds/default.mp3';
      await audioRef.current.play();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const showToast = useCallback((toast: Toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random()}`;
    const newToast = { ...toast, id };

    setToasts(prev => {
      const updated = [newToast, ...prev.slice(0, maxToasts - 1)];
      return updated;
    });

    // Auto-remove toast after duration
    if (toast.duration !== -1) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 4000);
    }
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await onNotificationRead(notification.id);
    }
    onNotificationAction(notification);
    setIsDropdownOpen(false);
  };

  const toggleSound = () => {
    const newState = !soundEnabledState;
    setSoundEnabledState(newState);
    onSoundToggle?.(newState);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.isRead);

  const ToastItem = ({ toast }: { toast: Toast }) => {
    const Icon = notificationIcons[toast.type] || Bell;
    const [progress, setProgress] = useState(100);
    
    useEffect(() => {
      if (!toast.showProgress || toast.duration === -1) return;

      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / ((toast.duration || 4000) / 100));
          return Math.max(0, newProgress);
        });
      }, 100);

      return () => clearInterval(interval);
    }, [toast.duration, toast.showProgress]);

    return (
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        layout
        className={`relative overflow-hidden bg-white rounded-lg shadow-large border-l-4 ${
          priorityBgColors[toast.priority]
        } mb-3 cursor-pointer group hover:shadow-xl transition-all duration-200`}
        onClick={() => handleNotificationClick(toast)}
      >
        {/* Progress bar */}
        {toast.showProgress && toast.duration !== -1 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
            <motion.div
              className={`h-full ${priorityBgColors[toast.priority]} opacity-60`}
              initial={{ width: '100%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                priorityColors[toast.priority]
              }`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {toast.title}
                  </h4>
                  {toast.priority === 'urgent' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Urgent
                    </span>
                  )}
                </div>
                
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {toast.message}
                </p>

                {toast.userName && (
                  <div className="flex items-center mt-2 space-x-2">
                    {toast.userAvatar ? (
                      <img 
                        src={toast.userAvatar} 
                        alt={toast.userName}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-medium">
                          {toast.userName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-700">
                      {toast.userName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="flex-shrink-0 p-1 ml-2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const Icon = notificationIcons[notification.type] || Bell;
    const timeAgo = getTimeAgo(notification.timestamp);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
          !notification.isRead ? 'bg-blue-50' : ''
        }`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            !notification.isRead ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`text-sm font-medium truncate ${
                !notification.isRead ? 'text-gray-900' : 'text-gray-700'
              }`}>
                {notification.title}
              </h4>
              <div className="flex items-center space-x-2">
                {notification.priority === 'urgent' && (
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                )}
                <span className="text-xs text-gray-500">{timeAgo}</span>
              </div>
            </div>

            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {notification.message}
            </p>

            {notification.userName && (
              <div className="flex items-center mt-2 space-x-2">
                {notification.userAvatar ? (
                  <img 
                    src={notification.userAvatar} 
                    alt={notification.userName}
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {notification.userName.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-xs text-gray-600">
                  {notification.userName}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className={className}>
      <audio ref={audioRef} preload="none" />
      
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 w-80 max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </div>

      {/* Notification Bell */}
      <div className="relative" ref={dropdownRef}>
        <motion.button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <Bell className="w-6 h-6" />
          
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-large border border-gray-200 z-50"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Notifications
                  </h3>
                  <div className="flex items-center space-x-2">
                    <motion.button
                      onClick={toggleSound}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                      whileTap={{ scale: 0.9 }}
                      title={soundEnabledState ? "Disable sounds" : "Enable sounds"}
                    >
                      {soundEnabledState ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </motion.button>
                    <motion.button
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                      whileTap={{ scale: 0.9 }}
                    >
                      <Settings className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex space-x-1">
                    <motion.button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filter === 'all' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      All
                    </motion.button>
                    <motion.button
                      onClick={() => setFilter('unread')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filter === 'unread' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      Unread ({unreadCount})
                    </motion.button>
                  </div>

                  {unreadCount > 0 && (
                    <motion.button
                      onClick={onMarkAllRead}
                      className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                      whileTap={{ scale: 0.95 }}
                    >
                      Mark all read
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map(notification => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification} 
                    />
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No notifications {filter === 'unread' ? 'to read' : 'yet'}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {filteredNotifications.length > 0 && (
                <div className="p-3 border-t border-gray-100 text-center">
                  <motion.button
                    className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    View all notifications
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
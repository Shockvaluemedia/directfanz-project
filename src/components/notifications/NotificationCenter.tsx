'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, Settings, Filter } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { TouchButton } from '../ui/TouchButton';
import { TouchCard } from '../ui/TouchCard';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  readAt?: string;
  createdAt: string;
  data?: Record<string, any>;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Fetch notifications when component mounts or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, filter, session]);

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'subscription_created':
        return '🎉';
      case 'payment_received':
        return '💰';
      case 'new_message':
        return '💬';
      case 'content_comment':
        return '💭';
      case 'security_alert':
        return '🔒';
      default:
        return '📢';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className='fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden' onClick={onClose} />

      {/* Notification Center */}
      <div className='fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 lg:relative lg:shadow-lg lg:rounded-lg lg:border lg:border-gray-200'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 bg-white'>
          <div className='flex items-center space-x-2'>
            <Bell size={20} className='text-gray-700' />
            <h2 className='text-lg font-semibold text-gray-900'>Notifications</h2>
            {unreadCount > 0 && (
              <span className='bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center'>
                {unreadCount}
              </span>
            )}
          </div>

          <div className='flex items-center space-x-2'>
            <TouchButton
              variant='ghost'
              size='sm'
              onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
              leftIcon={<Filter size={16} />}
            >
              {filter === 'all' ? 'Unread' : 'All'}
            </TouchButton>

            <TouchButton variant='ghost' size='sm' onClick={onClose} leftIcon={<X size={16} />} />
          </div>
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <div className='p-3 border-b border-gray-200 bg-gray-50'>
            <TouchButton
              variant='outline'
              size='sm'
              fullWidth
              onClick={markAllAsRead}
              leftIcon={<CheckCheck size={16} />}
            >
              Mark All as Read
            </TouchButton>
          </div>
        )}

        {/* Notifications List */}
        <div className='flex-1 overflow-y-auto max-h-[calc(100vh-200px)]'>
          {loading ? (
            <div className='flex items-center justify-center p-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600'></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className='text-center p-8'>
              <Bell size={48} className='mx-auto text-gray-400 mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </h3>
              <p className='text-gray-500'>
                {filter === 'unread'
                  ? 'All caught up! You have no unread notifications.'
                  : "You don't have any notifications yet."}
              </p>
            </div>
          ) : (
            <div className='divide-y divide-gray-100'>
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`
                    p-4 hover:bg-gray-50 transition-colors cursor-pointer
                    ${!notification.readAt ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                  `}
                  onClick={() => !notification.readAt && markAsRead(notification.id)}
                >
                  <div className='flex items-start space-x-3'>
                    {/* Icon */}
                    <div
                      className={`
                      flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg
                      ${getPriorityColor(notification.priority)}
                    `}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between'>
                        <h4
                          className={`
                          text-sm font-medium truncate
                          ${!notification.readAt ? 'text-gray-900' : 'text-gray-700'}
                        `}
                        >
                          {notification.title}
                        </h4>

                        <div className='flex items-center space-x-1 ml-2'>
                          <span className='text-xs text-gray-500 whitespace-nowrap'>
                            {formatTimeAgo(notification.createdAt)}
                          </span>

                          {/* Action buttons */}
                          <div className='flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            {!notification.readAt && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className='p-1 text-gray-400 hover:text-blue-600 rounded'
                                title='Mark as read'
                              >
                                <Check size={14} />
                              </button>
                            )}

                            <button
                              onClick={e => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className='p-1 text-gray-400 hover:text-red-600 rounded'
                              title='Delete'
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <p
                        className={`
                        text-sm mt-1
                        ${!notification.readAt ? 'text-gray-900' : 'text-gray-600'}
                      `}
                      >
                        {notification.message}
                      </p>

                      {/* Priority indicator */}
                      {notification.priority === 'urgent' && (
                        <div className='flex items-center mt-2'>
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                            Urgent
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='border-t border-gray-200 p-3 bg-white'>
          <TouchButton
            variant='ghost'
            size='sm'
            fullWidth
            leftIcon={<Settings size={16} />}
            onClick={() => window.open('/settings/notifications', '_blank')}
          >
            Notification Settings
          </TouchButton>
        </div>
      </div>
    </>
  );
}

// Notification Bell Component for Header
export function NotificationBell() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/notifications?unreadOnly=true');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch unread count on mount and set up polling
  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadCount();

      // Poll for updates every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors'
        aria-label='Notifications'
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile/Desktop Notification Center */}
      <div
        className={`
        ${isOpen ? 'block' : 'hidden'}
        absolute right-0 top-full mt-2 z-50
        lg:relative lg:right-auto lg:top-auto lg:mt-0
      `}
      >
        <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
}

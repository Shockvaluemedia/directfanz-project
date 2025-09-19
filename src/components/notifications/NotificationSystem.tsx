'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Music,
  X,
  Check,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Notification {
  id: string;
  type: 'comment' | 'like' | 'follow' | 'content' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    userId?: string;
    userName?: string;
    userImage?: string;
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
  };
}

interface NotificationSystemProps {
  className?: string;
}

export function NotificationSystem({ className }: NotificationSystemProps) {
  const { data: session } = useSession();
  const { sendMessage, subscribe, isConnected } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Handle real-time notifications
  const handleNewNotification = useCallback((notificationData: Notification) => {
    setNotifications(prev => [notificationData, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: notificationData.data?.userImage || '/favicon.ico',
        tag: notificationData.id,
      });
    }
  }, []);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected || !session?.user) return;

    const unsubscribe = subscribe('notification', handleNewNotification);

    return () => {
      unsubscribe();
    };
  }, [isConnected, session?.user, subscribe, handleNewNotification]);

  // Fetch notifications on mount
  useEffect(() => {
    if (!session?.user) return;

    fetchNotifications();
    requestNotificationPermission();
  }, [session?.user]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
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

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => (notif.id === notificationId ? { ...notif, read: true } : notif))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      });

      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageCircle className='h-4 w-4' />;
      case 'like':
        return <Heart className='h-4 w-4 text-red-500' />;
      case 'follow':
        return <UserPlus className='h-4 w-4 text-blue-500' />;
      case 'content':
        return <Music className='h-4 w-4 text-green-500' />;
      default:
        return <Bell className='h-4 w-4' />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <div
      className={`p-3 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors ${
        !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
      }`}
      onClick={() => !notification.read && markAsRead(notification.id)}
    >
      <div className='flex items-start space-x-3'>
        <div className='flex-shrink-0 mt-0.5'>
          {notification.data?.userImage ? (
            <Avatar className='w-8 h-8'>
              <AvatarImage src={notification.data.userImage} />
              <AvatarFallback>{notification.data.userName?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
              {getNotificationIcon(notification.type)}
            </div>
          )}
        </div>

        <div className='flex-grow min-w-0'>
          <div className='flex items-start justify-between'>
            <div className='flex-grow'>
              <p className='font-medium text-sm text-foreground'>{notification.title}</p>
              <p className='text-sm text-muted-foreground mt-1'>{notification.message}</p>
              <p className='text-xs text-muted-foreground mt-2'>
                {formatTimeAgo(notification.createdAt)}
              </p>
            </div>

            <div className='flex items-center space-x-1 ml-2'>
              {!notification.read && <div className='w-2 h-2 bg-blue-500 rounded-full' />}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                    <MoreHorizontal className='h-3 w-3' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {!notification.read && (
                    <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                      <Check className='h-3 w-3 mr-2' />
                      Mark as Read
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => deleteNotification(notification.id)}
                    className='text-destructive'
                  >
                    <Trash2 className='h-3 w-3 mr-2' />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!session?.user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='sm' className={`relative ${className}`}>
          <Bell className='h-5 w-5' />
          {unreadCount > 0 && (
            <Badge
              variant='destructive'
              className='absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center p-0 text-xs'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className='w-80 p-0' align='end'>
        <div className='border-b border-border p-4'>
          <div className='flex items-center justify-between'>
            <h3 className='font-semibold'>Notifications</h3>
            <div className='flex items-center space-x-2'>
              {unreadCount > 0 && (
                <Button variant='ghost' size='sm' onClick={markAllAsRead} className='text-xs'>
                  Mark all read
                </Button>
              )}
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsOpen(false)}
                className='h-6 w-6 p-0'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {isConnected && (
            <div className='flex items-center space-x-1 text-xs text-green-600 mt-2'>
              <div className='w-2 h-2 bg-green-500 rounded-full' />
              <span>Live updates enabled</span>
            </div>
          )}
        </div>

        <div className='max-h-96 overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center p-8'>
              <div className='animate-pulse text-sm text-muted-foreground'>
                Loading notifications...
              </div>
            </div>
          ) : notifications.length > 0 ? (
            notifications.map(notification => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          ) : (
            <div className='flex flex-col items-center justify-center p-8 text-center'>
              <Bell className='h-12 w-12 text-muted-foreground mb-4' />
              <h4 className='font-semibold mb-2'>No notifications yet</h4>
              <p className='text-sm text-muted-foreground'>
                You'll see updates about your content and interactions here.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

'use client';

import React, { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '@/components/providers/RealTimeProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationItemProps {
  notification: {
    id: string;
    type: 'subscription' | 'content' | 'message' | 'livestream' | 'tip' | 'comment' | 'like';
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    data?: Record<string, any>;
  };
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'subscription':
        return '👤';
      case 'content':
        return '📄';
      case 'message':
        return '💬';
      case 'livestream':
        return '🎥';
      case 'tip':
        return '💰';
      case 'comment':
        return '💭';
      case 'like':
        return '❤️';
      default:
        return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscription':
        return 'bg-green-100 text-green-800';
      case 'content':
        return 'bg-blue-100 text-blue-800';
      case 'message':
        return 'bg-purple-100 text-purple-800';
      case 'livestream':
        return 'bg-red-100 text-red-800';
      case 'tip':
        return 'bg-yellow-100 text-yellow-800';
      case 'comment':
        return 'bg-indigo-100 text-indigo-800';
      case 'like':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
  };

  return (
    <div
      className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
    >
      <div className='flex items-start gap-3'>
        <div className={`p-1.5 rounded-full text-sm ${getTypeColor(notification.type)}`}>
          {getTypeIcon(notification.type)}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between gap-2'>
            <h4 className='text-sm font-medium text-gray-900 truncate'>{notification.title}</h4>
            {!notification.read && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                className='text-gray-400 hover:text-gray-600 transition-colors p-1'
                title='Mark as read'
              >
                <Check size={12} />
              </button>
            )}
          </div>

          <p className='text-sm text-gray-600 mt-1 line-clamp-2'>{notification.message}</p>

          <div className='flex items-center justify-between mt-2'>
            <span className='text-xs text-gray-500'>{formatTimeAgo(notification.createdAt)}</span>

            {!notification.read && <div className='w-2 h-2 bg-blue-500 rounded-full' />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId);
  };

  const handleClearAll = () => {
    clearAll();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='sm' className='relative p-2 hover:bg-gray-100 rounded-full'>
          <Bell size={20} className='text-gray-600' />
          {unreadCount > 0 && (
            <Badge
              variant='destructive'
              className='absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align='end' className='w-80 p-0'>
        <DropdownMenuHeader className='p-4 border-b'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>Notifications</h3>
            {notifications.length > 0 && (
              <Button
                variant='ghost'
                size='sm'
                onClick={handleClearAll}
                className='text-gray-500 hover:text-gray-700'
              >
                <X size={16} className='mr-1' />
                Clear all
              </Button>
            )}
          </div>
          {unreadCount > 0 && (
            <p className='text-sm text-gray-600 mt-1'>
              {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
            </p>
          )}
        </DropdownMenuHeader>

        {notifications.length === 0 ? (
          <div className='p-8 text-center'>
            <Bell size={48} className='mx-auto text-gray-300 mb-4' />
            <h3 className='text-lg font-medium text-gray-900 mb-2'>No notifications</h3>
            <p className='text-gray-500'>You're all caught up! Check back later for new updates.</p>
          </div>
        ) : (
          <ScrollArea className='max-h-96'>
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </ScrollArea>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className='p-3'>
              <Button
                variant='ghost'
                size='sm'
                className='w-full text-center text-blue-600 hover:text-blue-700 hover:bg-blue-50'
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

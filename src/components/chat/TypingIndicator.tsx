'use client';

import React from 'react';
import { User } from '@/types/websocket';

interface TypingIndicatorProps {
  user: User;
  className?: string;
}

export function TypingIndicator({ user, className = '' }: TypingIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className='flex-shrink-0'>
        <img
          src={user.avatar || '/default-avatar.png'}
          alt={user.displayName}
          className='w-6 h-6 rounded-full'
        />
      </div>

      <div className='flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-2xl'>
        <span className='text-sm text-gray-600 dark:text-gray-400'>
          {user.displayName} is typing
        </span>

        {/* Animated dots */}
        <div className='flex space-x-1'>
          <div
            className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce'
            style={{ animationDelay: '0ms' }}
          />
          <div
            className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce'
            style={{ animationDelay: '150ms' }}
          />
          <div
            className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce'
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

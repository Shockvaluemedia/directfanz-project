'use client';

import React from 'react';
import { Message } from '@/types/websocket';

interface MessageStatusIndicatorProps {
  message: Message;
  className?: string;
}

export function MessageStatusIndicator({ message, className = '' }: MessageStatusIndicatorProps) {
  const getStatusIcon = () => {
    if (message.readAt) {
      // Message has been read
      return (
        <svg className='w-4 h-4 text-blue-500' fill='currentColor' viewBox='0 0 20 20'>
          <path
            fillRule='evenodd'
            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
            clipRule='evenodd'
          />
          <path
            fillRule='evenodd'
            d='M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6 14.586l7.293-7.293a1 1 0 011.414 0z'
            clipRule='evenodd'
          />
        </svg>
      );
    } else {
      // Message has been sent but not yet delivered
      return (
        <svg className='w-4 h-4 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
          <path
            fillRule='evenodd'
            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
            clipRule='evenodd'
          />
        </svg>
      );
    }
  };

  const getStatusText = () => {
    if (message.readAt) return 'Read';
    return 'Sent';
  };

  return (
    <div className={`inline-flex items-center ${className}`} title={getStatusText()}>
      {getStatusIcon()}
    </div>
  );
}

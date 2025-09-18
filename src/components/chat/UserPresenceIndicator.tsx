'use client';

import React from 'react';

interface UserPresenceIndicatorProps {
  isOnline: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UserPresenceIndicator({ 
  isOnline, 
  className = '',
  size = 'md'
}: UserPresenceIndicatorProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  const getStatusColor = () => {
    return isOnline ? 'bg-green-500' : 'bg-gray-400';
  };

  return (
    <div 
      className={`${getSizeClasses()} ${getStatusColor()} rounded-full border-2 border-white dark:border-gray-900 ${className}`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
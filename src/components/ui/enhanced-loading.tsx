'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Upload, Download, Music, Video, Image, FileText, Wifi, WifiOff } from 'lucide-react';
import { ProgressRing } from './animations';

interface LoadingStateProps {
  type?: 'default' | 'upload' | 'download' | 'processing' | 'connecting' | 'syncing';
  message?: string;
  progress?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ 
  type = 'default', 
  message, 
  progress, 
  className,
  size = 'md' 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const getLoadingIcon = () => {
    const iconClass = `${iconSizes[size]} animate-spin text-blue-500`;
    
    switch (type) {
      case 'upload':
        return <Upload className={iconClass} />;
      case 'download':
        return <Download className={iconClass} />;
      case 'processing':
        return <Loader2 className={iconClass} />;
      case 'connecting':
        return <Wifi className={iconClass} />;
      case 'syncing':
        return <Loader2 className={iconClass} />;
      default:
        return <Loader2 className={iconClass} />;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'upload': return 'Uploading files...';
      case 'download': return 'Downloading...';
      case 'processing': return 'Processing...';
      case 'connecting': return 'Connecting...';
      case 'syncing': return 'Syncing data...';
      default: return 'Loading...';
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
      {progress !== undefined ? (
        <ProgressRing progress={progress} size={size === 'lg' ? 80 : size === 'md' ? 60 : 40}>
          <span className={cn('font-semibold text-blue-600', sizeClasses[size])}>
            {Math.round(progress)}%
          </span>
        </ProgressRing>
      ) : (
        getLoadingIcon()
      )}
      
      <div className="text-center space-y-1">
        <p className={cn('font-medium text-gray-700 dark:text-gray-300', sizeClasses[size])}>
          {message || getDefaultMessage()}
        </p>
        {type === 'upload' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Please don't close this window
          </p>
        )}
      </div>
    </div>
  );
}

// Content-specific loading states
interface ContentLoadingProps {
  type: 'audio' | 'video' | 'image' | 'document';
  title?: string;
  className?: string;
}

export function ContentLoading({ type, title, className }: ContentLoadingProps) {
  const getIcon = () => {
    const iconClass = "h-12 w-12 text-gray-400 dark:text-gray-600";
    switch (type) {
      case 'audio': return <Music className={iconClass} />;
      case 'video': return <Video className={iconClass} />;
      case 'image': return <Image className={iconClass} />;
      case 'document': return <FileText className={iconClass} />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'audio': return 'Loading audio...';
      case 'video': return 'Loading video...';
      case 'image': return 'Loading image...';
      case 'document': return 'Loading document...';
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 space-y-4 bg-gray-50 dark:bg-gray-900 rounded-lg', className)}>
      <div className="relative">
        {getIcon()}
        <div className="absolute inset-0 animate-ping opacity-25">
          {getIcon()}
        </div>
      </div>
      <div className="text-center">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {title || getTitle()}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Preparing your content...
        </p>
      </div>
    </div>
  );
}

// Connection status indicator
interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, isReconnecting, className }: ConnectionStatusProps) {
  if (isConnected) {
    return (
      <div className={cn('flex items-center space-x-1 text-green-600', className)}>
        <Wifi className="h-3 w-3" />
        <span className="text-xs">Connected</span>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className={cn('flex items-center space-x-1 text-yellow-600', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-1 text-red-600', className)}>
      <WifiOff className="h-3 w-3" />
      <span className="text-xs">Disconnected</span>
    </div>
  );
}

// Inline loading spinner
interface InlineLoadingProps {
  className?: string;
  text?: string;
}

export function InlineLoading({ className, text }: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {text && <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>}
    </div>
  );
}

// Loading overlay for forms and actions
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ isVisible, message = 'Loading...', className }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      'absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg',
      className
    )}>
      <div className="flex flex-col items-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="font-medium text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}

// Pulse loading for buttons
interface PulseLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PulseLoading({ isLoading, children, className }: PulseLoadingProps) {
  return (
    <div className={cn(
      'relative transition-all duration-200',
      isLoading && 'animate-pulse opacity-75 cursor-not-allowed',
      className
    )}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/20 dark:bg-gray-800/20 rounded-md" />
      )}
    </div>
  );
}

// Skeleton loader with shimmer effect
interface ShimmerProps {
  className?: string;
  count?: number;
}

export function Shimmer({ className, count = 1 }: ShimmerProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded',
            className
          )}
          style={{
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

// Data loading states
export function DataLoading({ type = 'table' }: { type?: 'table' | 'cards' | 'list' }) {
  switch (type) {
    case 'cards':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Shimmer className="h-4 w-3/4 mb-3" />
              <Shimmer className="h-24 w-full mb-3" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      );
      
    case 'list':
      return (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Shimmer className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
      
    case 'table':
    default:
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Shimmer className="h-4 w-32" />
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center space-x-4">
                <Shimmer className="h-3 w-1/4" />
                <Shimmer className="h-3 w-1/4" />
                <Shimmer className="h-3 w-1/4" />
                <Shimmer className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        </div>
      );
  }
}
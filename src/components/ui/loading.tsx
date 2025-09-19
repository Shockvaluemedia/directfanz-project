import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'gray' | 'white';
}

interface LoadingStateProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const colorClasses = {
  primary: 'text-indigo-600',
  gray: 'text-gray-600',
  white: 'text-white',
};

export function LoadingSpinner({ size = 'md', color = 'primary' }: LoadingSpinnerProps) {
  return (
    <div className='flex items-center justify-center'>
      <div
        className={`animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${sizeClasses[size]} ${colorClasses[color]}`}
        role='status'
        aria-label='Loading'
      >
        <span className='sr-only'>Loading...</span>
      </div>
    </div>
  );
}

export function LoadingState({
  loading,
  children,
  fallback,
  text = 'Loading...',
}: LoadingStateProps) {
  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center py-8'>
        {fallback || (
          <>
            <LoadingSpinner size='lg' />
            <p className='mt-3 text-sm text-gray-600'>{text}</p>
          </>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-label='Loading content'
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className='p-4 border border-gray-200 rounded-lg'>
      <Skeleton className='h-4 w-3/4 mb-3' />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 mb-2 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export default LoadingSpinner;

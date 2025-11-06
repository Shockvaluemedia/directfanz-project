'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'gradient';
  interactive?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function EnhancedCard({
  children,
  className,
  variant = 'default',
  interactive = false,
  loading = false,
  onClick,
}: EnhancedCardProps) {
  const baseStyles = 'rounded-xl border transition-all duration-300 ease-in-out';
  
  const variants = {
    default: 'bg-white border-gray-200 shadow-sm hover:shadow-md',
    glass: 'bg-white/80 backdrop-blur-md border-white/20 shadow-xl',
    elevated: 'bg-white border-gray-200 shadow-lg hover:shadow-xl hover:-translate-y-1',
    gradient: 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-md hover:shadow-lg'
  };

  const interactiveStyles = interactive 
    ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' 
    : '';

  const loadingStyles = loading 
    ? 'opacity-50 pointer-events-none animate-pulse' 
    : '';

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        interactiveStyles,
        loadingStyles,
        className
      )}
      onClick={onClick}
    >
      {loading ? (
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface EnhancedCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function EnhancedCardHeader({ children, className, actions }: EnhancedCardHeaderProps) {
  return (
    <div className={cn('p-6 pb-4 flex items-center justify-between', className)}>
      <div className="flex-1">{children}</div>
      {actions && <div className="flex-shrink-0 ml-4">{actions}</div>}
    </div>
  );
}

export function EnhancedCardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 pb-6', className)}>
      {children}
    </div>
  );
}

export function EnhancedCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 leading-tight', className)}>
      {children}
    </h3>
  );
}

export function EnhancedCardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm text-gray-600 mt-1', className)}>
      {children}
    </p>
  );
}
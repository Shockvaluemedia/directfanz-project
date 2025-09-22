'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { EnhancedCard } from './enhanced-card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsWidgetProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  onClick?: () => void;
  showSparkline?: boolean;
  sparklineData?: number[];
}

export function StatsWidget({
  title,
  value,
  previousValue,
  icon,
  trend = 'neutral',
  trendValue,
  description,
  variant = 'default',
  size = 'md',
  loading = false,
  onClick,
  showSparkline = false,
  sparklineData = []
}: StatsWidgetProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Animate numbers on mount
  useEffect(() => {
    if (loading) return;
    
    const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(numericValue)) return;

    const duration = 1000;
    const steps = 30;
    const stepValue = numericValue / steps;
    const stepTime = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      setAnimatedValue(stepValue * currentStep);
      
      if (currentStep >= steps) {
        setAnimatedValue(numericValue);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, loading]);

  const variants = {
    default: 'border-gray-200 bg-white',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50', 
    danger: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  };

  const iconColors = {
    default: 'text-gray-600 bg-gray-100',
    success: 'text-green-600 bg-green-100',
    warning: 'text-yellow-600 bg-yellow-100',
    danger: 'text-red-600 bg-red-100',
    info: 'text-blue-600 bg-blue-100'
  };

  const trendColors = {
    up: 'text-green-600 bg-green-100',
    down: 'text-red-600 bg-red-100',
    neutral: 'text-gray-600 bg-gray-100'
  };

  const sizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const formatValue = (val: number) => {
    if (typeof value === 'string' && value.includes('$')) {
      return `$${val.toLocaleString()}`;
    }
    if (typeof value === 'string' && value.includes('%')) {
      return `${val.toFixed(1)}%`;
    }
    return val.toLocaleString();
  };

  return (
    <EnhancedCard
      variant={onClick ? 'elevated' : 'default'}
      interactive={!!onClick}
      loading={loading}
      onClick={onClick}
      className={cn(variants[variant], 'relative overflow-hidden')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={sizes[size]}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'p-3 rounded-lg transition-all duration-300',
            iconColors[variant],
            isHovered && 'scale-110'
          )}>
            {icon}
          </div>
          
          {trend !== 'neutral' && trendValue && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trendColors[trend]
            )}>
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trendValue}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className={cn(
          'font-medium text-gray-600 mb-2',
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-sm'
        )}>
          {title}
        </h3>

        {/* Value */}
        <div className={cn(
          'font-bold text-gray-900 mb-2',
          size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-2xl'
        )}>
          {loading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          ) : (
            formatValue(animatedValue)
          )}
        </div>

        {/* Description */}
        {description && (
          <p className={cn(
            'text-gray-500',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}>
            {description}
          </p>
        )}

        {/* Sparkline */}
        {showSparkline && sparklineData.length > 0 && (
          <div className="mt-4 h-8">
            <Sparkline data={sparklineData} color={variant} />
          </div>
        )}

        {/* Hover overlay */}
        {onClick && (
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10',
            'opacity-0 transition-opacity duration-300',
            isHovered && 'opacity-100'
          )} />
        )}
      </div>
    </EnhancedCard>
  );
}

// Simple sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const colors = {
    default: 'stroke-gray-400',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    danger: 'stroke-red-500',
    info: 'stroke-blue-500'
  };

  const pathData = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={cn(colors[color], 'transition-all duration-300')}
      />
    </svg>
  );
}

// Stats grid component
interface StatsGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatsGrid({ 
  children, 
  columns = 4, 
  gap = 'md',
  className 
}: StatsGridProps) {
  const gridColumns = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  const gaps = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6'
  };

  return (
    <div className={cn('grid', gridColumns[columns], gaps[gap], className)}>
      {children}
    </div>
  );
}
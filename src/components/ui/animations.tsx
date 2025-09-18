'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Fade In Animation Component
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 500, 
  direction = 'up',
  className 
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getDirectionClasses = () => {
    const base = 'transition-all ease-out';
    switch (direction) {
      case 'up':
        return `${base} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`;
      case 'down':
        return `${base} ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`;
      case 'left':
        return `${base} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`;
      case 'right':
        return `${base} ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`;
      default:
        return `${base} ${isVisible ? 'opacity-100' : 'opacity-0'}`;
    }
  };

  return (
    <div 
      className={cn(getDirectionClasses(), className)}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

// Stagger Animation for Lists
interface StaggerProps {
  children: React.ReactNode[];
  delay?: number;
  staggerDelay?: number;
  className?: string;
}

export function Stagger({ children, delay = 0, staggerDelay = 100, className }: StaggerProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn 
          key={index} 
          delay={delay + (index * staggerDelay)}
          direction="up"
        >
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// Hover Scale Effect
interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
  disabled?: boolean;
}

export function HoverScale({ 
  children, 
  scale = 1.05, 
  className,
  disabled = false 
}: HoverScaleProps) {
  return (
    <div 
      className={cn(
        'transition-transform duration-200 ease-in-out cursor-pointer',
        !disabled && 'hover:scale-105 active:scale-95',
        className
      )}
      style={{ 
        '--tw-scale-x': disabled ? '1' : scale.toString(),
        '--tw-scale-y': disabled ? '1' : scale.toString(),
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// Pulse Effect for Notifications/Badges
interface PulseProps {
  children: React.ReactNode;
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

export function Pulse({ children, className, color = 'blue' }: PulseProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'green': return 'animate-pulse bg-green-100 dark:bg-green-900';
      case 'red': return 'animate-pulse bg-red-100 dark:bg-red-900';
      case 'yellow': return 'animate-pulse bg-yellow-100 dark:bg-yellow-900';
      case 'purple': return 'animate-pulse bg-purple-100 dark:bg-purple-900';
      default: return 'animate-pulse bg-blue-100 dark:bg-blue-900';
    }
  };

  return (
    <div className={cn(getColorClasses(), 'rounded-full', className)}>
      {children}
    </div>
  );
}

// Floating Animation
interface FloatingProps {
  children: React.ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}

export function Floating({ 
  children, 
  className, 
  amplitude = 10, 
  duration = 3 
}: FloatingProps) {
  return (
    <div 
      className={cn('animate-bounce', className)}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * 2}s`
      }}
    >
      {children}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-${amplitude}px); }
        }
      `}</style>
    </div>
  );
}

// Skeleton with Shimmer Effect
interface SkeletonShimmerProps {
  className?: string;
  lines?: number;
  height?: string;
}

export function SkeletonShimmer({ 
  className, 
  lines = 1, 
  height = 'h-4' 
}: SkeletonShimmerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded bg-gray-200 dark:bg-gray-700 animate-shimmer',
            height,
            i === lines - 1 && lines > 1 && 'w-3/4' // Last line shorter
          )}
        />
      ))}
    </div>
  );
}

// Typewriter Effect
interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function Typewriter({ 
  text, 
  speed = 100, 
  className,
  onComplete 
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayText}
      {currentIndex < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

// Magnetic Button Effect
interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

export function Magnetic({ children, className, intensity = 0.3 }: MagneticProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) * intensity;
    const deltaY = (e.clientY - centerY) * intensity;
    
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      className={cn(
        'transition-transform duration-200 ease-out',
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px) ${isHovered ? 'scale(1.02)' : 'scale(1)'}`
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </div>
  );
}

// Loading Dots Animation
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-current rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1.4s'
          }}
        />
      ))}
    </div>
  );
}

// Ripple Effect
interface RippleProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
}

export function Ripple({ children, className, color = 'rgba(255, 255, 255, 0.6)' }: RippleProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const createRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onClick={createRipple}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            backgroundColor: color,
            animation: 'ripple 0.6s linear'
          }}
        />
      ))}
      <style jsx>{`
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Progress Ring
interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({ 
  progress, 
  size = 120, 
  strokeWidth = 8, 
  className,
  children 
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
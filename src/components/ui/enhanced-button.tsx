'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface EnhancedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient' | 'glass' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export function EnhancedButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  onClick,
  ...props
}: EnhancedButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const baseStyles = `
    relative inline-flex items-center justify-center font-medium rounded-xl
    transition-all duration-300 ease-in-out transform
    focus:outline-none focus:ring-4 focus:ring-opacity-25
    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
    disabled:transform-none overflow-hidden
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-indigo-600 to-purple-600 text-white
      hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg
      focus:ring-indigo-500 active:from-indigo-800 active:to-purple-800
    `,
    secondary: `
      bg-gray-100 text-gray-900 border border-gray-200
      hover:bg-gray-200 hover:shadow-sm focus:ring-gray-300
    `,
    ghost: `
      text-gray-700 hover:bg-gray-100 hover:text-gray-900
      focus:ring-gray-300 active:bg-gray-200
    `,
    gradient: `
      bg-gradient-to-r from-pink-500 to-orange-500 text-white
      hover:from-pink-600 hover:to-orange-600 hover:shadow-lg
      focus:ring-pink-500 active:from-pink-700 active:to-orange-700
    `,
    glass: `
      bg-white/80 backdrop-blur-md text-gray-900 border border-white/20
      hover:bg-white/90 hover:shadow-lg focus:ring-indigo-500
    `,
    destructive: `
      bg-gradient-to-r from-red-500 to-pink-500 text-white
      hover:from-red-600 hover:to-pink-600 hover:shadow-lg
      focus:ring-red-500 active:from-red-700 active:to-pink-700
    `
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[2rem]',
    md: 'px-4 py-2.5 text-sm min-h-[2.5rem]',
    lg: 'px-6 py-3 text-base min-h-[3rem]',
    xl: 'px-8 py-4 text-lg min-h-[3.5rem]'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={isDisabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onClick}
      {...props}
    >
      {/* Ripple effect */}
      <div className={`
        absolute inset-0 rounded-xl transition-opacity duration-300
        ${isPressed ? 'opacity-20' : 'opacity-0'}
        ${variant === 'primary' || variant === 'gradient' || variant === 'destructive' 
          ? 'bg-white' 
          : 'bg-gray-900'
        }
      `} />
      
      {/* Content */}
      <div className="relative flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        
        <span className="flex-1">{children}</span>
        
        {!loading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </div>
    </button>
  );
}

// Icon button variant
interface IconButtonProps extends Omit<EnhancedButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export function IconButton({ icon, variant = 'ghost', size = 'md', className, ...props }: IconButtonProps) {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14'
  };

  return (
    <EnhancedButton
      variant={variant}
      className={cn('!px-0 !min-h-0 aspect-square', sizeStyles[size], className)}
      {...props}
    >
      {icon}
    </EnhancedButton>
  );
}

// Floating Action Button
interface FloatingActionButtonProps extends Omit<EnhancedButtonProps, 'children'> {
  icon: React.ReactNode;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  'aria-label': string;
}

export function FloatingActionButton({ 
  icon, 
  position = 'bottom-right', 
  variant = 'primary', 
  size = 'lg',
  className,
  ...props 
}: FloatingActionButtonProps) {
  const positions = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6', 
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6'
  };

  const sizeStyles = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  return (
    <EnhancedButton
      variant={variant}
      className={cn(
        '!px-0 !min-h-0 aspect-square rounded-full shadow-2xl z-50',
        'hover:scale-110 hover:shadow-3xl',
        positions[position],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon}
    </EnhancedButton>
  );
}
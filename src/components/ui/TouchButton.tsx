import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface TouchButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function TouchButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  leftIcon,
  rightIcon,
}: TouchButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 ease-in-out
    active:scale-95 touch-manipulation
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    ${fullWidth ? 'w-full' : ''}
  `;

  const variants = {
    primary: `
      bg-indigo-600 text-white hover:bg-indigo-700
      focus:ring-indigo-500 shadow-sm hover:shadow-md
      active:bg-indigo-800
    `,
    secondary: `
      bg-gray-100 text-gray-900 hover:bg-gray-200
      focus:ring-gray-500 shadow-sm hover:shadow-md
      active:bg-gray-300
    `,
    outline: `
      border border-gray-300 bg-white text-gray-700 hover:bg-gray-50
      focus:ring-gray-500 shadow-sm hover:shadow-md
      active:bg-gray-100
    `,
    ghost: `
      text-gray-700 hover:bg-gray-100
      focus:ring-gray-500
      active:bg-gray-200
    `,
    danger: `
      bg-red-600 text-white hover:bg-red-700
      focus:ring-red-500 shadow-sm hover:shadow-md
      active:bg-red-800
    `,
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[48px]',
  };

  const isDisabled = disabled || loading;

  const handleClick = () => {
    if (!isDisabled && onClick) {
      // Trigger haptic feedback on supported devices
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onClick();
    }
  };

  const content = (
    <>
      {loading && <Loader2 className='w-4 h-4 animate-spin mr-2' />}
      {!loading && leftIcon && <span className='mr-2'>{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className='ml-2'>{rightIcon}</span>}
    </>
  );

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {content}
    </button>
  );
}

// Pre-configured button variants for common use cases
export function PrimaryButton(props: Omit<TouchButtonProps, 'variant'>) {
  return <TouchButton {...props} variant='primary' />;
}

export function SecondaryButton(props: Omit<TouchButtonProps, 'variant'>) {
  return <TouchButton {...props} variant='secondary' />;
}

export function DangerButton(props: Omit<TouchButtonProps, 'variant'>) {
  return <TouchButton {...props} variant='danger' />;
}

import React, { ReactNode } from 'react';

interface TouchCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  disabled?: boolean;
}

export function TouchCard({
  children,
  onClick,
  className = '',
  padding = 'md',
  hoverable = true,
  disabled = false,
}: TouchCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const baseClasses = `
    bg-white rounded-lg shadow-sm border border-gray-200
    ${paddingClasses[padding]}
    ${onClick && !disabled ? 'cursor-pointer' : ''}
    ${hoverable && !disabled ? 'hover:shadow-md transition-shadow duration-200' : ''}
    ${onClick && !disabled ? 'active:scale-[0.98] transition-transform duration-100' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `;

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  if (onClick) {
    return (
      <button className={baseClasses} onClick={handleClick} disabled={disabled} type='button'>
        {children}
      </button>
    );
  }

  return <div className={baseClasses}>{children}</div>;
}

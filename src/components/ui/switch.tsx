'use client';

import React, { forwardRef } from 'react';

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { checked = false, onCheckedChange, disabled = false, className = '', id, name, ...props },
    ref
  ) => {
    const handleClick = () => {
      if (!disabled) {
        onCheckedChange?.(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type='button'
        role='switch'
        aria-checked={checked}
        aria-disabled={disabled}
        id={id}
        name={name}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${className}
        `}
        {...props}
      >
        <span className='sr-only'>Toggle switch</span>
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;

'use client';

import React, { forwardRef } from 'react';

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ 
    checked, 
    onCheckedChange, 
    disabled = false, 
    className = '', 
    id,
    name,
    value,
    ...props 
  }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(event.target.checked);
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={`
            sr-only
          `}
          {...props}
        />
        <div
          className={`
            relative w-4 h-4 rounded-sm border border-gray-300 bg-white
            ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            transition-colors duration-200
            hover:border-blue-400
            focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2
            ${className}
          `}
          onClick={() => {
            if (!disabled && ref && 'current' in ref && ref.current) {
              ref.current.click();
            }
          }}
        >
          {checked && (
            <svg
              className="absolute inset-0 w-full h-full text-white p-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
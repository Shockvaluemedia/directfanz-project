'use client';

import React, { forwardRef, useRef, useCallback } from 'react';

interface SliderProps {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value = [0],
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const sliderRef = useRef<HTMLDivElement>(null);
    const currentValue = value[0] || 0;

    const getValueFromPosition = useCallback(
      (clientX: number) => {
        if (!sliderRef.current) return currentValue;

        const rect = sliderRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newValue = min + percentage * (max - min);

        // Round to nearest step
        const steppedValue = Math.round(newValue / step) * step;
        return Math.max(min, Math.min(max, steppedValue));
      },
      [min, max, step, currentValue]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled) return;

        const newValue = getValueFromPosition(e.clientX);
        onValueChange?.([newValue]);

        const handleMouseMove = (e: MouseEvent) => {
          const newValue = getValueFromPosition(e.clientX);
          onValueChange?.([newValue]);
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [disabled, getValueFromPosition, onValueChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        let newValue = currentValue;

        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowDown':
            newValue = Math.max(min, currentValue - step);
            e.preventDefault();
            break;
          case 'ArrowRight':
          case 'ArrowUp':
            newValue = Math.min(max, currentValue + step);
            e.preventDefault();
            break;
          case 'Home':
            newValue = min;
            e.preventDefault();
            break;
          case 'End':
            newValue = max;
            e.preventDefault();
            break;
          default:
            return;
        }

        onValueChange?.([newValue]);
      },
      [disabled, currentValue, min, max, step, onValueChange]
    );

    const percentage = ((currentValue - min) / (max - min)) * 100;

    return (
      <div
        ref={ref}
        className={`relative flex w-full touch-none select-none items-center ${className}`}
        {...props}
      >
        <div
          ref={sliderRef}
          className={`
            relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          onMouseDown={handleMouseDown}
        >
          {/* Track fill */}
          <div
            className='absolute h-full bg-blue-600 transition-all duration-150'
            style={{ width: `${percentage}%` }}
          />

          {/* Thumb */}
          <div
            className={`
              absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-blue-600 bg-white shadow
              transition-all duration-150
              ${disabled ? 'cursor-not-allowed' : 'cursor-grab hover:scale-110'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            `}
            style={{ left: `${percentage}%` }}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            role='slider'
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={currentValue}
            aria-disabled={disabled}
          />
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export default Slider;

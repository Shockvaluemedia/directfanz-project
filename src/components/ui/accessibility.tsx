'use client';

import React, { useRef, useEffect } from 'react';
import { useFocusTrap } from '@/lib/accessibility';

/**
 * SkipLink component for keyboard users to bypass navigation
 */
export function SkipLink({ targetId, className = '' }: { targetId: string; className?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:outline focus:outline-2 focus:outline-blue-600 ${className}`}
    >
      Skip to main content
    </a>
  );
}

/**
 * VisuallyHidden component for screen reader text that shouldn't be visible
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className='sr-only'>{children}</span>;
}

/**
 * LiveRegion component for screen reader announcements
 */
export function LiveRegion({
  children,
  politeness = 'polite',
}: {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive';
}) {
  return (
    <div className='sr-only' aria-live={politeness} aria-atomic='true'>
      {children}
    </div>
  );
}

/**
 * FocusTrap component for modal dialogs
 */
export function FocusTrap({
  children,
  isActive = true,
  className = '',
}: {
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, isActive);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * AccessibleIcon component for icons that need labels
 */
export function AccessibleIcon({
  icon: Icon,
  label,
  className = '',
}: {
  icon: React.ElementType;
  label: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex ${className}`} role='img' aria-label={label}>
      <Icon />
    </span>
  );
}

/**
 * ErrorMessage component for form validation errors
 */
export function ErrorMessage({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} role='alert' className='text-red-600 text-sm mt-1'>
      {children}
    </div>
  );
}

/**
 * FormLabel component with accessible labeling
 */
export function FormLabel({
  htmlFor,
  children,
  required = false,
  className = '',
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium ${className}`}>
      {children}
      {required && (
        <>
          <span aria-hidden='true' className='text-red-500 ml-1'>
            *
          </span>
          <VisuallyHidden> (required)</VisuallyHidden>
        </>
      )}
    </label>
  );
}

/**
 * AccessibleTooltip component
 */
export function AccessibleTooltip({
  children,
  content,
  id,
}: {
  children: React.ReactNode;
  content: string;
  id: string;
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className='relative inline-block'>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-describedby={isVisible ? id : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          id={id}
          role='tooltip'
          className='absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm bottom-full mb-2 left-1/2 transform -translate-x-1/2'
        >
          {content}
          <div
            className='absolute w-2 h-2 bg-gray-900 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1'
            aria-hidden='true'
          />
        </div>
      )}
    </div>
  );
}

/**
 * AccessibleDialog component
 */
export function AccessibleDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role='presentation'
    >
      <FocusTrap isActive={isOpen}>
        <div
          ref={dialogRef}
          role='dialog'
          aria-modal='true'
          aria-labelledby={`dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
          aria-describedby={
            description ? `dialog-desc-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined
          }
          className={`bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${className}`}
        >
          <h2
            id={`dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            className='text-lg font-medium mb-2'
          >
            {title}
          </h2>

          {description && (
            <p
              id={`dialog-desc-${title.replace(/\s+/g, '-').toLowerCase()}`}
              className='text-gray-600 mb-4'
            >
              {description}
            </p>
          )}

          {children}

          <div className='mt-6 flex justify-end'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              Close
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

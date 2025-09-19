'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface SheetTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

interface SheetContentProps {
  side?: SheetSide;
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

interface SheetHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface SheetTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface SheetDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children, onClick }: SheetTriggerProps) {
  const { setOpen } = React.useContext(SheetContext);

  const handleClick = () => {
    setOpen(true);
    onClick?.();
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...children.props,
      onClick: handleClick,
    });
  }

  return <button onClick={handleClick}>{children}</button>;
}

export function SheetContent({
  side = 'right',
  className = '',
  children,
  onClose,
}: SheetContentProps) {
  const { open, setOpen } = React.useContext(SheetContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        onClose?.();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, setOpen, onClose]);

  if (!mounted || !open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
      onClose?.();
    }
  };

  const getPositionClasses = (side: SheetSide) => {
    switch (side) {
      case 'top':
        return 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top';
      case 'bottom':
        return 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom';
      case 'left':
        return 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm';
      case 'right':
      default:
        return 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm';
    }
  };

  const getTransformClasses = (side: SheetSide) => {
    switch (side) {
      case 'top':
        return 'translate-y-0';
      case 'bottom':
        return 'translate-y-0';
      case 'left':
        return 'translate-x-0';
      case 'right':
      default:
        return 'translate-x-0';
    }
  };

  return createPortal(
    <div className='fixed inset-0 z-50' onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' />

      {/* Sheet */}
      <div
        className={`fixed bg-white shadow-lg transition-transform duration-300 ease-in-out ${getPositionClasses(side)} ${getTransformClasses(side)} ${className}`}
      >
        <button
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          className='absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
        >
          <span className='sr-only'>Close</span>
          <svg
            width='15'
            height='15'
            viewBox='0 0 15 15'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='m11.25 3.75-7.5 7.5m0-7.5 7.5 7.5'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({ children, className = '' }: SheetHeaderProps) {
  return (
    <div className={`flex flex-col space-y-2 text-center sm:text-left p-6 pb-0 ${className}`}>
      {children}
    </div>
  );
}

export function SheetTitle({ children, className = '' }: SheetTitleProps) {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
  );
}

export function SheetDescription({ children, className = '' }: SheetDescriptionProps) {
  return <p className={`text-sm text-gray-600 ${className}`}>{children}</p>;
}

export function SheetFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0 ${className}`}
    >
      {children}
    </div>
  );
}

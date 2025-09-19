'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Helper hook for creating toast functions
export function useToastHelpers() {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: 'success', title, message, ...options });
    },
    error: (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: 'error', title, message, duration: 0, ...options });
    },
    warning: (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: 'warning', title, message, ...options });
    },
    info: (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: 'info', title, message, ...options });
    },
  };
}

// Legacy toast object - use useToastHelpers() hook instead
export const toast = {
  success: (title: string, message?: string, options?: Partial<Toast>) => {
    console.warn('toast.success is deprecated. Use useToastHelpers() hook instead.');
    return '';
  },
  error: (title: string, message?: string, options?: Partial<Toast>) => {
    console.warn('toast.error is deprecated. Use useToastHelpers() hook instead.');
    return '';
  },
  warning: (title: string, message?: string, options?: Partial<Toast>) => {
    console.warn('toast.warning is deprecated. Use useToastHelpers() hook instead.');
    return '';
  },
  info: (title: string, message?: string, options?: Partial<Toast>) => {
    console.warn('toast.info is deprecated. Use useToastHelpers() hook instead.');
    return '';
  },
};

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id =
        crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1).toString(36).substring(7);
      const newToast: Toast = {
        id,
        duration: 5000,
        dismissible: true,
        ...toast,
      };

      setToasts(prev => {
        const updated = [newToast, ...prev].slice(0, maxToasts);
        return updated;
      });

      // Auto-remove toast after duration (if duration is set)
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    [maxToasts, removeToast]
  );

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    removeAllToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className='fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none'>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    const iconClass = 'h-5 w-5 flex-shrink-0';
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className={cn(iconClass, 'text-green-500')} />;
      case 'error':
        return <AlertCircle className={cn(iconClass, 'text-red-500')} />;
      case 'warning':
        return <AlertTriangle className={cn(iconClass, 'text-yellow-500')} />;
      case 'info':
        return <Info className={cn(iconClass, 'text-blue-500')} />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'info':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-80 rounded-lg border-l-4 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out',
        getColorClasses(),
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95',
        isLeaving && 'translate-x-full opacity-0 scale-95'
      )}
    >
      <div className='p-4'>
        <div className='flex items-start space-x-3'>
          {getIcon()}

          <div className='flex-1 min-w-0'>
            <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
              {toast.title}
            </h4>
            {toast.message && (
              <p className='mt-1 text-sm text-gray-600 dark:text-gray-300'>{toast.message}</p>
            )}

            {toast.action && (
              <div className='mt-3'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    toast.action!.onClick();
                    handleRemove();
                  }}
                >
                  {toast.action.label}
                </Button>
              </div>
            )}
          </div>

          {toast.dismissible && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleRemove}
              className='h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700'
            >
              <X className='h-3 w-3' />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration > 0 && (
        <div className='h-1 bg-gray-200 dark:bg-gray-700'>
          <div
            className={cn(
              'h-full transition-all ease-linear',
              toast.type === 'success' && 'bg-green-500',
              toast.type === 'error' && 'bg-red-500',
              toast.type === 'warning' && 'bg-yellow-500',
              toast.type === 'info' && 'bg-blue-500'
            )}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// CSS for toast progress animation (add to global CSS)
export const toastStyles = `
  @keyframes toast-progress {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`;

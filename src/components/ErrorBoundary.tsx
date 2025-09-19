'use client';

import React from 'react';
import { logger } from '@/lib/logger';
import {
  handleError,
  ErrorSeverity,
  ErrorCategory,
  createErrorBoundaryHandler,
} from '@/lib/client-error-handler';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void; errorId?: string }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  name?: string; // Component name for better error tracking
  level?: 'page' | 'component' | 'feature'; // Error boundary level
  showErrorDetails?: boolean; // Show detailed error info in development
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorHandler: (error: Error, errorInfo: { componentStack: string }) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };

    // Create error handler with component name
    this.errorHandler = createErrorBoundaryHandler(props.name || 'Unknown Component');
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${require('crypto')
        .randomBytes(5)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substr(0, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging with structured data
    logger.error('React Error Boundary caught an error', {
      errorId: this.state.errorId,
      componentName: this.props.name || 'Unknown',
      level: this.props.level || 'component',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Use our centralized error handler
    this.errorHandler(error, {
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    this.setState({
      errorInfo,
    });
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          reset={this.reset}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}

// Enhanced default error fallback component
function DefaultErrorFallback({
  error,
  reset,
  errorId,
}: {
  error?: Error;
  reset: () => void;
  errorId?: string;
}) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [reportSent, setReportSent] = React.useState(false);

  const sendErrorReport = () => {
    // This would send error details to your support system
    console.info('Error report sent:', { errorId, error: error?.message });
    setReportSent(true);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
      <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center'>
        {/* Error Icon */}
        <div className='w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
          <svg
            className='w-8 h-8 text-red-600'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className='text-xl font-semibold text-gray-900 mb-2'>Oops! Something went wrong</h1>
        <p className='text-gray-600 mb-4'>
          We're sorry, but something unexpected happened. Please try the actions below to continue.
        </p>

        {/* Error ID for support */}
        {errorId && (
          <div className='bg-gray-50 border border-gray-200 rounded p-3 mb-4'>
            <p className='text-xs text-gray-500 mb-1'>Error ID (for support):</p>
            <code className='text-xs bg-white px-2 py-1 rounded border font-mono text-gray-700'>
              {errorId}
            </code>
          </div>
        )}

        {/* Development Error Details */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className='mb-4'>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className='text-sm text-blue-600 hover:text-blue-800 underline mb-2'
            >
              {showDetails ? 'Hide' : 'Show'} Error Details (Dev Mode)
            </button>
            {showDetails && (
              <details className='text-left bg-gray-50 p-3 rounded border text-sm text-gray-700'>
                <summary className='cursor-pointer font-medium mb-2'>Technical Details</summary>
                <div className='space-y-2'>
                  <div>
                    <strong>Error:</strong> {error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className='mt-1 whitespace-pre-wrap overflow-auto text-xs bg-white p-2 rounded border'>
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className='space-y-3'>
          <button
            onClick={reset}
            className='w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium'
          >
            Try Again
          </button>

          <div className='flex space-x-2'>
            <button
              onClick={() => window.location.reload()}
              className='flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors'
            >
              Refresh Page
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className='flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors'
            >
              Go Home
            </button>
          </div>

          {/* Report Error Button */}
          {errorId && !reportSent && (
            <button
              onClick={sendErrorReport}
              className='w-full text-sm text-gray-600 hover:text-gray-800 py-2 border border-gray-300 rounded hover:border-gray-400 transition-colors'
            >
              Report This Error
            </button>
          )}

          {reportSent && (
            <p className='text-sm text-green-600 py-2'>
              ✓ Error report sent. Thank you for helping us improve!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;

// Enhanced hook for error reporting and handling
export function useErrorHandler() {
  const { handleError, handleApiError, handleValidationError, withErrorHandling, apiCall } =
    React.useMemo(() => {
      // Import here to avoid circular dependencies
      const clientErrorHandler = require('@/lib/client-error-handler');
      return clientErrorHandler.useErrorHandler();
    }, []);

  // Legacy compatibility function
  const legacyHandler = React.useCallback((error: Error, errorInfo?: { [key: string]: any }) => {
    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      ...errorInfo,
    });
  }, []);

  return {
    // New enhanced error handlers
    handleError,
    handleApiError,
    handleValidationError,
    withErrorHandling,
    apiCall,
    // Legacy handler for backward compatibility
    reportError: legacyHandler,
  };
}

// Higher-order component for error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} ref={ref} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Page-level error boundary
export function PageErrorBoundary({ children, ...props }: ErrorBoundaryProps) {
  return (
    <ErrorBoundary
      level='page'
      name='PageBoundary'
      showErrorDetails={process.env.NODE_ENV === 'development'}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

// Feature-level error boundary
export function FeatureErrorBoundary({
  children,
  featureName,
  ...props
}: ErrorBoundaryProps & { featureName: string }) {
  return (
    <ErrorBoundary level='feature' name={`${featureName}Feature`} {...props}>
      {children}
    </ErrorBoundary>
  );
}

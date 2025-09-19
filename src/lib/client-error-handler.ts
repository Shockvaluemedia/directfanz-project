/**
 * Client-side error handling utilities
 * Handles errors in React components, async operations, and API calls
 */

import { toast } from 'react-hot-toast';
import { AppError, ErrorCode, getUserFriendlyMessage, isAppError } from '@/lib/errors';
import { StandardApiResponse } from '@/lib/api-error-handler';

// Client-side error types
export interface ClientError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  source: 'api' | 'client' | 'network' | 'validation';
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories for different handling
export enum ErrorCategory {
  USER_INPUT = 'user_input',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  SERVER = 'server',
  CLIENT = 'client',
  VALIDATION = 'validation',
}

// Error handler configuration
interface ErrorHandlerConfig {
  showToast?: boolean;
  toastDuration?: number;
  logToConsole?: boolean;
  reportToService?: boolean;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  customMessage?: string;
}

// Default configuration
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  showToast: true,
  toastDuration: 4000,
  logToConsole: true,
  reportToService: false,
  severity: ErrorSeverity.MEDIUM,
  category: ErrorCategory.CLIENT,
};

// Convert various error types to ClientError
export function normalizeClientError(
  error: unknown,
  source: ClientError['source'] = 'client'
): ClientError {
  // API response errors
  if (isApiErrorResponse(error)) {
    return {
      code: error.error.code,
      message: error.error.message,
      details: error.error.details,
      timestamp: error.error.timestamp,
      source: 'api',
    };
  }

  // AppError instances
  if (isAppError(error)) {
    return {
      code: error.code,
      message: getUserFriendlyMessage(error),
      details: error.details,
      timestamp: error.timestamp,
      source,
    };
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network error. Please check your connection and try again.',
      timestamp: new Date().toISOString(),
      source: 'network',
    };
  }

  // Timeout errors
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('timeout'))
  ) {
    return {
      code: 'TIMEOUT_ERROR',
      message: 'Request timed out. Please try again.',
      timestamp: new Date().toISOString(),
      source: 'network',
    };
  }

  // Generic JavaScript errors
  if (error instanceof Error) {
    return {
      code: 'CLIENT_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: { stack: error.stack },
      timestamp: new Date().toISOString(),
      source,
    };
  }

  // Unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    details: { error: String(error) },
    timestamp: new Date().toISOString(),
    source,
  };
}

// Type guard for API error responses
export function isApiErrorResponse(error: any): error is StandardApiResponse {
  return (
    error &&
    typeof error === 'object' &&
    error.success === false &&
    error.error &&
    typeof error.error.code === 'string' &&
    typeof error.error.message === 'string'
  );
}

// Main error handler
export function handleError(error: unknown, config: ErrorHandlerConfig = {}): ClientError {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const clientError = normalizeClientError(error);

  // Log to console if enabled
  if (mergedConfig.logToConsole) {
    const logMethod = getLogMethod(mergedConfig.severity || DEFAULT_CONFIG.severity!);
    logMethod('Client Error:', {
      error: clientError,
      originalError: error,
      config: mergedConfig,
    });
  }

  // Show toast notification if enabled
  if (mergedConfig.showToast) {
    const message = mergedConfig.customMessage || clientError.message;
    showErrorToast(
      message,
      mergedConfig.severity || DEFAULT_CONFIG.severity!,
      mergedConfig.toastDuration
    );
  }

  // Report to error service if enabled
  if (mergedConfig.reportToService) {
    reportError(clientError, mergedConfig.category || DEFAULT_CONFIG.category!);
  }

  return clientError;
}

// Get appropriate console method for severity
function getLogMethod(severity: ErrorSeverity) {
  switch (severity) {
    case ErrorSeverity.LOW:
      return console.info;
    case ErrorSeverity.MEDIUM:
      return console.warn;
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      return console.error;
    default:
      return console.log;
  }
}

// Show error toast with appropriate styling
function showErrorToast(message: string, severity: ErrorSeverity, duration?: number) {
  const options = {
    duration: duration || DEFAULT_CONFIG.toastDuration!,
    position: 'top-right' as const,
  };

  switch (severity) {
    case ErrorSeverity.LOW:
      toast(message, {
        ...options,
        icon: 'ℹ️',
        style: {
          background: '#e3f2fd',
          color: '#1565c0',
          border: '1px solid #90caf9',
        },
      });
      break;
    case ErrorSeverity.MEDIUM:
      toast(message, {
        ...options,
        icon: '⚠️',
        style: {
          background: '#fff3e0',
          color: '#ef6c00',
          border: '1px solid #ffb74d',
        },
      });
      break;
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      toast.error(message, options);
      break;
    default:
      toast(message, options);
  }
}

// Report error to external service (placeholder)
function reportError(error: ClientError, category: ErrorCategory) {
  // This would integrate with your error reporting service
  // e.g., Sentry, LogRocket, Rollbar, etc.
  console.info('Error reported:', { error, category });

  // Example Sentry integration:
  // Sentry.captureException(error, {
  //   tags: { category },
  //   extra: error.details,
  // });
}

// React error boundary helper
export function createErrorBoundaryHandler(componentName: string) {
  return (error: Error, errorInfo: { componentStack: string }) => {
    const clientError = handleError(error, {
      category: ErrorCategory.CLIENT,
      severity: ErrorSeverity.HIGH,
      reportToService: true,
    });

    console.error(`Error in ${componentName}:`, {
      error: clientError,
      componentStack: errorInfo.componentStack,
    });
  };
}

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  config: ErrorHandlerConfig = {}
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, config);
    return null;
  }
}

// API call wrapper with error handling
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  config: ErrorHandlerConfig = {}
): Promise<T | null> {
  const apiConfig = {
    ...config,
    category: ErrorCategory.NETWORK,
    reportToService: true,
  };

  return withErrorHandling(apiFunction, apiConfig);
}

// Form validation error handler
export function handleValidationError(
  error: unknown,
  fieldName?: string
): { message: string; field?: string } {
  const clientError = normalizeClientError(error, 'validation');

  // Extract field-specific errors
  if (clientError.details?.validationErrors) {
    const fieldError = clientError.details.validationErrors.find(
      (err: any) => !fieldName || err.path === fieldName
    );

    if (fieldError) {
      return {
        message: fieldError.message,
        field: fieldError.path,
      };
    }
  }

  return {
    message: clientError.message,
    field: fieldName,
  };
}

// React hook for error handling
export function useErrorHandler() {
  return {
    handleError: (error: unknown, config?: ErrorHandlerConfig) => handleError(error, config),

    handleApiError: (error: unknown, config?: ErrorHandlerConfig) =>
      handleError(error, { ...config, category: ErrorCategory.NETWORK }),

    handleValidationError: (error: unknown, fieldName?: string) =>
      handleValidationError(error, fieldName),

    withErrorHandling: <T>(operation: () => Promise<T>, config?: ErrorHandlerConfig) =>
      withErrorHandling(operation, config),

    apiCall: <T>(apiFunction: () => Promise<T>, config?: ErrorHandlerConfig) =>
      apiCall(apiFunction, config),
  };
}

// Predefined error handlers for common scenarios
export const ErrorHandlers = {
  // Silent error handling (no toast, just log)
  silent: (error: unknown) =>
    handleError(error, {
      showToast: false,
      severity: ErrorSeverity.LOW,
    }),

  // Network error handling
  network: (error: unknown) =>
    handleError(error, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      customMessage: 'Connection problem. Please check your internet and try again.',
    }),

  // Authentication error handling
  auth: (error: unknown) =>
    handleError(error, {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      customMessage: 'Please log in to continue.',
    }),

  // Form validation error handling
  validation: (error: unknown) =>
    handleError(error, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      showToast: false, // Usually handled inline in forms
    }),

  // Critical error handling
  critical: (error: unknown) =>
    handleError(error, {
      severity: ErrorSeverity.CRITICAL,
      reportToService: true,
      customMessage: 'A critical error occurred. Please refresh the page or contact support.',
    }),
};

/**
 * Sentry integration for error monitoring in production
 */

import * as Sentry from '@sentry/nextjs';
import { AppError, isAppError } from './errors';
import { logger } from './logger';

// Initialize Sentry in this module
export const initSentry = () => {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.2, // Adjust sampling rate as needed
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
      beforeSend(event: Sentry.Event, hint?: Sentry.EventHint) {
        // Don't send operational errors to Sentry
        const originalException = hint?.originalException;
        if (isAppError(originalException) && originalException.isOperational) {
          return null;
        }
        return event;
      },
    });
    
    logger.info('Sentry initialized for error monitoring');
  } else {
    logger.info('Sentry not initialized (not in production or DSN not provided)');
  }
};

// Capture error with additional context
export const captureError = (
  error: Error | AppError,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'error'
) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    // Set user context if available
    if (context?.userId) {
      Sentry.setUser({ id: context.userId });
    }

    // Set additional context
    if (context) {
      Sentry.setContext('additional', context);
    }

    // Set transaction name if available
    if (context?.transactionName) {
      Sentry.configureScope((scope: Sentry.Scope) => {
        scope.setTransactionName(context.transactionName);
      });
    }

    // Set tags for easier filtering
    if (isAppError(error)) {
      Sentry.setTag('error.code', error.code);
      Sentry.setTag('error.isOperational', String(error.isOperational));
      Sentry.setTag('error.statusCode', String(error.statusCode));
    }

    // Capture the error
    Sentry.captureException(error, {
      level,
      tags: {
        source: context?.source || 'unknown',
        component: context?.component || 'unknown',
      },
    });
  } catch (sentryError) {
    logger.error('Failed to capture error in Sentry', { originalError: error.message }, sentryError as Error);
  }
};

// Capture message with additional context
export const captureMessage = (
  message: string,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    // Set user context if available
    if (context?.userId) {
      Sentry.setUser({ id: context.userId });
    }

    // Set additional context
    if (context) {
      Sentry.setContext('additional', context);
    }

    // Capture the message
    Sentry.captureMessage(message, {
      level,
      tags: {
        source: context?.source || 'unknown',
        component: context?.component || 'unknown',
      },
    });
  } catch (sentryError) {
    logger.error('Failed to capture message in Sentry', { message }, sentryError as Error);
  }
};

// Start performance monitoring
export const startTransaction = (
  name: string,
  op: string,
  context?: Record<string, any>
) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  try {
    // Use the Sentry API to start a transaction
    const transaction = Sentry.startTransaction({ name, op });
    
    // Add context as tags if provided
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        transaction.setTag(key, String(value));
      });
    }

    return transaction;
  } catch (error) {
    logger.error('Failed to start Sentry transaction', { name, op }, error as Error);
    return null;
  }
};

// Finish performance monitoring
export const finishTransaction = (transaction: any | null) => {
  if (!transaction) return;
  
  try {
    transaction.finish();
  } catch (error) {
    logger.error('Failed to finish Sentry transaction', { transactionName: transaction.name }, error as Error);
  }
};

// Set user information for Sentry
export const setUser = (id: string, email?: string, username?: string) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    Sentry.setUser({
      id,
      email,
      username,
    });
  } catch (error) {
    logger.error('Failed to set Sentry user', { userId: id }, error as Error);
  }
};

// Clear user information from Sentry
export const clearUser = () => {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    Sentry.setUser(null);
  } catch (error) {
    logger.error('Failed to clear Sentry user', {}, error as Error);
  }
};

// Export Sentry for direct use
export { Sentry };
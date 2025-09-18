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
      beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
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
    // Set user context with business information
    if (context?.userId) {
      Sentry.setUser({
        id: context.userId,
        email: context.userEmail,
        username: context.username,
        segment: context.userType || 'unknown', // creator, fan, admin
      });
    }

    // Set business-specific context
    if (context) {
      // Payment context
      if (context.paymentId || context.subscriptionId || context.amount) {
        Sentry.setContext('payment', {
          paymentId: context.paymentId,
          subscriptionId: context.subscriptionId,
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod,
          stripeCustomerId: context.stripeCustomerId,
        });
      }

      // Content context
      if (context.contentId || context.creatorId) {
        Sentry.setContext('content', {
          contentId: context.contentId,
          contentType: context.contentType,
          creatorId: context.creatorId,
          tierRequired: context.tierRequired,
          uploadSize: context.uploadSize,
        });
      }

      // User engagement context
      if (context.sessionId || context.userAgent) {
        Sentry.setContext('engagement', {
          sessionId: context.sessionId,
          userAgent: context.userAgent,
          source: context.source,
          platform: context.platform,
          referrer: context.referrer,
          ipAddress: context.ipAddress ? 'present' : undefined, // Don't log actual IP
        });
      }

      // Business metrics context
      if (context.businessEvent) {
        Sentry.setContext('business', {
          eventType: context.businessEvent,
          funnel: context.funnel,
          cohort: context.cohort,
          experimentGroup: context.experimentGroup,
          marketingChannel: context.marketingChannel,
        });
      }

      // Set general additional context
      Sentry.setContext('additional', {
        ...context,
        // Remove sensitive data from additional context
        userEmail: undefined,
        ipAddress: undefined,
        paymentMethod: undefined,
      });
    }

    // Set transaction name if available
    if (context?.transactionName) {
      Sentry.getCurrentScope().setTransactionName(context.transactionName);
    }

    // Set comprehensive tags for easier filtering
    const tags: Record<string, string> = {
      source: context?.source || 'unknown',
      component: context?.component || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
    };

    // Business-specific tags
    if (context?.userType) tags['user.type'] = context.userType;
    if (context?.subscriptionTier) tags['user.tier'] = context.subscriptionTier;
    if (context?.paymentMethod) tags['payment.method'] = context.paymentMethod;
    if (context?.contentType) tags['content.type'] = context.contentType;
    if (context?.businessEvent) tags['business.event'] = context.businessEvent;
    if (context?.funnel) tags['business.funnel'] = context.funnel;
    if (context?.feature) tags['feature'] = context.feature;
    if (context?.apiVersion) tags['api.version'] = context.apiVersion;
    if (context?.platform) tags['platform'] = context.platform;

    // Error-specific tags
    if (isAppError(error)) {
      tags['error.code'] = error.code;
      tags['error.isOperational'] = String(error.isOperational);
      tags['error.statusCode'] = String(error.statusCode);
    }

    // Capture the error with enhanced context
    Sentry.captureException(error, {
      level,
      tags,
      fingerprint: context?.fingerprint || [
        error.name,
        error.message,
        context?.component || 'unknown',
      ],
      extra: {
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
        buildVersion: process.env.NEXT_PUBLIC_APP_VERSION,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
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
    // Set user context with business information
    if (context?.userId) {
      Sentry.setUser({
        id: context.userId,
        email: context.userEmail,
        username: context.username,
        segment: context.userType || 'unknown',
      });
    }

    // Set business-specific context (same as in captureError)
    if (context) {
      // Payment context
      if (context.paymentId || context.subscriptionId || context.amount) {
        Sentry.setContext('payment', {
          paymentId: context.paymentId,
          subscriptionId: context.subscriptionId,
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod,
          stripeCustomerId: context.stripeCustomerId,
        });
      }

      // Content context
      if (context.contentId || context.creatorId) {
        Sentry.setContext('content', {
          contentId: context.contentId,
          contentType: context.contentType,
          creatorId: context.creatorId,
          tierRequired: context.tierRequired,
        });
      }

      // Business metrics context
      if (context.businessEvent) {
        Sentry.setContext('business', {
          eventType: context.businessEvent,
          funnel: context.funnel,
          cohort: context.cohort,
          experimentGroup: context.experimentGroup,
          marketingChannel: context.marketingChannel,
        });
      }

      // Set general additional context
      Sentry.setContext('additional', {
        ...context,
        // Remove sensitive data
        userEmail: undefined,
        ipAddress: undefined,
      });
    }

    // Set comprehensive tags
    const tags: Record<string, string> = {
      source: context?.source || 'unknown',
      component: context?.component || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      messageType: context?.messageType || 'info',
    };

    // Business-specific tags
    if (context?.userType) tags['user.type'] = context.userType;
    if (context?.subscriptionTier) tags['user.tier'] = context.subscriptionTier;
    if (context?.businessEvent) tags['business.event'] = context.businessEvent;
    if (context?.feature) tags['feature'] = context.feature;
    if (context?.platform) tags['platform'] = context.platform;
    if (context?.funnel) tags['business.funnel'] = context.funnel;

    // Capture the message with enhanced context
    Sentry.captureMessage(message, {
      level,
      tags,
      fingerprint: context?.fingerprint || [message, context?.component || 'unknown'],
      extra: {
        timestamp: new Date().toISOString(),
        buildVersion: process.env.NEXT_PUBLIC_APP_VERSION,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
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
    // Use the Sentry API to start a span
    return Sentry.startSpan({ name, op }, (span) => {
      // Add context as attributes if provided
      if (context && span) {
        Object.entries(context).forEach(([key, value]) => {
          span.setAttributes({ [key]: String(value) });
        });
      }
      return span;
    });
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
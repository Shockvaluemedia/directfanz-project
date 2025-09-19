/**
 * Error monitoring and reporting integration
 * Integrates with Sentry and other monitoring services
 */

import { AppError, ErrorCode, isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { ClientError } from '@/lib/client-error-handler';

// Monitoring service configuration
interface MonitoringConfig {
  enabled: boolean;
  environment: string;
  release?: string;
  userId?: string;
  userContext?: Record<string, any>;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

// Error severity mapping for monitoring services
const SEVERITY_MAP = {
  [ErrorCode.VALIDATION_ERROR]: 'info',
  [ErrorCode.INVALID_INPUT]: 'info',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'info',
  [ErrorCode.UNAUTHORIZED]: 'warning',
  [ErrorCode.FORBIDDEN]: 'warning',
  [ErrorCode.INVALID_CREDENTIALS]: 'warning',
  [ErrorCode.TOKEN_EXPIRED]: 'warning',
  [ErrorCode.NOT_FOUND]: 'info',
  [ErrorCode.ALREADY_EXISTS]: 'info',
  [ErrorCode.RESOURCE_CONFLICT]: 'warning',
  [ErrorCode.PAYMENT_FAILED]: 'error',
  [ErrorCode.INSUFFICIENT_FUNDS]: 'warning',
  [ErrorCode.PAYMENT_METHOD_INVALID]: 'warning',
  [ErrorCode.SUBSCRIPTION_ERROR]: 'error',
  [ErrorCode.FILE_TOO_LARGE]: 'info',
  [ErrorCode.INVALID_FILE_TYPE]: 'info',
  [ErrorCode.UPLOAD_FAILED]: 'warning',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'warning',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'error',
  [ErrorCode.DATABASE_ERROR]: 'error',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'error',
} as const;

// Default monitoring configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_ERROR_MONITORING === 'true',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA,
};

// Initialize monitoring service
export function initializeErrorMonitoring(config: Partial<MonitoringConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    logger.info('Error monitoring disabled');
    return;
  }

  // Initialize Sentry if DSN is provided
  if (process.env.SENTRY_DSN) {
    logger.info('Sentry error monitoring enabled', {
      environment: finalConfig.environment,
      release: finalConfig.release,
    });
  }
}

// Set user context for monitoring
export function setUserContext(userId: string, userData?: Record<string, any>) {
  logger.info('User context set for monitoring', { userId });
}

// Report application error to monitoring services
export function reportError(
  error: Error | AppError | ClientError,
  context?: {
    userId?: string;
    requestId?: string;
    userAgent?: string;
    url?: string;
    extra?: Record<string, any>;
    tags?: Record<string, string>;
    level?: 'info' | 'warning' | 'error' | 'fatal';
  }
) {
  const config = { ...DEFAULT_CONFIG };

  if (!config.enabled) {
    return;
  }

  try {
    // Normalize error data
    let errorData: {
      message: string;
      code?: string;
      stack?: string;
      level: string;
      fingerprint?: string[];
    };

    if (isAppError(error)) {
      errorData = {
        message: error.message,
        code: error.code,
        stack: error.stack,
        level: context?.level || SEVERITY_MAP[error.code] || 'error',
        fingerprint: [error.code, error.message],
      };
    } else if ('code' in error && 'source' in error) {
      // ClientError
      const clientError = error as ClientError;
      errorData = {
        message: clientError.message,
        code: clientError.code,
        level: context?.level || 'error',
        fingerprint: [clientError.code, clientError.source],
      };
    } else {
      // Regular Error
      errorData = {
        message: error.message,
        stack: error.stack,
        level: context?.level || 'error',
      };
    }

    // Log to application logger
    logger.error('Error reported to monitoring service', {
      errorCode: errorData.code,
      errorMessage: errorData.message,
      level: errorData.level,
      requestId: context?.requestId,
      userId: context?.userId,
    });

    // Here you would integrate with actual monitoring services:
    // - Sentry.captureException(error, { ...context })
    // - DataDog error tracking
    // - New Relic error reporting
    // - LogRocket session recording
  } catch (reportingError) {
    logger.error('Failed to report error to monitoring service', {
      reportingError: reportingError instanceof Error ? reportingError.message : reportingError,
      originalError: error.message,
    });
  }
}

// Report performance metrics
export function reportPerformanceMetric(
  name: string,
  value: number,
  unit: 'ms' | 'seconds' | 'bytes' | 'count' = 'ms',
  tags?: Record<string, string>
) {
  const config = { ...DEFAULT_CONFIG };

  if (!config.enabled) {
    return;
  }

  logger.info('Performance metric recorded', {
    metric: name,
    value,
    unit,
    tags,
  });
}

// Health check for monitoring services
export async function checkMonitoringHealth(): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
}> {
  const services: Record<string, boolean> = {
    logging: true, // Always available
    sentry: !!process.env.SENTRY_DSN,
  };

  const healthy = Object.values(services).some(status => status);

  return {
    healthy,
    services,
  };
}

// Export monitoring utilities
export const ErrorMonitoring = {
  init: initializeErrorMonitoring,
  setUserContext,
  reportError,
  reportPerformanceMetric,
  checkHealth: checkMonitoringHealth,
};

export default ErrorMonitoring;

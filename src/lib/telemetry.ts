/**
 * Telemetry Module — Intentionally Stubbed
 *
 * OpenTelemetry packages are not installed in this project.
 * Error tracking is handled by the centralized logger.
 * Add CloudWatch or Datadog integration as needed.
 *
 * The TracingService methods below log timing information through the
 * centralized logger so that developers still get visibility into
 * operation durations in development and production logs.
 */

import { logger } from './logger';

// Service information
const serviceName = 'direct-fan-platform';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';

// Initialize telemetry (disabled)
export function initTelemetry() {
  logger.info('Telemetry is disabled - Sentry handles error tracking');
}

// Stub tracer instance
export const tracer = {
  startActiveSpan: (name: string, options: any, fn: any) => {
    return fn({
      setStatus: () => {},
      setAttributes: () => {},
      recordException: () => {},
      end: () => {},
    });
  },
};

// Stub metrics instance
export const meter = {
  createHistogram: () => ({ record: () => {} }),
  createCounter: () => ({ add: () => {} }),
  createUpDownCounter: () => ({ add: () => {} }),
};

// Custom metrics stubs
export const httpRequestDuration = { record: () => {} };
export const httpRequestCount = { add: () => {} };
export const activeConnections = { add: () => {} };
export const databaseOperationDuration = { record: () => {} };
export const businessEvents = { add: () => {} };

// Tracing utilities (stub implementations with timing logged to logger)
export class TracingService {
  /**
   * Create a span for HTTP requests (stub — logs timing to logger)
   */
  static async traceHttpRequest<T>(
    name: string,
    operation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      logger.debug(`[trace:http] ${name} completed in ${duration}ms`, { duration, ...attributes });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`[trace:http] ${name} failed after ${duration}ms`, { duration, ...attributes }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Create a span for database operations (stub — logs timing to logger)
   */
  static async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    dbOperation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await dbOperation();
      const duration = Date.now() - start;
      logger.debug(`[trace:db] ${operation} on ${table} completed in ${duration}ms`, { duration, operation, table, ...attributes });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`[trace:db] ${operation} on ${table} failed after ${duration}ms`, { duration, operation, table, ...attributes }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Create a span for business events (stub — logs timing to logger)
   */
  static async traceBusinessEvent<T>(
    eventName: string,
    eventType: string,
    operation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      logger.debug(`[trace:business] ${eventName} (${eventType}) completed in ${duration}ms`, { duration, eventName, eventType, ...attributes });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`[trace:business] ${eventName} (${eventType}) failed after ${duration}ms`, { duration, eventName, eventType, ...attributes }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Record a business metric (stub — logs to logger)
   */
  static recordBusinessMetric(
    metricName: string,
    value: number,
    attributes: Record<string, string | number | boolean> = {}
  ): void {
    logger.debug(`[metric:business] ${metricName} = ${value}`, { metricName, value, ...attributes });
  }
}

// Get telemetry health
export function getTelemetryHealth() {
  const sentryAvailable = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    status: 'disabled' as const,
    message: 'OpenTelemetry is disabled. Sentry handles error tracking.',
    sentry: {
      available: sentryAvailable,
      dsn: sentryAvailable ? '***configured***' : 'not configured',
    },
    service: {
      name: serviceName,
      version: serviceVersion,
      environment,
    },
  };
}

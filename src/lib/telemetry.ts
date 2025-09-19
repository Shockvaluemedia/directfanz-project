// Telemetry dependencies are disabled due to missing packages
// import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
// import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
// import { registerInstrumentations } from '@opentelemetry/instrumentation';
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
// import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
// import { trace, metrics, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from './logger';

// Service information
const serviceName = 'direct-fan-platform';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';

// Telemetry is disabled - stub implementations below

// Initialize telemetry (disabled)
export function initTelemetry() {
  logger.info('Telemetry is disabled - stub implementation');
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

// Tracing utilities (stub implementations)
export class TracingService {
  /**
   * Create a span for HTTP requests (stub)
   */
  static async traceHttpRequest<T>(
    name: string,
    operation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    // Just execute the operation without tracing
    return operation();
  }

  /**
   * Create a span for database operations (stub)
   */
  static async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    dbOperation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    // Just execute the operation without tracing
    return dbOperation();
  }

  /**
   * Create a span for business events (stub)
   */
  static async traceBusinessEvent<T>(
    eventName: string,
    eventType: string,
    operation: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    // Just execute the operation without tracing
    return operation();
  }

  /**
   * Record a business metric (stub)
   */
  static recordBusinessMetric(
    metricName: string,
    value: number,
    attributes: Record<string, string | number | boolean> = {}
  ): void {
    // Stub - no actual recording
  }
}

// Get telemetry health (stub)
export function getTelemetryHealth() {
  return {
    status: 'disabled',
    message: 'Telemetry is disabled due to missing dependencies',
  };
}

/**
 * AWS X-Ray Distributed Tracing Service
 * Implements comprehensive distributed tracing for the DirectFanz platform
 * Requirements: 7.2 - AWS X-Ray for distributed tracing
 */

import AWSXRay from 'aws-xray-sdk-core';
import { Segment, Subsegment } from 'aws-xray-sdk-core';

interface TraceConfig {
  serviceName: string;
  environment: string;
  samplingRate: number;
  enableAutoCapture: boolean;
}

interface CustomAnnotations {
  userId?: string;
  userType?: string;
  endpoint?: string;
  operation?: string;
  contentType?: string;
  streamId?: string;
  paymentId?: string;
}

interface CustomMetadata {
  requestBody?: any;
  responseBody?: any;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  errorDetails?: any;
  businessContext?: any;
}

export class XRayTracingService {
  private config: TraceConfig;
  private isEnabled: boolean;

  constructor(config: TraceConfig) {
    this.config = config;
    this.isEnabled = process.env.NODE_ENV !== 'test' && process.env.ENABLE_XRAY !== 'false';
    
    if (this.isEnabled) {
      this.initializeXRay();
    }
  }

  private initializeXRay(): void {
    // Configure X-Ray
    AWSXRay.config([
      AWSXRay.plugins.ECSPlugin,
      AWSXRay.plugins.EC2Plugin
    ]);

    // Set service name
    AWSXRay.middleware.setSamplingRules({
      version: 2,
      default: {
        fixed_target: 1,
        rate: this.config.samplingRate
      },
      rules: [
        {
          description: 'API endpoints',
          service_name: this.config.serviceName,
          http_method: '*',
          url_path: '/api/*',
          fixed_target: 2,
          rate: 0.2
        },
        {
          description: 'Streaming endpoints',
          service_name: this.config.serviceName,
          http_method: '*',
          url_path: '/stream/*',
          fixed_target: 1,
          rate: 0.05
        }
      ]
    });

    // Enable automatic AWS SDK instrumentation
    if (this.config.enableAutoCapture) {
      AWSXRay.captureAWS(require('aws-sdk'));
    }

    console.log(`X-Ray tracing initialized for service: ${this.config.serviceName}`);
  }

  /**
   * Create a new trace segment
   */
  createSegment(name: string, annotations?: CustomAnnotations, metadata?: CustomMetadata): Segment | null {
    if (!this.isEnabled) return null;

    try {
      const segment = new AWSXRay.Segment(name);
      
      // Add service information
      segment.addAnnotation('service', this.config.serviceName);
      segment.addAnnotation('environment', this.config.environment);
      
      // Add custom annotations
      if (annotations) {
        Object.entries(annotations).forEach(([key, value]) => {
          if (value !== undefined) {
            segment.addAnnotation(key, value);
          }
        });
      }

      // Add custom metadata
      if (metadata) {
        segment.addMetadata('custom', metadata);
      }

      return segment;
    } catch (error) {
      console.error('Failed to create X-Ray segment:', error);
      return null;
    }
  }

  /**
   * Create a subsegment for detailed tracing
   */
  createSubsegment(
    name: string, 
    parentSegment?: Segment,
    annotations?: CustomAnnotations,
    metadata?: CustomMetadata
  ): Subsegment | null {
    if (!this.isEnabled) return null;

    try {
      const parent = parentSegment || AWSXRay.getSegment();
      if (!parent) {
        console.warn('No parent segment found for subsegment:', name);
        return null;
      }

      const subsegment = parent.addNewSubsegment(name);
      
      // Add custom annotations
      if (annotations) {
        Object.entries(annotations).forEach(([key, value]) => {
          if (value !== undefined) {
            subsegment.addAnnotation(key, value);
          }
        });
      }

      // Add custom metadata
      if (metadata) {
        subsegment.addMetadata('custom', metadata);
      }

      return subsegment;
    } catch (error) {
      console.error('Failed to create X-Ray subsegment:', error);
      return null;
    }
  }

  /**
   * Trace an async function
   */
  async traceAsync<T>(
    name: string,
    fn: (segment?: Segment) => Promise<T>,
    annotations?: CustomAnnotations,
    metadata?: CustomMetadata
  ): Promise<T> {
    if (!this.isEnabled) {
      return fn();
    }

    return AWSXRay.captureAsyncFunc(name, async (subsegment) => {
      try {
        // Add custom annotations
        if (annotations) {
          Object.entries(annotations).forEach(([key, value]) => {
            if (value !== undefined) {
              subsegment.addAnnotation(key, value);
            }
          });
        }

        // Add custom metadata
        if (metadata) {
          subsegment.addMetadata('custom', metadata);
        }

        const result = await fn(subsegment);
        
        // Mark as successful
        subsegment.addAnnotation('success', true);
        
        return result;
      } catch (error) {
        // Add error information
        subsegment.addError(error as Error);
        subsegment.addAnnotation('success', false);
        subsegment.addMetadata('error', {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name
        });
        
        throw error;
      } finally {
        subsegment.close();
      }
    });
  }

  /**
   * Trace a synchronous function
   */
  traceSync<T>(
    name: string,
    fn: (segment?: Segment) => T,
    annotations?: CustomAnnotations,
    metadata?: CustomMetadata
  ): T {
    if (!this.isEnabled) {
      return fn();
    }

    return AWSXRay.captureFunc(name, (subsegment) => {
      try {
        // Add custom annotations
        if (annotations) {
          Object.entries(annotations).forEach(([key, value]) => {
            if (value !== undefined) {
              subsegment.addAnnotation(key, value);
            }
          });
        }

        // Add custom metadata
        if (metadata) {
          subsegment.addMetadata('custom', metadata);
        }

        const result = fn(subsegment);
        
        // Mark as successful
        subsegment.addAnnotation('success', true);
        
        return result;
      } catch (error) {
        // Add error information
        subsegment.addError(error as Error);
        subsegment.addAnnotation('success', false);
        subsegment.addMetadata('error', {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name
        });
        
        throw error;
      }
    });
  }

  /**
   * Trace database operations
   */
  async traceDatabaseOperation<T>(
    operation: string,
    query: string,
    fn: () => Promise<T>,
    additionalMetadata?: any
  ): Promise<T> {
    return this.traceAsync(
      `database-${operation}`,
      fn,
      {
        operation: 'database',
        endpoint: operation
      },
      {
        query: query.substring(0, 500), // Limit query length
        operation,
        ...additionalMetadata
      }
    );
  }

  /**
   * Trace API calls
   */
  async traceAPICall<T>(
    method: string,
    endpoint: string,
    fn: () => Promise<T>,
    userId?: string,
    requestData?: any
  ): Promise<T> {
    return this.traceAsync(
      `api-${method.toLowerCase()}-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
      fn,
      {
        userId,
        endpoint,
        operation: 'api-call'
      },
      {
        httpMethod: method,
        endpoint,
        requestData: requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined
      }
    );
  }

  /**
   * Trace streaming operations
   */
  async traceStreamingOperation<T>(
    operation: string,
    streamId: string,
    fn: () => Promise<T>,
    userId?: string,
    additionalMetadata?: any
  ): Promise<T> {
    return this.traceAsync(
      `streaming-${operation}`,
      fn,
      {
        userId,
        streamId,
        operation: 'streaming',
        contentType: 'video'
      },
      {
        streamId,
        operation,
        ...additionalMetadata
      }
    );
  }

  /**
   * Trace payment operations
   */
  async tracePaymentOperation<T>(
    operation: string,
    paymentId: string,
    fn: () => Promise<T>,
    userId?: string,
    amount?: number
  ): Promise<T> {
    return this.traceAsync(
      `payment-${operation}`,
      fn,
      {
        userId,
        paymentId,
        operation: 'payment'
      },
      {
        paymentId,
        operation,
        amount: amount ? `$${amount}` : undefined
      }
    );
  }

  /**
   * Trace external service calls
   */
  async traceExternalService<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    additionalMetadata?: any
  ): Promise<T> {
    return this.traceAsync(
      `external-${serviceName}-${operation}`,
      fn,
      {
        operation: 'external-service',
        endpoint: serviceName
      },
      {
        serviceName,
        operation,
        ...additionalMetadata
      }
    );
  }

  /**
   * Add custom annotation to current segment
   */
  addAnnotation(key: string, value: string | number | boolean): void {
    if (!this.isEnabled) return;

    try {
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addAnnotation(key, value);
      }
    } catch (error) {
      console.error('Failed to add X-Ray annotation:', error);
    }
  }

  /**
   * Add custom metadata to current segment
   */
  addMetadata(namespace: string, data: any): void {
    if (!this.isEnabled) return;

    try {
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addMetadata(namespace, data);
      }
    } catch (error) {
      console.error('Failed to add X-Ray metadata:', error);
    }
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | null {
    if (!this.isEnabled) return null;

    try {
      const segment = AWSXRay.getSegment();
      return segment ? segment.trace_id : null;
    } catch (error) {
      console.error('Failed to get X-Ray trace ID:', error);
      return null;
    }
  }

  /**
   * Get Express.js middleware for automatic tracing
   */
  getExpressMiddleware() {
    if (!this.isEnabled) {
      return (req: any, res: any, next: any) => next();
    }

    return AWSXRay.express.openSegment(this.config.serviceName);
  }

  /**
   * Get Express.js closing middleware
   */
  getExpressClosingMiddleware() {
    if (!this.isEnabled) {
      return (req: any, res: any, next: any) => next();
    }

    return AWSXRay.express.closeSegment();
  }

  /**
   * Health check for X-Ray service
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) return true;

    try {
      // Create a test segment to verify X-Ray is working
      return this.traceSync('xray-health-check', () => {
        return true;
      }, { operation: 'health-check' });
    } catch (error) {
      console.error('X-Ray health check failed:', error);
      return false;
    }
  }
}

// Singleton instance for application use
let xrayServiceInstance: XRayTracingService | null = null;

export function getXRayService(): XRayTracingService {
  if (!xrayServiceInstance) {
    const config: TraceConfig = {
      serviceName: process.env.XRAY_SERVICE_NAME || 'directfanz-platform',
      environment: process.env.NODE_ENV || 'development',
      samplingRate: parseFloat(process.env.XRAY_SAMPLING_RATE || '0.1'),
      enableAutoCapture: process.env.XRAY_AUTO_CAPTURE !== 'false'
    };

    xrayServiceInstance = new XRayTracingService(config);
  }

  return xrayServiceInstance;
}

// Export the AWSXRay SDK for direct use if needed
export { AWSXRay };

// Export types for use in other modules
export type { TraceConfig, CustomAnnotations, CustomMetadata };
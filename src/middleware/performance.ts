import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance-monitor';

/**
 * API Performance Monitoring Middleware
 * Automatically tracks response times for all API endpoints
 */
export async function performanceMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  // Only monitor API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return response;
  }

  const startTime = performance.now();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  // Add performance headers
  response.headers.set('X-Performance-Start', startTime.toString());
  
  // Monitor the response
  const originalJson = response.json;
  response.json = async function(...args) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Record API performance metrics
    await performanceMonitor.monitorApiEndpoint(
      endpoint,
      method,
      async () => {
        // Simulate the work by returning the duration
        return duration;
      }
    );

    // Add performance headers to response
    response.headers.set('X-Performance-Duration', duration.toString());
    response.headers.set('X-Performance-Endpoint', endpoint);
    
    return originalJson.apply(this, args);
  };

  return response;
}

/**
 * Wrapper for Next.js API routes to add automatic performance monitoring
 */
export function withPerformanceMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse | Response>
) {
  return async (...args: T): Promise<NextResponse | Response> => {
    const request = args[0] as NextRequest;
    const startTime = performance.now();
    
    try {
      const result = await handler(...args);
      const duration = performance.now() - startTime;
      
      // Extract endpoint info
      const endpoint = request.nextUrl.pathname;
      const method = request.method;
      
      // Record performance metrics
      await performanceMonitor.recordMeasurement(
        `api_${endpoint}_${method}`,
        duration,
        'api',
        { endpoint, method, success: true }
      );

      // Add performance headers if it's a NextResponse
      if (result instanceof NextResponse) {
        result.headers.set('X-Performance-Duration', duration.toString());
        result.headers.set('X-Performance-Endpoint', endpoint);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Record failed request performance
      const endpoint = request.nextUrl.pathname;
      const method = request.method;
      
      await performanceMonitor.recordMeasurement(
        `api_${endpoint}_${method}`,
        duration,
        'api',
        { endpoint, method, success: false, error: (error as Error).message }
      );

      throw error;
    }
  };
}
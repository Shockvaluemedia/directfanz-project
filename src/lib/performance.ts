/**
 * Performance monitoring and testing utilities
 */
import { logger } from './logger';

// Performance metric types
export type PerformanceMetric = {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
};

// In-memory store for performance metrics
const performanceMetrics: PerformanceMetric[] = [];

/**
 * Measures the execution time of a function
 * @param name Name of the operation being measured
 * @param fn Function to measure
 * @param metadata Additional context about the operation
 * @returns Result of the function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    // Record the metric
    const metric: PerformanceMetric = {
      name,
      startTime,
      duration,
      metadata
    };
    
    performanceMetrics.push(metric);
    
    // Log slow operations (over 500ms)
    if (duration > 500) {
      logger.warn(`Slow operation detected: ${name}`, {
        duration,
        ...metadata
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Log failed operations
    logger.error(`Operation failed: ${name}`, {
      duration,
      ...metadata
    }, error as Error);
    
    throw error;
  }
}

/**
 * Measures the execution time of a synchronous function
 * @param name Name of the operation being measured
 * @param fn Function to measure
 * @param metadata Additional context about the operation
 * @returns Result of the function
 */
export function measurePerformanceSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const startTime = performance.now();
  
  try {
    const result = fn();
    const duration = performance.now() - startTime;
    
    // Record the metric
    const metric: PerformanceMetric = {
      name,
      startTime,
      duration,
      metadata
    };
    
    performanceMetrics.push(metric);
    
    // Log slow operations (over 100ms for sync operations)
    if (duration > 100) {
      logger.warn(`Slow synchronous operation detected: ${name}`, {
        duration,
        ...metadata
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Log failed operations
    logger.error(`Synchronous operation failed: ${name}`, {
      duration,
      ...metadata
    }, error as Error);
    
    throw error;
  }
}

/**
 * Get recent performance metrics
 * @param limit Maximum number of metrics to return
 * @returns Array of performance metrics
 */
export function getRecentMetrics(limit = 100): PerformanceMetric[] {
  return performanceMetrics.slice(-limit);
}

/**
 * Get performance metrics for a specific operation
 * @param name Name of the operation
 * @returns Array of performance metrics for the operation
 */
export function getMetricsByName(name: string): PerformanceMetric[] {
  return performanceMetrics.filter(metric => metric.name === name);
}

/**
 * Calculate average duration for a specific operation
 * @param name Name of the operation
 * @returns Average duration in milliseconds
 */
export function getAverageDuration(name: string): number {
  const metrics = getMetricsByName(name);
  
  if (metrics.length === 0) {
    return 0;
  }
  
  const totalDuration = metrics.reduce((sum, metric) => sum + metric.duration, 0);
  return totalDuration / metrics.length;
}

/**
 * Clear all recorded performance metrics
 */
export function clearMetrics(): void {
  performanceMetrics.length = 0;
}

/**
 * Create a performance report
 * @returns Performance report object
 */
export function generatePerformanceReport(): Record<string, any> {
  // Group metrics by name
  const metricsByName: Record<string, PerformanceMetric[]> = {};
  
  performanceMetrics.forEach(metric => {
    if (!metricsByName[metric.name]) {
      metricsByName[metric.name] = [];
    }
    
    metricsByName[metric.name].push(metric);
  });
  
  // Calculate statistics for each operation
  const report: Record<string, any> = {};
  
  Object.entries(metricsByName).forEach(([name, metrics]) => {
    const durations = metrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const avgDuration = totalDuration / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    report[name] = {
      count: metrics.length,
      avgDuration,
      minDuration,
      maxDuration,
      totalDuration,
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
    };
  });
  
  return report;
}

/**
 * Calculate percentile value from an array of numbers
 * @param values Array of values
 * @param percentile Percentile to calculate (0-100)
 * @returns Percentile value
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}
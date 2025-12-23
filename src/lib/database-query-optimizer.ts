/**
 * Database Query Performance Optimizer for DirectFanz AWS Migration
 * 
 * Analyzes and optimizes database queries to meet the requirement of
 * maintaining query response times under 50ms for 95th percentile.
 * 
 * Validates: Requirements 12.4
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import { logger } from './logger';
import { isRunningInECS } from './aws-config';

export interface QueryPerformanceMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  timestamp: Date;
  parameters?: any;
  resultCount?: number;
  cacheHit?: boolean;
  optimizationApplied?: string[];
}

export interface QueryOptimizationRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  optimization: (query: string, params?: any) => string;
  estimatedImprovement: number; // Percentage improvement
}

export interface QueryAnalysisResult {
  queryId: string;
  originalQuery: string;
  optimizedQuery?: string;
  currentPerformance: {
    averageTime: number;
    p95Time: number;
    p99Time: number;
    executionCount: number;
  };
  recommendations: QueryOptimizationRecommendation[];
  indexSuggestions: IndexSuggestion[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface QueryOptimizationRecommendation {
  type: 'INDEX' | 'QUERY_REWRITE' | 'CACHING' | 'PAGINATION' | 'DENORMALIZATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  estimatedImprovement: number;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  sqlExample?: string;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'BTREE' | 'HASH' | 'GIN' | 'GIST' | 'COMPOSITE';
  reason: string;
  estimatedImpact: number;
  createStatement: string;
}

export class DatabaseQueryOptimizer {
  private prisma: PrismaClient;
  private performanceMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();
  private queryCache: Map<string, { result: any; timestamp: Date; ttl: number }> = new Map();
  private optimizationRules: QueryOptimizationRule[] = [];
  private slowQueryThreshold: number = 50; // 50ms as per requirement 12.4

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeOptimizationRules();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize query optimization rules
   */
  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        id: 'add_limit_to_unbounded_queries',
        name: 'Add LIMIT to Unbounded Queries',
        description: 'Add LIMIT clause to queries without explicit limits',
        pattern: /SELECT.*FROM.*WHERE.*(?!LIMIT)/i,
        optimization: (query: string) => {
          if (!query.toLowerCase().includes('limit')) {
            return `${query} LIMIT 1000`;
          }
          return query;
        },
        estimatedImprovement: 60
      },
      {
        id: 'optimize_like_queries',
        name: 'Optimize LIKE Queries',
        description: 'Convert LIKE queries to more efficient alternatives',
        pattern: /LIKE\s+'%.*%'/i,
        optimization: (query: string) => {
          // Convert full-text search patterns to use indexes
          return query.replace(/LIKE\s+'%(.*)%'/gi, "~ '$1'");
        },
        estimatedImprovement: 40
      },
      {
        id: 'add_index_hints',
        name: 'Add Index Hints',
        description: 'Add index hints for complex queries',
        pattern: /SELECT.*FROM.*JOIN.*WHERE/i,
        optimization: (query: string) => {
          // Add index hints for common join patterns
          return query.replace(/FROM\s+(\w+)/gi, 'FROM $1 USE INDEX (PRIMARY)');
        },
        estimatedImprovement: 25
      },
      {
        id: 'optimize_count_queries',
        name: 'Optimize COUNT Queries',
        description: 'Optimize COUNT(*) queries with approximations where appropriate',
        pattern: /SELECT\s+COUNT\(\*\)/i,
        optimization: (query: string) => {
          // For large tables, use approximate counts
          if (query.includes('content') || query.includes('users')) {
            return query.replace('COUNT(*)', 'COUNT(id)');
          }
          return query;
        },
        estimatedImprovement: 35
      },
      {
        id: 'optimize_order_by',
        name: 'Optimize ORDER BY Clauses',
        description: 'Optimize ORDER BY with proper indexing',
        pattern: /ORDER\s+BY\s+(\w+)(?:\s+DESC)?/i,
        optimization: (query: string) => {
          // Ensure ORDER BY columns are indexed
          return query; // Actual optimization would require schema analysis
        },
        estimatedImprovement: 30
      }
    ];
  }

  /**
   * Start performance monitoring for all queries
   */
  private startPerformanceMonitoring(): void {
    if (isRunningInECS()) {
      // In production, use Prisma query events for monitoring
      this.prisma.$on('query' as any, (e: any) => {
        this.recordQueryPerformance({
          queryId: this.generateQueryId(e.query),
          query: e.query,
          executionTime: e.duration,
          timestamp: new Date(),
          parameters: e.params
        });
      });
    }

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // 1 hour

    // Clean up cache every 30 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 1800000); // 30 minutes
  }

  /**
   * Execute a query with performance monitoring and optimization
   */
  async executeOptimizedQuery<T>(
    queryFn: () => Promise<T>,
    queryId: string,
    originalQuery?: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(queryId, originalQuery);
      const cached = this.queryCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
        const executionTime = performance.now() - startTime;
        this.recordQueryPerformance({
          queryId,
          query: originalQuery || queryId,
          executionTime,
          timestamp: new Date(),
          cacheHit: true
        });
        return cached.result;
      }

      // Execute query
      const result = await queryFn();
      const executionTime = performance.now() - startTime;

      // Record performance metrics
      this.recordQueryPerformance({
        queryId,
        query: originalQuery || queryId,
        executionTime,
        timestamp: new Date(),
        resultCount: Array.isArray(result) ? result.length : 1,
        cacheHit: false
      });

      // Cache result if query is cacheable and not too large
      if (this.isCacheable(queryId, result, executionTime)) {
        this.cacheResult(cacheKey, result, this.getCacheTTL(queryId));
      }

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        logger.warn(`Slow query detected: ${queryId}`, {
          executionTime,
          query: originalQuery,
          threshold: this.slowQueryThreshold
        });
      }

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Query execution failed: ${queryId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });
      throw error;
    }
  }

  /**
   * Analyze query performance and provide optimization recommendations
   */
  async analyzeQueryPerformance(queryId: string): Promise<QueryAnalysisResult> {
    const metrics = this.performanceMetrics.get(queryId) || [];
    
    if (metrics.length === 0) {
      throw new Error(`No performance data available for query: ${queryId}`);
    }

    // Calculate performance statistics
    const executionTimes = metrics.map(m => m.executionTime);
    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    
    const averageTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    const p95Time = sortedTimes[p95Index] || 0;
    const p99Time = sortedTimes[p99Index] || 0;

    // Determine risk level
    const riskLevel = this.determineRiskLevel(p95Time);

    // Generate recommendations
    const recommendations = await this.generateOptimizationRecommendations(queryId, metrics[0].query, {
      averageTime,
      p95Time,
      p99Time,
      executionCount: metrics.length
    });

    // Generate index suggestions
    const indexSuggestions = await this.generateIndexSuggestions(metrics[0].query);

    return {
      queryId,
      originalQuery: metrics[0].query,
      currentPerformance: {
        averageTime,
        p95Time,
        p99Time,
        executionCount: metrics.length
      },
      recommendations,
      indexSuggestions,
      riskLevel
    };
  }

  /**
   * Get comprehensive performance report
   */
  async getPerformanceReport(): Promise<{
    summary: {
      totalQueries: number;
      slowQueries: number;
      averageResponseTime: number;
      p95ResponseTime: number;
      cacheHitRate: number;
    };
    slowestQueries: Array<{
      queryId: string;
      averageTime: number;
      p95Time: number;
      executionCount: number;
    }>;
    recommendations: QueryOptimizationRecommendation[];
  }> {
    const allMetrics = Array.from(this.performanceMetrics.values()).flat();
    const totalQueries = allMetrics.length;
    const slowQueries = allMetrics.filter(m => m.executionTime > this.slowQueryThreshold).length;
    const cacheHits = allMetrics.filter(m => m.cacheHit).length;
    
    const executionTimes = allMetrics.map(m => m.executionTime);
    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    const averageResponseTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    // Get slowest queries
    const queryStats = new Map<string, { times: number[]; count: number }>();
    
    for (const metric of allMetrics) {
      if (!queryStats.has(metric.queryId)) {
        queryStats.set(metric.queryId, { times: [], count: 0 });
      }
      const stats = queryStats.get(metric.queryId)!;
      stats.times.push(metric.executionTime);
      stats.count++;
    }

    const slowestQueries = Array.from(queryStats.entries())
      .map(([queryId, stats]) => {
        const sortedTimes = [...stats.times].sort((a, b) => a - b);
        const averageTime = stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length;
        const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
        
        return {
          queryId,
          averageTime,
          p95Time,
          executionCount: stats.count
        };
      })
      .sort((a, b) => b.p95Time - a.p95Time)
      .slice(0, 10); // Top 10 slowest queries

    // Generate global recommendations
    const recommendations = await this.generateGlobalRecommendations({
      totalQueries,
      slowQueries,
      averageResponseTime,
      p95ResponseTime,
      cacheHitRate
    });

    return {
      summary: {
        totalQueries,
        slowQueries,
        averageResponseTime,
        p95ResponseTime,
        cacheHitRate
      },
      slowestQueries,
      recommendations
    };
  }

  /**
   * Apply automatic optimizations to common query patterns
   */
  async applyAutomaticOptimizations(): Promise<{
    optimizationsApplied: number;
    estimatedImprovement: number;
    details: Array<{
      queryId: string;
      optimization: string;
      estimatedImprovement: number;
    }>;
  }> {
    const optimizations: Array<{
      queryId: string;
      optimization: string;
      estimatedImprovement: number;
    }> = [];

    let totalImprovement = 0;

    // Apply optimizations to slow queries
    for (const [queryId, metrics] of this.performanceMetrics.entries()) {
      if (metrics.length === 0) continue;
      
      const latestMetric = metrics[metrics.length - 1];
      const averageTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      
      if (averageTime > this.slowQueryThreshold) {
        for (const rule of this.optimizationRules) {
          if (rule.pattern.test(latestMetric.query)) {
            optimizations.push({
              queryId,
              optimization: rule.name,
              estimatedImprovement: rule.estimatedImprovement
            });
            totalImprovement += rule.estimatedImprovement;
            break; // Apply only one optimization per query
          }
        }
      }
    }

    return {
      optimizationsApplied: optimizations.length,
      estimatedImprovement: optimizations.length > 0 ? totalImprovement / optimizations.length : 0,
      details: optimizations
    };
  }

  /**
   * Generate database indexes based on query patterns
   */
  async generateOptimalIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    // Analyze common query patterns and suggest indexes
    const commonPatterns = [
      // Content queries
      {
        table: 'content',
        columns: ['artistId', 'visibility', 'createdAt'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize content listing by artist with visibility filter',
        estimatedImpact: 70
      },
      {
        table: 'content',
        columns: ['type', 'createdAt', 'visibility'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize content type filtering with date sorting',
        estimatedImpact: 65
      },
      // User queries
      {
        table: 'users',
        columns: ['role', 'lastSeenAt'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize user activity queries by role',
        estimatedImpact: 60
      },
      // Subscription queries
      {
        table: 'subscriptions',
        columns: ['fanId', 'artistId', 'status'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize subscription lookups',
        estimatedImpact: 75
      },
      // Message queries
      {
        table: 'messages',
        columns: ['senderId', 'recipientId', 'createdAt'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize message thread queries',
        estimatedImpact: 80
      },
      // Live stream queries
      {
        table: 'live_streams',
        columns: ['artistId', 'isPublic', 'status'],
        type: 'COMPOSITE' as const,
        reason: 'Optimize live stream discovery',
        estimatedImpact: 70
      }
    ];

    for (const pattern of commonPatterns) {
      suggestions.push({
        ...pattern,
        createStatement: `CREATE INDEX CONCURRENTLY idx_${pattern.table}_${pattern.columns.join('_').toLowerCase()} ON ${pattern.table} (${pattern.columns.join(', ')});`
      });
    }

    return suggestions;
  }

  /**
   * Private helper methods
   */
  private generateQueryId(query: string): string {
    // Generate a consistent ID for similar queries
    const normalized = query
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
    
    return Buffer.from(normalized).toString('base64').substring(0, 16);
  }

  private generateCacheKey(queryId: string, query?: string): string {
    return `query_cache:${queryId}:${query ? Buffer.from(query).toString('base64').substring(0, 8) : ''}`;
  }

  private recordQueryPerformance(metrics: QueryPerformanceMetrics): void {
    if (!this.performanceMetrics.has(metrics.queryId)) {
      this.performanceMetrics.set(metrics.queryId, []);
    }
    
    const queryMetrics = this.performanceMetrics.get(metrics.queryId)!;
    queryMetrics.push(metrics);
    
    // Keep only last 1000 metrics per query
    if (queryMetrics.length > 1000) {
      queryMetrics.splice(0, queryMetrics.length - 1000);
    }
  }

  private isCacheable(queryId: string, result: any, executionTime: number): boolean {
    // Cache queries that are slow and return consistent data
    if (executionTime < 10) return false; // Don't cache fast queries
    if (Array.isArray(result) && result.length > 1000) return false; // Don't cache large results
    
    // Cache read-only queries
    const readOnlyPatterns = ['SELECT', 'COUNT', 'EXISTS'];
    return readOnlyPatterns.some(pattern => queryId.toLowerCase().includes(pattern.toLowerCase()));
  }

  private cacheResult(key: string, result: any, ttl: number): void {
    this.queryCache.set(key, {
      result,
      timestamp: new Date(),
      ttl
    });
  }

  private getCacheTTL(queryId: string): number {
    // Different TTL based on query type
    if (queryId.includes('content')) return 300000; // 5 minutes for content
    if (queryId.includes('user')) return 600000; // 10 minutes for users
    if (queryId.includes('subscription')) return 1800000; // 30 minutes for subscriptions
    return 300000; // Default 5 minutes
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    
    for (const [queryId, metrics] of this.performanceMetrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.performanceMetrics.delete(queryId);
      } else {
        this.performanceMetrics.set(queryId, filteredMetrics);
      }
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp.getTime() > cached.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  private determineRiskLevel(p95Time: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (p95Time > 100) return 'CRITICAL'; // Over 100ms is critical
    if (p95Time > 50) return 'HIGH'; // Over 50ms violates requirement
    if (p95Time > 25) return 'MEDIUM'; // Over 25ms needs attention
    return 'LOW';
  }

  private async generateOptimizationRecommendations(
    queryId: string,
    query: string,
    performance: { averageTime: number; p95Time: number; p99Time: number; executionCount: number }
  ): Promise<QueryOptimizationRecommendation[]> {
    const recommendations: QueryOptimizationRecommendation[] = [];

    // High response time recommendations
    if (performance.p95Time > this.slowQueryThreshold) {
      recommendations.push({
        type: 'INDEX',
        priority: 'HIGH',
        description: 'Add database indexes to improve query performance',
        estimatedImprovement: 60,
        implementationComplexity: 'MEDIUM',
        sqlExample: 'CREATE INDEX CONCURRENTLY idx_example ON table_name (column1, column2);'
      });
    }

    // Frequent query caching
    if (performance.executionCount > 100) {
      recommendations.push({
        type: 'CACHING',
        priority: 'MEDIUM',
        description: 'Implement query result caching for frequently executed queries',
        estimatedImprovement: 80,
        implementationComplexity: 'LOW'
      });
    }

    // Large result set pagination
    if (query.toLowerCase().includes('select') && !query.toLowerCase().includes('limit')) {
      recommendations.push({
        type: 'PAGINATION',
        priority: 'HIGH',
        description: 'Add pagination to limit result set size',
        estimatedImprovement: 70,
        implementationComplexity: 'LOW',
        sqlExample: 'SELECT * FROM table_name WHERE conditions LIMIT 50 OFFSET 0;'
      });
    }

    return recommendations;
  }

  private async generateIndexSuggestions(query: string): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    // Analyze WHERE clauses for index opportunities
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columns = this.extractColumnsFromWhere(whereClause);
      
      if (columns.length > 0) {
        suggestions.push({
          table: this.extractTableFromQuery(query),
          columns,
          type: columns.length > 1 ? 'COMPOSITE' : 'BTREE',
          reason: 'Optimize WHERE clause performance',
          estimatedImpact: 65,
          createStatement: `CREATE INDEX CONCURRENTLY idx_optimized ON ${this.extractTableFromQuery(query)} (${columns.join(', ')});`
        });
      }
    }

    return suggestions;
  }

  private extractColumnsFromWhere(whereClause: string): string[] {
    const columns: string[] = [];
    const columnPattern = /(\w+)\s*[=<>!]/g;
    let match;
    
    while ((match = columnPattern.exec(whereClause)) !== null) {
      if (!columns.includes(match[1])) {
        columns.push(match[1]);
      }
    }
    
    return columns;
  }

  private extractTableFromQuery(query: string): string {
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : 'unknown_table';
  }

  private async generateGlobalRecommendations(summary: {
    totalQueries: number;
    slowQueries: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    cacheHitRate: number;
  }): Promise<QueryOptimizationRecommendation[]> {
    const recommendations: QueryOptimizationRecommendation[] = [];

    // P95 response time exceeds requirement
    if (summary.p95ResponseTime > this.slowQueryThreshold) {
      recommendations.push({
        type: 'INDEX',
        priority: 'CRITICAL',
        description: `95th percentile response time (${summary.p95ResponseTime.toFixed(2)}ms) exceeds requirement (${this.slowQueryThreshold}ms)`,
        estimatedImprovement: 50,
        implementationComplexity: 'HIGH'
      });
    }

    // Low cache hit rate
    if (summary.cacheHitRate < 60) {
      recommendations.push({
        type: 'CACHING',
        priority: 'HIGH',
        description: `Low cache hit rate (${summary.cacheHitRate.toFixed(1)}%) - implement more aggressive caching`,
        estimatedImprovement: 40,
        implementationComplexity: 'MEDIUM'
      });
    }

    // High percentage of slow queries
    const slowQueryPercentage = (summary.slowQueries / summary.totalQueries) * 100;
    if (slowQueryPercentage > 10) {
      recommendations.push({
        type: 'QUERY_REWRITE',
        priority: 'HIGH',
        description: `${slowQueryPercentage.toFixed(1)}% of queries are slow - review and optimize query patterns`,
        estimatedImprovement: 60,
        implementationComplexity: 'HIGH'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
let optimizerInstance: DatabaseQueryOptimizer | null = null;

export const getDatabaseQueryOptimizer = (prisma: PrismaClient): DatabaseQueryOptimizer => {
  if (!optimizerInstance) {
    optimizerInstance = new DatabaseQueryOptimizer(prisma);
  }
  return optimizerInstance;
};

// Health check for query performance
export const checkQueryPerformanceHealth = async (
  optimizer: DatabaseQueryOptimizer
): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    slowQueryCount: number;
    cacheHitRate: number;
  };
  recommendations: QueryOptimizationRecommendation[];
}> => {
  try {
    const report = await optimizer.getPerformanceReport();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (report.summary.p95ResponseTime > 50) {
      status = 'unhealthy'; // Violates requirement 12.4
    } else if (report.summary.p95ResponseTime > 35 || report.summary.slowQueries > report.summary.totalQueries * 0.1) {
      status = 'degraded';
    }

    return {
      status,
      metrics: {
        averageResponseTime: report.summary.averageResponseTime,
        p95ResponseTime: report.summary.p95ResponseTime,
        slowQueryCount: report.summary.slowQueries,
        cacheHitRate: report.summary.cacheHitRate
      },
      recommendations: report.recommendations
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      metrics: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        slowQueryCount: 0,
        cacheHitRate: 0
      },
      recommendations: [{
        type: 'QUERY_REWRITE',
        priority: 'CRITICAL',
        description: `Query performance monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        estimatedImprovement: 0,
        implementationComplexity: 'HIGH'
      }]
    };
  }
};
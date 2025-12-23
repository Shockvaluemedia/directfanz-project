/**
 * Database Performance Monitoring API
 * 
 * Provides real-time database query performance metrics and optimization
 * recommendations to ensure compliance with Requirements 12.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDatabaseQueryOptimizer, checkQueryPerformanceHealth } from '@/lib/database-query-optimizer';
import { getOptimizedQueries } from '@/lib/optimized-queries';
import { logger } from '@/lib/logger';

// GET /api/admin/database/performance - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';

    const optimizer = getDatabaseQueryOptimizer(prisma);

    switch (action) {
      case 'summary':
        const report = await optimizer.getPerformanceReport();
        return NextResponse.json({
          success: true,
          data: report,
          timestamp: new Date().toISOString()
        });

      case 'health':
        const health = await checkQueryPerformanceHealth(optimizer);
        return NextResponse.json({
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        });

      case 'analyze':
        const queryId = searchParams.get('queryId');
        if (!queryId) {
          return NextResponse.json(
            { success: false, error: 'queryId parameter is required for analysis' },
            { status: 400 }
          );
        }

        const analysis = await optimizer.analyzeQueryPerformance(queryId);
        return NextResponse.json({
          success: true,
          data: analysis,
          timestamp: new Date().toISOString()
        });

      case 'indexes':
        const indexSuggestions = await optimizer.generateOptimalIndexes();
        return NextResponse.json({
          success: true,
          data: {
            suggestions: indexSuggestions,
            count: indexSuggestions.length,
            estimatedTotalImpact: indexSuggestions.reduce((sum, s) => sum + s.estimatedImpact, 0) / indexSuggestions.length
          },
          timestamp: new Date().toISOString()
        });

      case 'optimizations':
        const optimizations = await optimizer.applyAutomaticOptimizations();
        return NextResponse.json({
          success: true,
          data: optimizations,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Database performance API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/database/performance - Execute performance tests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, parameters = {} } = body;

    const optimizer = getDatabaseQueryOptimizer(prisma);
    const optimizedQueries = getOptimizedQueries(prisma);

    switch (action) {
      case 'benchmark':
        const benchmarkResults = await runPerformanceBenchmark(optimizedQueries, parameters);
        return NextResponse.json({
          success: true,
          data: benchmarkResults,
          timestamp: new Date().toISOString()
        });

      case 'stress_test':
        const stressResults = await runStressTest(optimizedQueries, parameters);
        return NextResponse.json({
          success: true,
          data: stressResults,
          timestamp: new Date().toISOString()
        });

      case 'validate_indexes':
        const validationResults = await validateIndexPerformance(parameters);
        return NextResponse.json({
          success: true,
          data: validationResults,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Database performance test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Run comprehensive performance benchmark
 */
async function runPerformanceBenchmark(
  optimizedQueries: any,
  parameters: { iterations?: number; concurrency?: number }
) {
  const { iterations = 100, concurrency = 10 } = parameters;
  const results: any[] = [];

  // Test common query patterns
  const testQueries = [
    {
      name: 'Content by Artist',
      test: () => optimizedQueries.getContentByArtist('test-artist-id', { limit: 20 })
    },
    {
      name: 'User Subscriptions',
      test: () => optimizedQueries.getUserSubscriptions('test-user-id')
    },
    {
      name: 'Live Streams',
      test: () => optimizedQueries.getLiveStreams({ limit: 10 })
    },
    {
      name: 'Message Thread',
      test: () => optimizedQueries.getMessageThread('user1', 'user2', { limit: 50 })
    },
    {
      name: 'Search Content',
      test: () => optimizedQueries.searchContent('test query', { limit: 20 })
    }
  ];

  for (const query of testQueries) {
    const queryResults = [];
    
    // Run iterations
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await query.test();
        const executionTime = performance.now() - startTime;
        queryResults.push({ success: true, time: executionTime });
      } catch (error) {
        const executionTime = performance.now() - startTime;
        queryResults.push({ 
          success: false, 
          time: executionTime, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Calculate statistics
    const successfulResults = queryResults.filter(r => r.success);
    const times = successfulResults.map(r => r.time);
    const sortedTimes = [...times].sort((a, b) => a - b);
    
    const stats = {
      queryName: query.name,
      iterations,
      successCount: successfulResults.length,
      failureCount: queryResults.length - successfulResults.length,
      successRate: (successfulResults.length / queryResults.length) * 100,
      averageTime: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0,
      minTime: Math.min(...times) || 0,
      maxTime: Math.max(...times) || 0,
      medianTime: sortedTimes[Math.floor(sortedTimes.length / 2)] || 0,
      p95Time: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
      p99Time: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
      meetsRequirement: (sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0) < 50 // 50ms requirement
    };

    results.push(stats);
  }

  // Overall summary
  const overallStats = {
    totalQueries: results.length,
    queriesMeetingRequirement: results.filter(r => r.meetsRequirement).length,
    averageP95Time: results.reduce((sum, r) => sum + r.p95Time, 0) / results.length,
    overallSuccessRate: results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
    complianceRate: (results.filter(r => r.meetsRequirement).length / results.length) * 100
  };

  return {
    summary: overallStats,
    queryResults: results,
    requirementsMet: overallStats.complianceRate === 100,
    recommendations: generateBenchmarkRecommendations(results)
  };
}

/**
 * Run stress test with concurrent queries
 */
async function runStressTest(
  optimizedQueries: any,
  parameters: { duration?: number; concurrency?: number; queryTypes?: string[] }
) {
  const { duration = 30000, concurrency = 20, queryTypes = ['content', 'subscriptions', 'streams'] } = parameters;
  
  const startTime = Date.now();
  const endTime = startTime + duration;
  const results: any[] = [];
  const errors: any[] = [];

  // Create concurrent workers
  const workers = Array.from({ length: concurrency }, async (_, workerId) => {
    const workerResults: any[] = [];
    
    while (Date.now() < endTime) {
      const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
      const queryStartTime = performance.now();
      
      try {
        switch (queryType) {
          case 'content':
            await optimizedQueries.getContentByArtist(`test-artist-${workerId}`, { limit: 10 });
            break;
          case 'subscriptions':
            await optimizedQueries.getUserSubscriptions(`test-user-${workerId}`);
            break;
          case 'streams':
            await optimizedQueries.getLiveStreams({ limit: 5 });
            break;
        }
        
        const executionTime = performance.now() - queryStartTime;
        workerResults.push({
          workerId,
          queryType,
          executionTime,
          success: true,
          timestamp: new Date()
        });
        
      } catch (error) {
        const executionTime = performance.now() - queryStartTime;
        const errorResult = {
          workerId,
          queryType,
          executionTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        };
        
        workerResults.push(errorResult);
        errors.push(errorResult);
      }
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return workerResults;
  });

  // Wait for all workers to complete
  const workerResults = await Promise.all(workers);
  const allResults = workerResults.flat();

  // Calculate stress test statistics
  const successfulResults = allResults.filter(r => r.success);
  const times = successfulResults.map(r => r.executionTime);
  const sortedTimes = [...times].sort((a, b) => a - b);
  
  const stressStats = {
    duration: duration / 1000, // Convert to seconds
    concurrency,
    totalQueries: allResults.length,
    successfulQueries: successfulResults.length,
    failedQueries: allResults.length - successfulResults.length,
    successRate: (successfulResults.length / allResults.length) * 100,
    throughput: allResults.length / (duration / 1000), // Queries per second
    averageTime: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0,
    p95Time: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
    p99Time: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
    maxTime: Math.max(...times) || 0,
    minTime: Math.min(...times) || 0,
    meetsRequirementUnderLoad: (sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0) < 50
  };

  return {
    summary: stressStats,
    errors: errors.slice(0, 10), // First 10 errors for analysis
    performanceOverTime: generatePerformanceTimeline(allResults),
    recommendations: generateStressTestRecommendations(stressStats, errors)
  };
}

/**
 * Validate index performance
 */
async function validateIndexPerformance(parameters: { tables?: string[] }) {
  const { tables = ['content', 'users', 'subscriptions', 'messages', 'live_streams'] } = parameters;
  
  const indexAnalysis = [];
  
  for (const table of tables) {
    try {
      // Get index usage statistics (PostgreSQL specific)
      const indexStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes 
        WHERE tablename = ${table}
        ORDER BY idx_scan DESC
      ` as any[];

      // Get table size
      const tableSize = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_total_relation_size(${table}::regclass)) as size
      ` as any[];

      indexAnalysis.push({
        table,
        tableSize: tableSize[0]?.size || 'Unknown',
        indexes: indexStats.map((stat: any) => ({
          name: stat.indexname,
          scans: parseInt(stat.idx_scan) || 0,
          tuplesRead: parseInt(stat.idx_tup_read) || 0,
          tuplesFetched: parseInt(stat.idx_tup_fetch) || 0,
          efficiency: stat.idx_tup_read > 0 ? (stat.idx_tup_fetch / stat.idx_tup_read) * 100 : 0
        })),
        recommendations: generateIndexRecommendations(table, indexStats)
      });
      
    } catch (error) {
      indexAnalysis.push({
        table,
        error: error instanceof Error ? error.message : 'Unknown error',
        indexes: [],
        recommendations: []
      });
    }
  }

  return {
    analysis: indexAnalysis,
    summary: {
      tablesAnalyzed: indexAnalysis.length,
      totalIndexes: indexAnalysis.reduce((sum, a) => sum + a.indexes.length, 0),
      underutilizedIndexes: indexAnalysis.reduce((sum, a) => 
        sum + a.indexes.filter((i: any) => i.scans < 100).length, 0
      )
    }
  };
}

/**
 * Helper functions for generating recommendations
 */
function generateBenchmarkRecommendations(results: any[]) {
  const recommendations = [];
  
  const slowQueries = results.filter(r => !r.meetsRequirement);
  if (slowQueries.length > 0) {
    recommendations.push({
      type: 'PERFORMANCE',
      priority: 'HIGH',
      description: `${slowQueries.length} queries exceed 50ms requirement`,
      queries: slowQueries.map(q => q.queryName)
    });
  }

  const lowSuccessRate = results.filter(r => r.successRate < 95);
  if (lowSuccessRate.length > 0) {
    recommendations.push({
      type: 'RELIABILITY',
      priority: 'MEDIUM',
      description: `${lowSuccessRate.length} queries have success rate below 95%`,
      queries: lowSuccessRate.map(q => q.queryName)
    });
  }

  return recommendations;
}

function generateStressTestRecommendations(stats: any, errors: any[]) {
  const recommendations = [];
  
  if (!stats.meetsRequirementUnderLoad) {
    recommendations.push({
      type: 'PERFORMANCE',
      priority: 'CRITICAL',
      description: `P95 response time (${stats.p95Time.toFixed(2)}ms) exceeds 50ms under load`,
      suggestion: 'Consider adding database indexes or implementing query caching'
    });
  }

  if (stats.successRate < 95) {
    recommendations.push({
      type: 'RELIABILITY',
      priority: 'HIGH',
      description: `Success rate (${stats.successRate.toFixed(1)}%) is below acceptable threshold`,
      suggestion: 'Review error patterns and implement better error handling'
    });
  }

  if (errors.length > 0) {
    const errorTypes = [...new Set(errors.map(e => e.error))];
    recommendations.push({
      type: 'ERROR_HANDLING',
      priority: 'MEDIUM',
      description: `${errorTypes.length} different error types encountered`,
      errorTypes: errorTypes.slice(0, 5)
    });
  }

  return recommendations;
}

function generateIndexRecommendations(table: string, indexStats: any[]) {
  const recommendations = [];
  
  const unusedIndexes = indexStats.filter((stat: any) => parseInt(stat.idx_scan) === 0);
  if (unusedIndexes.length > 0) {
    recommendations.push({
      type: 'INDEX_CLEANUP',
      description: `${unusedIndexes.length} unused indexes can be dropped`,
      indexes: unusedIndexes.map((stat: any) => stat.indexname)
    });
  }

  const inefficientIndexes = indexStats.filter((stat: any) => {
    const efficiency = stat.idx_tup_read > 0 ? (stat.idx_tup_fetch / stat.idx_tup_read) * 100 : 0;
    return efficiency < 50 && parseInt(stat.idx_scan) > 0;
  });
  
  if (inefficientIndexes.length > 0) {
    recommendations.push({
      type: 'INDEX_OPTIMIZATION',
      description: `${inefficientIndexes.length} indexes have low efficiency`,
      indexes: inefficientIndexes.map((stat: any) => stat.indexname)
    });
  }

  return recommendations;
}

function generatePerformanceTimeline(results: any[]) {
  // Group results by time buckets (e.g., every 5 seconds)
  const bucketSize = 5000; // 5 seconds
  const timeline = new Map();
  
  for (const result of results) {
    const bucket = Math.floor(result.timestamp.getTime() / bucketSize) * bucketSize;
    
    if (!timeline.has(bucket)) {
      timeline.set(bucket, { times: [], errors: 0, total: 0 });
    }
    
    const bucketData = timeline.get(bucket);
    bucketData.total++;
    
    if (result.success) {
      bucketData.times.push(result.executionTime);
    } else {
      bucketData.errors++;
    }
  }
  
  return Array.from(timeline.entries()).map(([timestamp, data]) => ({
    timestamp: new Date(timestamp),
    averageTime: data.times.length > 0 ? data.times.reduce((sum: number, time: number) => sum + time, 0) / data.times.length : 0,
    p95Time: data.times.length > 0 ? [...data.times].sort((a, b) => a - b)[Math.floor(data.times.length * 0.95)] || 0 : 0,
    errorRate: (data.errors / data.total) * 100,
    throughput: data.total / (bucketSize / 1000)
  }));
}
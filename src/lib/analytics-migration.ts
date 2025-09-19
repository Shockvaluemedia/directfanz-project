/**
 * Migration utility for transitioning from original analytics to optimized versions
 *
 * This file provides:
 * 1. Performance comparison utilities
 * 2. Gradual migration strategy
 * 3. A/B testing capabilities
 * 4. Validation functions
 */

import { OptimizedAnalytics } from './analytics-optimized';
import * as OriginalAnalytics from './analytics';

// Performance monitoring utilities
interface PerformanceResult {
  functionName: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  improvementPercentage: number;
  dataMatches: boolean;
  originalResult?: any;
  optimizedResult?: any;
}

/**
 * Compare performance between original and optimized analytics functions
 */
export async function compareAnalyticsPerformance(artistId: string): Promise<PerformanceResult[]> {
  const results: PerformanceResult[] = [];

  // Test calculateEarningsData
  const earningsComparison = await compareFunction(
    'calculateEarningsData',
    () => OriginalAnalytics.calculateEarningsData(artistId),
    () => OptimizedAnalytics.calculateEarningsData(artistId),
    compareEarningsData
  );
  results.push(earningsComparison);

  // Test calculateSubscriberMetrics
  const subscriberComparison = await compareFunction(
    'calculateSubscriberMetrics',
    () => OriginalAnalytics.calculateSubscriberMetrics(artistId),
    () => OptimizedAnalytics.calculateSubscriberMetrics(artistId),
    compareSubscriberMetrics
  );
  results.push(subscriberComparison);

  // Test calculateTierAnalytics
  const tierComparison = await compareFunction(
    'calculateTierAnalytics',
    () => OriginalAnalytics.calculateTierAnalytics(artistId),
    () => OptimizedAnalytics.calculateTierAnalytics(artistId),
    compareTierAnalytics
  );
  results.push(tierComparison);

  // Test getRecentActivity
  const activityComparison = await compareFunction(
    'getRecentActivity',
    () => OriginalAnalytics.getRecentActivity(artistId),
    () => OptimizedAnalytics.getRecentActivity(artistId),
    compareRecentActivity
  );
  results.push(activityComparison);

  // Test getDailyEarningsSummary
  const dailyEarningsComparison = await compareFunction(
    'getDailyEarningsSummary',
    () => OriginalAnalytics.getDailyEarningsSummary(artistId),
    () => OptimizedAnalytics.getDailyEarningsSummary(artistId),
    compareDailyEarnings
  );
  results.push(dailyEarningsComparison);

  return results;
}

/**
 * Generic function comparison utility
 */
async function compareFunction<T>(
  functionName: string,
  originalFunction: () => Promise<T>,
  optimizedFunction: () => Promise<T>,
  dataComparator: (original: T, optimized: T) => boolean
): Promise<PerformanceResult> {
  // Test original function
  const originalStart = performance.now();
  const originalResult = await originalFunction();
  const originalEnd = performance.now();
  const originalTime = originalEnd - originalStart;

  // Test optimized function
  const optimizedStart = performance.now();
  const optimizedResult = await optimizedFunction();
  const optimizedEnd = performance.now();
  const optimizedTime = optimizedEnd - optimizedStart;

  // Calculate improvement
  const improvement = originalTime - optimizedTime;
  const improvementPercentage = (improvement / originalTime) * 100;

  // Validate data consistency
  const dataMatches = dataComparator(originalResult, optimizedResult);

  return {
    functionName,
    originalTime,
    optimizedTime,
    improvement,
    improvementPercentage,
    dataMatches,
    originalResult,
    optimizedResult,
  };
}

/**
 * Data comparison functions
 */
function compareEarningsData(original: any, optimized: any): boolean {
  const tolerance = 0.01; // Allow small floating-point differences

  return (
    Math.abs(original.totalEarnings - optimized.totalEarnings) < tolerance &&
    Math.abs(original.monthlyEarnings - optimized.monthlyEarnings) < tolerance &&
    Math.abs(original.dailyEarnings - optimized.dailyEarnings) < tolerance &&
    Math.abs(original.weeklyEarnings - optimized.weeklyEarnings) < tolerance &&
    Math.abs(original.yearlyEarnings - optimized.yearlyEarnings) < tolerance &&
    Math.abs(original.earningsGrowth - optimized.earningsGrowth) < tolerance
  );
}

function compareSubscriberMetrics(original: any, optimized: any): boolean {
  return (
    original.totalSubscribers === optimized.totalSubscribers &&
    original.activeSubscribers === optimized.activeSubscribers &&
    original.newSubscribers === optimized.newSubscribers &&
    original.canceledSubscribers === optimized.canceledSubscribers &&
    Math.abs(original.churnRate - optimized.churnRate) < 0.01 &&
    Math.abs(original.retentionRate - optimized.retentionRate) < 0.01
  );
}

function compareTierAnalytics(original: any[], optimized: any[]): boolean {
  if (original.length !== optimized.length) return false;

  for (let i = 0; i < original.length; i++) {
    const orig = original[i];
    const opt = optimized[i];

    if (
      orig.tierId !== opt.tierId ||
      orig.tierName !== opt.tierName ||
      orig.subscriberCount !== opt.subscriberCount ||
      Math.abs(orig.monthlyRevenue - opt.monthlyRevenue) > 0.01 ||
      Math.abs(orig.averageAmount - opt.averageAmount) > 0.01
    ) {
      return false;
    }
  }
  return true;
}

function compareRecentActivity(original: any[], optimized: any[]): boolean {
  // Activities might have slightly different ordering due to union queries
  // So we'll compare by content rather than exact order
  if (original.length !== optimized.length) return false;

  const originalIds = original.map(a => a.id).sort();
  const optimizedIds = optimized.map(a => a.id).sort();

  return JSON.stringify(originalIds) === JSON.stringify(optimizedIds);
}

function compareDailyEarnings(original: any, optimized: any): boolean {
  const tolerance = 0.01;

  return (
    Math.abs(original.today - optimized.today) < tolerance &&
    Math.abs(original.yesterday - optimized.yesterday) < tolerance &&
    Math.abs(original.thisWeek - optimized.thisWeek) < tolerance &&
    Math.abs(original.thisMonth - optimized.thisMonth) < tolerance &&
    Math.abs(original.dailyAverage - optimized.dailyAverage) < tolerance &&
    original.trend === optimized.trend
  );
}

/**
 * Gradual Migration Strategy
 */
export class AnalyticsMigration {
  private useOptimized: Map<string, boolean> = new Map();

  constructor(
    private config: {
      rolloutPercentage: number; // 0-100
      enabledFunctions: string[];
      artistWhitelist?: string[];
    }
  ) {}

  /**
   * Determines whether to use optimized version for a specific function and artist
   */
  shouldUseOptimized(functionName: string, artistId: string): boolean {
    // Check if function is enabled for optimization
    if (!this.config.enabledFunctions.includes(functionName)) {
      return false;
    }

    // Check whitelist
    if (this.config.artistWhitelist && !this.config.artistWhitelist.includes(artistId)) {
      return false;
    }

    // Check rollout percentage (deterministic based on artistId)
    const hash = this.hashString(artistId + functionName);
    const percentage = hash % 100;

    return percentage < this.config.rolloutPercentage;
  }

  /**
   * Wrapper function that chooses between original and optimized versions
   */
  async executeEarningsData(artistId: string) {
    if (this.shouldUseOptimized('calculateEarningsData', artistId)) {
      return OptimizedAnalytics.calculateEarningsData(artistId);
    } else {
      return OriginalAnalytics.calculateEarningsData(artistId);
    }
  }

  async executeSubscriberMetrics(artistId: string) {
    if (this.shouldUseOptimized('calculateSubscriberMetrics', artistId)) {
      return OptimizedAnalytics.calculateSubscriberMetrics(artistId);
    } else {
      return OriginalAnalytics.calculateSubscriberMetrics(artistId);
    }
  }

  async executeTierAnalytics(artistId: string) {
    if (this.shouldUseOptimized('calculateTierAnalytics', artistId)) {
      return OptimizedAnalytics.calculateTierAnalytics(artistId);
    } else {
      return OriginalAnalytics.calculateTierAnalytics(artistId);
    }
  }

  async executeRecentActivity(artistId: string, limit?: number) {
    if (this.shouldUseOptimized('getRecentActivity', artistId)) {
      return OptimizedAnalytics.getRecentActivity(artistId, limit);
    } else {
      return OriginalAnalytics.getRecentActivity(artistId, limit);
    }
  }

  async executeArtistAnalytics(artistId: string) {
    if (this.shouldUseOptimized('getArtistAnalytics', artistId)) {
      return OptimizedAnalytics.getArtistAnalytics(artistId);
    } else {
      return OriginalAnalytics.getArtistAnalytics(artistId);
    }
  }

  async executeDailyEarningsSummary(artistId: string) {
    if (this.shouldUseOptimized('getDailyEarningsSummary', artistId)) {
      return OptimizedAnalytics.getDailyEarningsSummary(artistId);
    } else {
      return OriginalAnalytics.getDailyEarningsSummary(artistId);
    }
  }

  async executeSubscriberCountPerTier(artistId: string) {
    if (this.shouldUseOptimized('getSubscriberCountPerTier', artistId)) {
      return OptimizedAnalytics.getSubscriberCountPerTier(artistId);
    } else {
      return OriginalAnalytics.getSubscriberCountPerTier(artistId);
    }
  }

  async executeChurnAnalysis(artistId: string) {
    if (this.shouldUseOptimized('getChurnAnalysis', artistId)) {
      return OptimizedAnalytics.getChurnAnalysis(artistId);
    } else {
      return OriginalAnalytics.getChurnAnalysis(artistId);
    }
  }

  /**
   * Simple hash function for deterministic rollout
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Pre-configured migration instances for different rollout strategies
 */

// Conservative rollout - 10% of traffic, core functions only
export const conservativeRollout = new AnalyticsMigration({
  rolloutPercentage: 10,
  enabledFunctions: [
    'calculateEarningsData',
    'calculateSubscriberMetrics',
    'getDailyEarningsSummary',
  ],
});

// Aggressive rollout - 50% of traffic, all functions
export const aggressiveRollout = new AnalyticsMigration({
  rolloutPercentage: 50,
  enabledFunctions: [
    'calculateEarningsData',
    'calculateSubscriberMetrics',
    'calculateTierAnalytics',
    'getRecentActivity',
    'getArtistAnalytics',
    'getDailyEarningsSummary',
    'getSubscriberCountPerTier',
    'getChurnAnalysis',
  ],
});

// Full rollout - 100% of traffic
export const fullRollout = new AnalyticsMigration({
  rolloutPercentage: 100,
  enabledFunctions: [
    'calculateEarningsData',
    'calculateSubscriberMetrics',
    'calculateTierAnalytics',
    'getRecentActivity',
    'getArtistAnalytics',
    'getDailyEarningsSummary',
    'getSubscriberCountPerTier',
    'getChurnAnalysis',
  ],
});

/**
 * Performance monitoring and alerting
 */
export async function monitorPerformanceImprovement(artistId: string): Promise<{
  success: boolean;
  averageImprovement: number;
  failedComparisons: string[];
  performanceReport: PerformanceResult[];
}> {
  const results = await compareAnalyticsPerformance(artistId);

  const failedComparisons = results.filter(r => !r.dataMatches).map(r => r.functionName);

  const validResults = results.filter(r => r.dataMatches);
  const averageImprovement =
    validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.improvementPercentage, 0) / validResults.length
      : 0;

  return {
    success: failedComparisons.length === 0,
    averageImprovement,
    failedComparisons,
    performanceReport: results,
  };
}

/**
 * Utility to generate performance report
 */
export function generatePerformanceReport(results: PerformanceResult[]): string {
  let report = '\n=== ANALYTICS OPTIMIZATION PERFORMANCE REPORT ===\n\n';

  results.forEach(result => {
    report += `Function: ${result.functionName}\n`;
    report += `  Original Time: ${result.originalTime.toFixed(2)}ms\n`;
    report += `  Optimized Time: ${result.optimizedTime.toFixed(2)}ms\n`;
    report += `  Improvement: ${result.improvement.toFixed(2)}ms (${result.improvementPercentage.toFixed(1)}%)\n`;
    report += `  Data Matches: ${result.dataMatches ? '✅' : '❌'}\n\n`;
  });

  const validResults = results.filter(r => r.dataMatches);
  if (validResults.length > 0) {
    const avgImprovement =
      validResults.reduce((sum, r) => sum + r.improvementPercentage, 0) / validResults.length;
    report += `Average Performance Improvement: ${avgImprovement.toFixed(1)}%\n`;
    report += `Functions with Data Consistency: ${validResults.length}/${results.length}\n`;
  }

  report += '\n=== END REPORT ===\n';
  return report;
}

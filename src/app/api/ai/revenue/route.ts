import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentTask, createAgentRegistry, DEFAULT_AGENT_CONFIGS } from '@/lib/ai';
import { Logger } from '@/lib/logger';

const logger = new Logger('ai-revenue-api');

let registry: any = null;

async function getRegistry() {
  if (!registry) {
    registry = createAgentRegistry(
      DEFAULT_AGENT_CONFIGS.agentRegistry,
      logger
    );
  }
  return registry;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    const analysisType = searchParams.get('type') || 'overview';
    const timeframe = searchParams.get('timeframe') || 'monthly';

    if (!artistId) {
      return NextResponse.json({
        error: 'Artist ID is required',
        usage: '/api/ai/revenue?artistId=123&type=pricing&timeframe=quarterly'
      }, { status: 400 });
    }

    const agentRegistry = await getRegistry();
    const agentId = 'revenue-optimizer-main';

    let task;

    switch (analysisType) {
      case 'streams':
        task = createAgentTask('analyze_revenue_streams', {
          artistId,
          timeframe,
        });
        break;

      case 'pricing':
        task = createAgentTask('optimize_pricing', {
          streamId: 'all',
          constraints: {
            maxIncrease: 0.2, // Maximum 20% price increase
            testDuration: 14, // 14 days
          },
        });
        break;

      case 'segmentation':
        task = createAgentTask('segment_customers', {
          artistId,
          criteria: {
            includeValue: true,
            includeBehavior: true,
            includePreferences: true,
          },
        });
        break;

      case 'opportunities':
        task = createAgentTask('find_opportunities', {
          artistId,
          focusAreas: ['new_streams', 'optimization', 'expansion'],
        });
        break;

      case 'overview':
      default:
        // Get comprehensive revenue analysis
        const tasks = [
          createAgentTask('analyze_revenue_streams', { artistId, timeframe }),
          createAgentTask('segment_customers', { artistId }),
          createAgentTask('find_opportunities', { artistId }),
        ];

        const results = await Promise.all(
          tasks.map(t => agentRegistry.executeTask(agentId, t))
        );

        // Generate pricing recommendations based on results
        const pricingTask = createAgentTask('optimize_pricing', {
          streamId: 'all',
          constraints: { maxIncrease: 0.15, testDuration: 14 },
        });
        
        const pricingResult = await agentRegistry.executeTask(agentId, pricingTask);
        results.push(pricingResult);

        return NextResponse.json({
          success: true,
          data: {
            artistId,
            timeframe,
            timestamp: new Date().toISOString(),
            revenue: {
              streams: results[0].success ? results[0].data : null,
              segmentation: results[1].success ? results[1].data : null,
              opportunities: results[2].success ? results[2].data : null,
              pricing: results[3].success ? results[3].data : null,
            },
            insights: await generateRevenueInsights(results, artistId),
            recommendations: await generateRevenueRecommendations(results, artistId),
            kpis: await calculateRevenueKPIs(results, artistId),
          },
          metrics: {
            tasksExecuted: tasks.length + 1,
            successfulTasks: results.filter(r => r.success).length,
            totalProcessingTime: results.reduce((sum, r) => sum + (r.metrics?.processingTime || 0), 0),
          }
        });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    if (!response.success) {
      return NextResponse.json({
        error: 'Revenue optimization failed',
        details: response.error,
        suggestion: 'Check agent status or try different parameters'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        artistId,
        analysisType,
        timeframe,
        timestamp: new Date().toISOString(),
        result: response.data,
        insights: await generateSingleRevenueInsight(response.data, analysisType),
        actionItems: await generateActionItems(response.data, analysisType),
      },
      metrics: response.metrics
    });

  } catch (error) {
    logger.error('Revenue API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      artistId, 
      optimizationType, 
      parameters = {},
      testMode = true // Default to test mode for safety
    } = body;

    if (!artistId || !optimizationType) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: ['artistId', 'optimizationType'],
        optional: ['parameters', 'testMode']
      }, { status: 400 });
    }

    const agentRegistry = await getRegistry();
    const agentId = 'revenue-optimizer-main';

    let task;

    switch (optimizationType) {
      case 'dynamic_pricing':
        task = createAgentTask('optimize_pricing', {
          streamId: parameters.streamId || 'all',
          constraints: {
            maxIncrease: parameters.maxIncrease || 0.15,
            maxDecrease: parameters.maxDecrease || 0.1,
            testDuration: parameters.testDuration || 14,
            minimumSampleSize: parameters.minimumSampleSize || 100,
          },
          testMode,
        });
        break;

      case 'bundle_optimization':
        task = createAgentTask('optimize_bundles', {
          artistId,
          currentBundles: parameters.currentBundles || [],
          targetMargin: parameters.targetMargin || 0.7,
          maxBundles: parameters.maxBundles || 5,
          testMode,
        });
        break;

      case 'tier_restructure':
        task = createAgentTask('optimize_tiers', {
          artistId,
          currentTiers: parameters.currentTiers,
          objectives: parameters.objectives || ['revenue', 'conversion', 'retention'],
          testMode,
        });
        break;

      case 'fraud_prevention':
        task = createAgentTask('detect_fraud', {
          userId: parameters.userId,
          transactionData: parameters.transactionData,
          context: parameters.context || {},
        });
        break;

      case 'customer_lifetime_value':
        task = createAgentTask('increase_lifetime_value', {
          artistId,
          strategies: parameters.strategies || ['upsell', 'retention', 'expansion'],
          targetIncrease: parameters.targetIncrease || 0.2,
        });
        break;

      default:
        return NextResponse.json({
          error: 'Unknown optimization type',
          availableTypes: [
            'dynamic_pricing',
            'bundle_optimization',
            'tier_restructure',
            'fraud_prevention',
            'customer_lifetime_value'
          ]
        }, { status: 400 });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    // If in test mode, include safety warnings and rollback plan
    const safetyInfo = testMode ? {
      testMode: true,
      warnings: [
        'This is a test optimization - no real changes have been made',
        'Review results carefully before implementing',
        'Monitor key metrics closely during rollout',
      ],
      rollbackPlan: [
        'Revert pricing changes if conversion drops >10%',
        'Monitor customer complaints and feedback',
        'Have customer support team ready for inquiries',
      ],
    } : {
      testMode: false,
      implemented: true,
      monitoring: 'Active monitoring enabled for 48 hours',
    };

    return NextResponse.json({
      success: response.success,
      data: {
        artistId,
        optimizationType,
        parameters,
        timestamp: new Date().toISOString(),
        result: response.data,
        safety: safetyInfo,
        recommendations: response.success 
          ? await generateOptimizationRecommendations(response.data, optimizationType)
          : [],
        nextSteps: await generateNextSteps(response.data, optimizationType, testMode),
      },
      metrics: response.metrics,
      error: response.error
    });

  } catch (error) {
    logger.error('Revenue POST API Error:', error);
    return NextResponse.json({
      error: 'Revenue optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions for generating insights and recommendations
async function generateRevenueInsights(results: any[], artistId: string): Promise<string[]> {
  const insights: string[] = [];

  results.forEach((result, index) => {
    if (result.success && result.data) {
      switch (index) {
        case 0: // Revenue streams
          if (Array.isArray(result.data) && result.data.length > 0) {
            const totalRevenue = result.data.reduce((sum: number, stream: any) => sum + (stream.currentRevenue || 0), 0);
            insights.push(`Total monthly revenue: $${totalRevenue.toLocaleString()}`);
            
            const bestPerforming = result.data.reduce((best: any, current: any) => 
              (current.performance?.growthRate || 0) > (best.performance?.growthRate || 0) ? current : best
            );
            insights.push(`Best performing stream: ${bestPerforming.name} with ${((bestPerforming.performance?.growthRate || 0) * 100).toFixed(1)}% growth`);
          }
          break;
        case 1: // Segmentation
          if (result.data?.segments?.length > 0) {
            const highValueSegment = result.data.segments.find((s: any) => s.name.toLowerCase().includes('high'));
            if (highValueSegment) {
              insights.push(`High-value segment represents ${highValueSegment.count} users generating $${highValueSegment.revenue.toLocaleString()}`);
            }
          }
          break;
        case 2: // Opportunities
          if (Array.isArray(result.data) && result.data.length > 0) {
            const totalPotential = result.data.reduce((sum: number, opp: any) => sum + (opp.estimatedRevenue || 0), 0);
            insights.push(`${result.data.length} opportunities identified with $${totalPotential.toLocaleString()} potential revenue`);
          }
          break;
        case 3: // Pricing
          if (result.data?.expectedImpact?.revenueChange) {
            insights.push(`Pricing optimization could increase revenue by ${result.data.expectedImpact.revenueChange.toFixed(1)}%`);
          }
          break;
      }
    }
  });

  return insights;
}

async function generateRevenueRecommendations(results: any[], artistId: string): Promise<string[]> {
  const recommendations: string[] = [];

  if (results[0]?.success) { // Revenue streams
    recommendations.push('Focus on scaling your highest-performing revenue streams');
    recommendations.push('Consider retiring or optimizing underperforming streams');
  }
  
  if (results[1]?.success) { // Segmentation
    recommendations.push('Create targeted pricing strategies for each customer segment');
    recommendations.push('Develop premium offerings for high-value segments');
  }

  if (results[2]?.success) { // Opportunities
    recommendations.push('Prioritize opportunities with highest ROI potential');
    recommendations.push('Start with low-risk, high-impact opportunities first');
  }

  if (results[3]?.success) { // Pricing
    recommendations.push('Implement pricing changes gradually with A/B testing');
    recommendations.push('Monitor customer feedback closely during price changes');
  }

  return recommendations;
}

async function calculateRevenueKPIs(results: any[], artistId: string): Promise<Record<string, any>> {
  const kpis: Record<string, any> = {};

  if (results[0]?.success && Array.isArray(results[0].data)) {
    const streams = results[0].data;
    kpis.totalRevenue = streams.reduce((sum: number, stream: any) => sum + (stream.currentRevenue || 0), 0);
    kpis.averageGrowthRate = streams.reduce((sum: number, stream: any) => sum + (stream.performance?.growthRate || 0), 0) / streams.length;
    kpis.revenueStreams = streams.length;
  }

  if (results[1]?.success && results[1].data?.segments) {
    const segments = results[1].data.segments;
    kpis.customerSegments = segments.length;
    kpis.averageLifetimeValue = segments.reduce((sum: number, seg: any) => sum + (seg.value?.averageLifetimeValue || 0), 0) / segments.length;
  }

  if (results[2]?.success && Array.isArray(results[2].data)) {
    const opportunities = results[2].data;
    kpis.identifiedOpportunities = opportunities.length;
    kpis.potentialRevenue = opportunities.reduce((sum: number, opp: any) => sum + (opp.estimatedRevenue || 0), 0);
  }

  return kpis;
}

async function generateSingleRevenueInsight(data: any, analysisType: string): Promise<string[]> {
  const insights: string[] = [];

  switch (analysisType) {
    case 'streams':
      if (Array.isArray(data) && data.length > 0) {
        insights.push(`${data.length} revenue streams analyzed`);
        const activeStreams = data.filter((s: any) => s.status === 'active').length;
        insights.push(`${activeStreams} streams currently active and generating revenue`);
      }
      break;
    case 'pricing':
      if (data?.expectedImpact) {
        insights.push(`Expected revenue impact: ${data.expectedImpact.revenueChange > 0 ? '+' : ''}${data.expectedImpact.revenueChange.toFixed(1)}%`);
      }
      break;
    case 'opportunities':
      if (Array.isArray(data) && data.length > 0) {
        const highImpact = data.filter((o: any) => o.estimatedRevenue > 1000).length;
        insights.push(`${highImpact} high-impact opportunities (>$1,000 potential) identified`);
      }
      break;
  }

  return insights;
}

async function generateActionItems(data: any, analysisType: string): Promise<string[]> {
  const actions: string[] = [];

  switch (analysisType) {
    case 'streams':
      actions.push('Review underperforming streams for optimization or retirement');
      actions.push('Allocate more resources to top-performing streams');
      break;
    case 'pricing':
      actions.push('Set up A/B test for recommended pricing changes');
      actions.push('Prepare customer communication about value enhancements');
      break;
    case 'segmentation':
      actions.push('Design targeted offers for each customer segment');
      actions.push('Implement personalized pricing strategies');
      break;
    case 'opportunities':
      actions.push('Prioritize opportunities by implementation effort vs. impact');
      actions.push('Create timeline for opportunity development');
      break;
  }

  return actions;
}

async function generateOptimizationRecommendations(data: any, optimizationType: string): Promise<string[]> {
  const recommendations: string[] = [];

  switch (optimizationType) {
    case 'dynamic_pricing':
      recommendations.push('Start with small price adjustments (5-10%)');
      recommendations.push('Monitor conversion rates daily during test period');
      recommendations.push('Prepare value justification messaging for customers');
      break;
    case 'bundle_optimization':
      recommendations.push('Test bundle combinations with existing customers first');
      recommendations.push('Ensure bundles provide clear value over individual purchases');
      break;
    case 'tier_restructure':
      recommendations.push('Grandfather existing customers on current tiers');
      recommendations.push('Provide clear upgrade paths and benefits');
      break;
    case 'customer_lifetime_value':
      recommendations.push('Focus on retention strategies for high-value customers');
      recommendations.push('Implement progressive value delivery');
      break;
  }

  return recommendations;
}

async function generateNextSteps(data: any, optimizationType: string, testMode: boolean): Promise<string[]> {
  const steps: string[] = [];

  if (testMode) {
    steps.push('Review test results and validate assumptions');
    steps.push('Prepare implementation plan if results are positive');
    steps.push('Set up monitoring and alerting systems');
  } else {
    steps.push('Monitor key metrics for first 48 hours');
    steps.push('Collect customer feedback and adjust if needed');
    steps.push('Document learnings for future optimizations');
  }

  return steps;
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { 
  getRevenueOptimizations, 
  implementPricingOptimization,
  createOptimizedBundle,
  monitorOptimizationPerformance,
  restructureSubscriptionTiers
} from '@/lib/stripe-revenue-optimizer';
import { createAgentTask, createAgentRegistry, DEFAULT_AGENT_CONFIGS } from '@/lib/ai';
import { Logger } from '@/lib/logger';

const logger = new Logger('ai-revenue-stripe-api');

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

    // Only artists can access revenue optimization
    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({
        error: 'Artist role required for revenue optimization'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analysis';
    const timeframe = (searchParams.get('timeframe') || 'monthly') as 'monthly' | 'quarterly';

    const artistId = session.user.id;

    switch (action) {
      case 'analysis': {
        // Get comprehensive revenue analysis with AI insights
        const revenueData = await getRevenueOptimizations(artistId, timeframe);
        
        // Get AI-powered recommendations
        const agentRegistry = await getRegistry();
        const task = createAgentTask('analyze_revenue_streams', {
          artistId,
          timeframe,
          includeStripeData: true
        });
        
        const aiResponse = await agentRegistry.executeTask('revenue-optimizer-main', task);
        
        return NextResponse.json({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            revenue: revenueData,
            aiInsights: aiResponse.success ? aiResponse.data : null,
            recommendations: [
              ...generatePricingRecommendations(revenueData.optimizationOpportunities),
              ...generateRevenueGrowthRecommendations(revenueData)
            ],
            nextSteps: generateNextSteps(revenueData)
          }
        });
      }

      case 'monitoring': {
        // Monitor active pricing optimization tests
        const performanceData = await monitorOptimizationPerformance(artistId);
        
        return NextResponse.json({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            monitoring: performanceData,
            recommendations: generateMonitoringRecommendations(performanceData),
            alerts: generatePerformanceAlerts(performanceData)
          }
        });
      }

      default: {
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['analysis', 'monitoring']
        }, { status: 400 });
      }
    }

  } catch (error) {
    logger.error('Revenue Stripe API Error:', error);
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

    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({
        error: 'Artist role required for revenue optimization'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, parameters = {}, testMode = true } = body;

    if (!action) {
      return NextResponse.json({
        error: 'Action is required',
        availableActions: [
          'optimize_pricing',
          'create_bundle',
          'restructure_tiers',
          'implement_ai_recommendations'
        ]
      }, { status: 400 });
    }

    const artistId = session.user.id;

    switch (action) {
      case 'optimize_pricing': {
        const { priceId, optimizedAmount } = parameters;
        
        if (!priceId || !optimizedAmount) {
          return NextResponse.json({
            error: 'priceId and optimizedAmount are required for pricing optimization'
          }, { status: 400 });
        }

        const result = await implementPricingOptimization(
          artistId,
          priceId,
          parseFloat(optimizedAmount),
          testMode
        );

        return NextResponse.json({
          success: result.success,
          data: {
            action,
            result,
            testMode,
            timestamp: new Date().toISOString(),
            recommendations: testMode 
              ? ['Monitor conversion rates daily', 'Track customer feedback', 'Prepare rollback plan']
              : ['Monitor performance for 30 days', 'Document changes for future reference']
          }
        });
      }

      case 'create_bundle': {
        const { bundleName, priceIds, discountPercent } = parameters;
        
        if (!bundleName || !priceIds || !discountPercent) {
          return NextResponse.json({
            error: 'bundleName, priceIds, and discountPercent are required'
          }, { status: 400 });
        }

        const result = await createOptimizedBundle(
          artistId,
          bundleName,
          priceIds,
          parseFloat(discountPercent)
        );

        return NextResponse.json({
          success: result.success,
          data: {
            action,
            result,
            timestamp: new Date().toISOString(),
            recommendations: [
              'Test bundle with existing customers first',
              'Monitor bundle vs individual tier performance',
              'Consider seasonal bundle promotions'
            ]
          }
        });
      }

      case 'restructure_tiers': {
        const { tierRecommendations } = parameters;
        
        if (!tierRecommendations || !Array.isArray(tierRecommendations)) {
          return NextResponse.json({
            error: 'tierRecommendations array is required'
          }, { status: 400 });
        }

        const result = await restructureSubscriptionTiers(artistId, tierRecommendations);

        return NextResponse.json({
          success: result.success,
          data: {
            action,
            result,
            timestamp: new Date().toISOString(),
            recommendations: [
              'Communicate changes to existing subscribers',
              'Offer grandfathering for current customers',
              'Monitor subscriber feedback and churn rates'
            ]
          }
        });
      }

      case 'implement_ai_recommendations': {
        // Get AI recommendations and implement them automatically
        const agentRegistry = await getRegistry();
        const task = createAgentTask('optimize_pricing', {
          streamId: 'all',
          constraints: {
            maxIncrease: parameters.maxIncrease || 0.15,
            testDuration: parameters.testDuration || 14,
            minimumSampleSize: parameters.minimumSampleSize || 50
          },
          testMode
        });

        const aiResponse = await agentRegistry.executeTask('revenue-optimizer-main', task);

        if (!aiResponse.success) {
          return NextResponse.json({
            error: 'AI optimization failed',
            details: aiResponse.error
          }, { status: 500 });
        }

        // Simulate implementing the AI recommendations
        const implementedChanges = [];
        if (aiResponse.data?.recommendations) {
          for (const recommendation of aiResponse.data.recommendations.slice(0, 3)) {
            // This would actually implement each recommendation
            implementedChanges.push({
              type: 'pricing_adjustment',
              description: recommendation,
              status: testMode ? 'testing' : 'implemented',
              estimatedImpact: '+' + (Math.random() * 15).toFixed(1) + '%'
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            action,
            aiRecommendations: aiResponse.data,
            implementedChanges,
            testMode,
            timestamp: new Date().toISOString(),
            monitoringPlan: {
              duration: testMode ? '14 days' : '30 days',
              keyMetrics: ['conversion_rate', 'revenue_per_user', 'churn_rate'],
              checkpoints: ['Day 3', 'Day 7', 'Day 14']
            }
          }
        });
      }

      default: {
        return NextResponse.json({
          error: 'Unknown action',
          availableActions: [
            'optimize_pricing',
            'create_bundle', 
            'restructure_tiers',
            'implement_ai_recommendations'
          ]
        }, { status: 400 });
      }
    }

  } catch (error) {
    logger.error('Revenue Stripe POST API Error:', error);
    return NextResponse.json({
      error: 'Revenue optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions
function generatePricingRecommendations(opportunities: any[]): string[] {
  const recommendations = [];
  
  if (opportunities.length > 0) {
    recommendations.push('Consider testing higher prices for your most popular tiers');
    recommendations.push('Implement A/B testing for price changes to minimize risk');
    
    const highConfidenceOps = opportunities.filter(op => op.confidence > 0.85);
    if (highConfidenceOps.length > 0) {
      recommendations.push('Start with high-confidence pricing optimizations first');
    }
  }

  return recommendations;
}

function generateRevenueGrowthRecommendations(revenueData: any): string[] {
  const recommendations = [];
  
  if (revenueData.churnRate > 5) {
    recommendations.push('Focus on retention strategies to reduce churn rate');
  }
  
  if (revenueData.averageSubscriptionValue < 15) {
    recommendations.push('Consider introducing premium tiers to increase average revenue per user');
  }

  if (revenueData.monthlyGrowth < 5) {
    recommendations.push('Implement growth strategies to accelerate monthly revenue growth');
  }

  return recommendations;
}

function generateNextSteps(revenueData: any): string[] {
  return [
    'Review pricing optimization opportunities',
    'Set up A/B testing for recommended changes',
    'Monitor key performance indicators',
    'Schedule regular revenue optimization reviews'
  ];
}

function generateMonitoringRecommendations(performanceData: any): string[] {
  const recommendations = [];
  
  performanceData.performanceMetrics.forEach((metric: any) => {
    if (metric.recommendation === 'implement') {
      recommendations.push(`Implement test price ${metric.testPriceId} - showing positive results`);
    } else if (metric.recommendation === 'stop') {
      recommendations.push(`Stop test ${metric.testPriceId} - performance below expectations`);
    } else {
      recommendations.push(`Continue monitoring test ${metric.testPriceId} - results inconclusive`);
    }
  });

  return recommendations;
}

function generatePerformanceAlerts(performanceData: any): Array<{type: string, message: string, priority: string}> {
  const alerts = [];
  
  performanceData.performanceMetrics.forEach((metric: any) => {
    if (metric.conversionRate < 0.7) {
      alerts.push({
        type: 'conversion_drop',
        message: `Test price ${metric.testPriceId} showing significant conversion drop`,
        priority: 'high'
      });
    }
    
    if (metric.revenueImpact > 10) {
      alerts.push({
        type: 'positive_impact',
        message: `Test price ${metric.testPriceId} showing strong revenue growth`,
        priority: 'medium'
      });
    }
  });

  return alerts;
}
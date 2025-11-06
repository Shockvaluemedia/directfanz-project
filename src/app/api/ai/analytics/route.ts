import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentTask } from '@/lib/ai';
import { Logger } from '@/lib/logger';

const logger = new Logger('ai-analytics-api');

// Import the global registry function from the main AI route
import { createAgentRegistry, DEFAULT_AGENT_CONFIGS } from '@/lib/ai';

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
        usage: '/api/ai/analytics?artistId=123&type=revenue&timeframe=quarterly'
      }, { status: 400 });
    }

    const agentRegistry = await getRegistry();

    let task;
    let agentId = 'predictive-analytics-main';

    switch (analysisType) {
      case 'revenue':
        task = createAgentTask('forecast_revenue', {
          artistId,
          timeframe,
          includeSeasonality: true,
          includeTrends: true,
        });
        break;

      case 'churn':
        task = createAgentTask('analyze_churn', {
          artistId,
          timeframe,
          includeSegmentation: true,
          predictiveHorizon: 90,
        });
        break;

      case 'trends':
        task = createAgentTask('analyze_trends', {
          artistId,
          timeframe,
          includeCompetitors: true,
          includeMarketData: true,
        });
        break;

      case 'segmentation':
        task = createAgentTask('segment_users', {
          artistId,
          includePreferences: true,
          includeBehavior: true,
          includeValue: true,
        });
        break;

      case 'overview':
      default:
        // Get comprehensive analytics overview
        const tasks = [
          createAgentTask('forecast_revenue', { artistId, timeframe: 'monthly' }),
          createAgentTask('analyze_churn', { artistId, timeframe: 'monthly' }),
          createAgentTask('segment_users', { artistId }),
          createAgentTask('analyze_trends', { artistId, timeframe: 'weekly' }),
        ];

        const results = await Promise.all(
          tasks.map(t => agentRegistry.executeTask(agentId, t))
        );

        return NextResponse.json({
          success: true,
          data: {
            artistId,
            timeframe,
            timestamp: new Date().toISOString(),
            analytics: {
              revenue: results[0].success ? results[0].data : null,
              churn: results[1].success ? results[1].data : null,
              segmentation: results[2].success ? results[2].data : null,
              trends: results[3].success ? results[3].data : null,
            },
            insights: await generateInsights(results, artistId),
            recommendations: await generateRecommendations(results, artistId),
          },
          metrics: {
            tasksExecuted: tasks.length,
            successfulTasks: results.filter(r => r.success).length,
            totalProcessingTime: results.reduce((sum, r) => sum + (r.metrics?.processingTime || 0), 0),
          }
        });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    if (!response.success) {
      return NextResponse.json({
        error: 'Analytics generation failed',
        details: response.error,
        suggestion: 'Try with different parameters or check agent status'
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
        insights: await generateSingleInsight(response.data, analysisType),
      },
      metrics: response.metrics
    });

  } catch (error) {
    logger.error('Analytics API Error:', error);
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
      analysisType, 
      parameters = {},
      customMetrics = [] 
    } = body;

    if (!artistId || !analysisType) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: ['artistId', 'analysisType'],
        optional: ['parameters', 'customMetrics']
      }, { status: 400 });
    }

    const agentRegistry = await getRegistry();
    const agentId = 'predictive-analytics-main';

    let task;

    switch (analysisType) {
      case 'custom_forecast':
        task = createAgentTask('custom_analysis', {
          artistId,
          metrics: customMetrics,
          ...parameters,
        });
        break;

      case 'comparative_analysis':
        task = createAgentTask('compare_performance', {
          artistId,
          compareWith: parameters.compareWith || 'industry_average',
          metrics: customMetrics.length > 0 ? customMetrics : ['revenue', 'engagement', 'growth'],
          ...parameters,
        });
        break;

      case 'predictive_modeling':
        task = createAgentTask('create_model', {
          artistId,
          modelType: parameters.modelType || 'revenue_prediction',
          horizon: parameters.horizon || 90,
          confidence: parameters.confidence || 0.95,
          ...parameters,
        });
        break;

      case 'market_intelligence':
        task = createAgentTask('analyze_market', {
          artistId,
          includeCompetitors: parameters.includeCompetitors !== false,
          includeTrends: parameters.includeTrends !== false,
          includeOpportunities: parameters.includeOpportunities !== false,
          ...parameters,
        });
        break;

      default:
        return NextResponse.json({
          error: 'Unknown analysis type',
          availableTypes: [
            'custom_forecast',
            'comparative_analysis', 
            'predictive_modeling',
            'market_intelligence'
          ]
        }, { status: 400 });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    return NextResponse.json({
      success: response.success,
      data: {
        artistId,
        analysisType,
        parameters,
        timestamp: new Date().toISOString(),
        result: response.data,
        recommendations: response.success 
          ? await generateActionableRecommendations(response.data, analysisType)
          : [],
      },
      metrics: response.metrics,
      error: response.error
    });

  } catch (error) {
    logger.error('Analytics POST API Error:', error);
    return NextResponse.json({
      error: 'Analysis execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions for generating insights and recommendations
async function generateInsights(results: any[], artistId: string): Promise<string[]> {
  const insights: string[] = [];

  results.forEach((result, index) => {
    if (result.success && result.data) {
      switch (index) {
        case 0: // Revenue
          if (result.data.projectedGrowth > 0.1) {
            insights.push(`Revenue is projected to grow by ${(result.data.projectedGrowth * 100).toFixed(1)}% next period`);
          }
          break;
        case 1: // Churn
          if (result.data.riskLevel === 'high') {
            insights.push(`High churn risk detected - ${result.data.usersAtRisk} users may cancel soon`);
          }
          break;
        case 2: // Segmentation
          if (result.data.segments?.length > 0) {
            insights.push(`${result.data.segments.length} distinct user segments identified for targeted strategies`);
          }
          break;
        case 3: // Trends
          if (result.data.trending?.length > 0) {
            insights.push(`${result.data.trending.length} trending opportunities detected in your niche`);
          }
          break;
      }
    }
  });

  return insights;
}

async function generateRecommendations(results: any[], artistId: string): Promise<string[]> {
  const recommendations: string[] = [];

  // Generate actionable recommendations based on the analysis results
  if (results[0]?.success) { // Revenue
    recommendations.push('Consider implementing dynamic pricing based on demand patterns');
  }
  
  if (results[1]?.success) { // Churn
    recommendations.push('Deploy retention campaigns for high-risk user segments');
  }

  if (results[2]?.success) { // Segmentation
    recommendations.push('Create personalized content strategies for each user segment');
  }

  if (results[3]?.success) { // Trends
    recommendations.push('Align content calendar with trending topics and optimal timing');
  }

  return recommendations;
}

async function generateSingleInsight(data: any, analysisType: string): Promise<string[]> {
  const insights: string[] = [];

  switch (analysisType) {
    case 'revenue':
      if (data?.projectedRevenue) {
        insights.push(`Projected revenue for next period: $${data.projectedRevenue.toLocaleString()}`);
      }
      break;
    case 'churn':
      if (data?.churnRate) {
        insights.push(`Current churn rate: ${(data.churnRate * 100).toFixed(1)}%`);
      }
      break;
    case 'trends':
      if (data?.opportunities?.length > 0) {
        insights.push(`${data.opportunities.length} growth opportunities identified`);
      }
      break;
  }

  return insights;
}

async function generateActionableRecommendations(data: any, analysisType: string): Promise<string[]> {
  const recommendations: string[] = [];

  switch (analysisType) {
    case 'custom_forecast':
      recommendations.push('Monitor key metrics weekly to track forecast accuracy');
      recommendations.push('Adjust strategies based on confidence intervals');
      break;
    case 'comparative_analysis':
      recommendations.push('Focus on underperforming areas identified in comparison');
      recommendations.push('Leverage strengths to maximize competitive advantage');
      break;
    case 'predictive_modeling':
      recommendations.push('Use model predictions for strategic planning');
      recommendations.push('Regularly retrain model with new data');
      break;
    case 'market_intelligence':
      recommendations.push('Capitalize on identified market opportunities');
      recommendations.push('Monitor competitor activities for strategic insights');
      break;
  }

  return recommendations;
}
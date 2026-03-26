import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  createAgentRegistry, 
  AgentRegistry, 
  createAgentTask,
  DEFAULT_AGENT_CONFIGS 
} from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// Global AI Agent Registry instance
let globalRegistry: AgentRegistry | null = null;

async function getOrCreateRegistry(): Promise<AgentRegistry> {
  if (!globalRegistry) {
    const logger = new Logger('ai-api');
    globalRegistry = createAgentRegistry(
      DEFAULT_AGENT_CONFIGS.agentRegistry,
      logger
    );
    logger.info('AI Agent Registry initialized');
  }
  return globalRegistry;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow public access to basic agent info, but require auth for sensitive operations
    if (!session) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const registry = await getOrCreateRegistry();
    const stats = registry.getRegistryStats();
    const health = registry.getAgentHealth();
    
    // Convert Map to object for JSON serialization
    const healthData = health instanceof Map 
      ? Object.fromEntries(Array.from(health.entries()).map(([key, value]) => [
          key, 
          {
            id: value.id,
            type: value.type,
            status: value.status,
            performance: value.performance,
            lastActivity: value.lastActivity.toISOString(),
          }
        ]))
      : health;

    return apiSuccess({
      status: 'active',
      timestamp: new Date().toISOString(),
      registry: {
        stats,
        agents: healthData,
      },
      capabilities: {
        predictiveAnalytics: [
          'revenue_forecasting',
          'churn_analysis', 
          'trend_prediction',
          'user_segmentation',
          'market_intelligence'
        ],
        communityManagement: [
          'engagement_optimization',
          'event_planning',
          'sentiment_analysis',
          'loyalty_programs',
          'automated_campaigns'
        ],
        performanceOptimization: [
          'ab_testing',
          'conversion_optimization', 
          'pricing_optimization',
          'resource_allocation',
          'automated_decision_making'
        ],
        contentCuration: [
          'personalized_recommendations',
          'trend_analysis',
          'content_scoring',
          'strategy_creation',
          'audience_matching'
        ],
        revenueOptimization: [
          'pricing_strategies',
          'customer_segmentation',
          'monetization_opportunities',
          'fraud_detection',
          'lifetime_value_optimization'
        ],
        moderationSafety: [
          'content_moderation',
          'fraud_detection',
          'user_safety_analysis',
          'violation_detection',
          'automated_actions'
        ],
        adminOperations: [
          'system_monitoring',
          'resource_optimization',
          'financial_operations',
          'compliance_monitoring',
          'automated_remediation'
        ]
      }
    });

  } catch (error) {
    logger.error('AI API Error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const body = await request.json();
    const { 
      agent, 
      action, 
      payload = {}, 
      options = {} 
    } = body;

    if (!agent || !action) {
      return apiError('BAD_REQUEST', 'Missing required parameters',
        required: ['agent', 'action'],
        provided: { agent: !!agent, action: !!action });
    }

    const registry = await getOrCreateRegistry();
    
    // Create the task
    const task = createAgentTask(action, payload, options);
    
    // Execute the task
    const response = await registry.executeTask(agent, task);

    return apiSuccess({
      success: response.success,
      data: response.data,
      metrics: response.metrics,
      error: response.error,
      task: {
        id: task.id,
        type: task.type,
        executedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    logger.error('AI Task Execution Error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Task execution failed',
      message: error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only allow admin users to manage the registry
    if (!session || !session.user?.email) {
      return apiError('UNAUTHORIZED', 'Admin authentication required');
    }

    const body = await request.json();
    const { action, payload = {} } = body;

    const registry = await getOrCreateRegistry();

    switch (action) {
      case 'restart_registry':
        // In a production environment, you might want to implement proper restart logic
        globalRegistry = null; // Force recreation on next request
        return apiSuccess({ message: 'Registry restart initiated' });

      case 'execute_workflow':
        const { workflowType, artistId } = payload;
        
        let workflow;
        switch (workflowType) {
          case 'revenue_optimization':
            workflow = registry.createRevenueOptimizationWorkflow(artistId);
            break;
          case 'content_optimization':
            workflow = registry.createContentOptimizationWorkflow(artistId);
            break;
          default:
            return apiError('BAD_REQUEST', 'Unknown workflow type',
              availableWorkflows: ['revenue_optimization', 'content_optimization']);
        }

        const workflowResult = await registry.executeCoordinatedTask(workflow);
        
        return apiSuccess({ workflow: {
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
            results: Object.fromEntries(workflowResult.entries()),
          } });

      default:
        return apiError('BAD_REQUEST', 'Unknown action',
          availableActions: ['restart_registry', 'execute_workflow']);
    }

  } catch (error) {
    logger.error('AI Registry Management Error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Registry management failed',
      message: error instanceof Error ? error.message : 'Unknown error');
  }
}
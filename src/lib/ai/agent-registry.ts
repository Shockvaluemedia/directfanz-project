import { BaseAgent, AgentType, AgentTask, AgentResponse, AgentConfig } from './base-agent';
import { PredictiveAnalyticsAgent, PredictiveAnalyticsConfig } from './agents/predictive-analytics-agent';
import { CommunityManagementAgent, CommunityManagementConfig } from './agents/community-management-agent';
import { PerformanceOptimizerAgent, PerformanceOptimizerConfig } from './agents/performance-optimizer-agent';
import { ContentCurationAgent, ContentCurationConfig } from './agents/content-curation-agent';
import { RevenueOptimizationAgent, RevenueOptimizationConfig } from './agents/revenue-optimization-agent';
import { Logger } from '@/lib/logger';
import type { Database } from '@/lib/database/types';

export interface AgentRegistration {
  id: string;
  type: AgentType;
  agent: BaseAgent;
  config: AgentConfig;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastActivity: Date;
  performance: AgentPerformance;
  dependencies: string[];
}

export interface AgentPerformance {
  tasksCompleted: number;
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  lastError?: string;
  uptime: number; // percentage
}

export interface CoordinationTask {
  id: string;
  name: string;
  description: string;
  requiredAgents: AgentType[];
  workflow: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startTime?: Date;
  endTime?: Date;
  results: Map<string, any>;
}

export interface WorkflowStep {
  stepId: string;
  agentType: AgentType;
  taskType: string;
  dependencies: string[]; // step IDs this step depends on
  payload: Record<string, any>;
  timeout: number; // seconds
  retryCount: number;
  onSuccess?: WorkflowAction[];
  onFailure?: WorkflowAction[];
}

export interface WorkflowAction {
  type: 'trigger_task' | 'send_notification' | 'store_result' | 'conditional_branch';
  parameters: Record<string, any>;
}

export interface AgentCoordination {
  taskId: string;
  collaboratingAgents: AgentType[];
  dataSharing: DataSharingRule[];
  sequencing: SequencingRule[];
  errorHandling: ErrorHandlingRule[];
}

export interface DataSharingRule {
  fromAgent: AgentType;
  toAgent: AgentType;
  dataType: string;
  transformations?: DataTransformation[];
}

export interface DataTransformation {
  type: 'map' | 'filter' | 'aggregate' | 'format';
  operation: Record<string, any>;
}

export interface SequencingRule {
  prerequisiteAgent: AgentType;
  dependentAgent: AgentType;
  condition?: string;
  waitForCompletion: boolean;
}

export interface ErrorHandlingRule {
  agentType: AgentType;
  errorType: string;
  action: 'retry' | 'skip' | 'fallback' | 'escalate';
  parameters: Record<string, any>;
}

export interface AgentRegistryConfig {
  maxConcurrentTasks: number;
  taskTimeout: number; // seconds
  enableHealthMonitoring: boolean;
  healthCheckInterval: number; // seconds
  enablePerformanceTracking: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableCoordination: boolean;
  autoRetryFailedTasks: boolean;
  maxRetryAttempts: number;
  enableLoadBalancing: boolean;
}

export class AgentRegistry {
  private readonly agents: Map<string, AgentRegistration> = new Map();
  private readonly coordinationTasks: Map<string, CoordinationTask> = new Map();
  private readonly config: AgentRegistryConfig;
  private readonly logger: Logger;
  private readonly db?: Database;
  private healthCheckInterval?: NodeJS.Timeout;
  private performanceTracker?: NodeJS.Timeout;

  constructor(
    config: AgentRegistryConfig,
    logger: Logger,
    db?: Database
  ) {
    this.config = config;
    this.logger = logger;
    this.db = db;

    if (config.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    if (config.enablePerformanceTracking) {
      this.startPerformanceTracking();
    }
  }

  // Register a new agent
  public registerAgent<T extends BaseAgent>(
    id: string,
    agentClass: new (id: string, config: any, logger?: Logger, db?: Database) => T,
    config: AgentConfig,
    dependencies: string[] = []
  ): T {
    try {
      // Create agent instance
      const agent = new agentClass(id, config, this.logger, this.db);

      // Create registration
      const registration: AgentRegistration = {
        id,
        type: agent.getType(),
        agent,
        config,
        status: 'active',
        lastActivity: new Date(),
        performance: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          errorCount: 0,
          uptime: 100,
        },
        dependencies,
      };

      // Register the agent
      this.agents.set(id, registration);

      this.logger.info(`Agent registered: ${id} (${agent.getType()})`);
      return agent;

    } catch (error) {
      this.logger.error(`Failed to register agent ${id}:`, error);
      throw error;
    }
  }

  // Get a registered agent by ID
  public getAgent<T extends BaseAgent>(id: string): T | null {
    const registration = this.agents.get(id);
    return registration ? (registration.agent as T) : null;
  }

  // Get all agents of a specific type
  public getAgentsByType<T extends BaseAgent>(type: AgentType): T[] {
    const agents: T[] = [];
    for (const registration of this.agents.values()) {
      if (registration.type === type && registration.status === 'active') {
        agents.push(registration.agent as T);
      }
    }
    return agents;
  }

  // Execute a task on a specific agent
  public async executeTask(
    agentId: string,
    task: AgentTask
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const registration = this.agents.get(agentId);

    if (!registration) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (registration.status !== 'active') {
      throw new Error(`Agent ${agentId} is not active (status: ${registration.status})`);
    }

    try {
      // Execute the task
      const response = await Promise.race([
        registration.agent.executeTask(task),
        this.createTimeoutPromise(this.config.taskTimeout),
      ]);

      // Update performance metrics
      this.updatePerformanceMetrics(registration, startTime, true);
      registration.lastActivity = new Date();

      return response;

    } catch (error) {
      // Update performance metrics for failure
      this.updatePerformanceMetrics(registration, startTime, false);
      registration.performance.errorCount++;
      registration.performance.lastError = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Task execution failed for agent ${agentId}:`, error);
      
      // Retry if enabled
      if (this.config.autoRetryFailedTasks && task.retryCount < this.config.maxRetryAttempts) {
        task.retryCount++;
        this.logger.info(`Retrying task for agent ${agentId} (attempt ${task.retryCount})`);
        return this.executeTask(agentId, task);
      }

      throw error;
    }
  }

  // Execute a coordinated task involving multiple agents
  public async executeCoordinatedTask(coordinationTask: CoordinationTask): Promise<Map<string, any>> {
    this.logger.info(`Starting coordinated task: ${coordinationTask.name}`);
    
    coordinationTask.status = 'running';
    coordinationTask.startTime = new Date();
    this.coordinationTasks.set(coordinationTask.id, coordinationTask);

    try {
      const results = new Map<string, any>();
      const completedSteps = new Set<string>();
      const pendingSteps = [...coordinationTask.workflow];

      // Execute workflow steps
      while (pendingSteps.length > 0) {
        const readySteps = pendingSteps.filter(step => 
          step.dependencies.every(dep => completedSteps.has(dep))
        );

        if (readySteps.length === 0) {
          throw new Error('Circular dependency detected in workflow');
        }

        // Execute ready steps in parallel
        const stepPromises = readySteps.map(step => this.executeWorkflowStep(step, results));
        const stepResults = await Promise.all(stepPromises);

        // Update results and completed steps
        stepResults.forEach((result, index) => {
          const step = readySteps[index];
          results.set(step.stepId, result);
          completedSteps.add(step.stepId);
        });

        // Remove completed steps from pending
        readySteps.forEach(step => {
          const index = pendingSteps.indexOf(step);
          if (index > -1) {
            pendingSteps.splice(index, 1);
          }
        });
      }

      coordinationTask.status = 'completed';
      coordinationTask.endTime = new Date();
      coordinationTask.results = results;

      this.logger.info(`Coordinated task completed: ${coordinationTask.name}`);
      return results;

    } catch (error) {
      coordinationTask.status = 'failed';
      coordinationTask.endTime = new Date();
      
      this.logger.error(`Coordinated task failed: ${coordinationTask.name}`, error);
      throw error;
    }
  }

  // Create a coordination task for common workflows
  public createRevenueOptimizationWorkflow(artistId: string): CoordinationTask {
    return {
      id: `revenue_optimization_${artistId}_${Date.now()}`,
      name: 'Revenue Optimization Workflow',
      description: 'Comprehensive revenue optimization using multiple AI agents',
      requiredAgents: [
        AgentType.PREDICTIVE_ANALYTICS,
        AgentType.REVENUE_OPTIMIZER,
        AgentType.PERFORMANCE_OPTIMIZER,
        AgentType.CONTENT_CURATOR,
      ],
      workflow: [
        {
          stepId: 'analyze_performance',
          agentType: AgentType.PREDICTIVE_ANALYTICS,
          taskType: 'analyze_revenue_trends',
          dependencies: [],
          payload: { artistId, timeframe: '90_days' },
          timeout: 60,
          retryCount: 0,
        },
        {
          stepId: 'segment_customers',
          agentType: AgentType.REVENUE_OPTIMIZER,
          taskType: 'segment_customers',
          dependencies: [],
          payload: { artistId },
          timeout: 45,
          retryCount: 0,
        },
        {
          stepId: 'optimize_pricing',
          agentType: AgentType.REVENUE_OPTIMIZER,
          taskType: 'optimize_pricing',
          dependencies: ['analyze_performance', 'segment_customers'],
          payload: { artistId },
          timeout: 60,
          retryCount: 0,
        },
        {
          stepId: 'create_ab_tests',
          agentType: AgentType.PERFORMANCE_OPTIMIZER,
          taskType: 'create_ab_test',
          dependencies: ['optimize_pricing'],
          payload: { artistId, testType: 'pricing' },
          timeout: 30,
          retryCount: 0,
        },
        {
          stepId: 'curate_content',
          agentType: AgentType.CONTENT_CURATOR,
          taskType: 'create_strategy',
          dependencies: ['segment_customers'],
          payload: { artistId, goals: ['revenue_increase'] },
          timeout: 45,
          retryCount: 0,
        },
      ],
      status: 'pending',
      priority: 'high',
      results: new Map(),
    };
  }

  public createContentOptimizationWorkflow(artistId: string): CoordinationTask {
    return {
      id: `content_optimization_${artistId}_${Date.now()}`,
      name: 'Content Optimization Workflow',
      description: 'Optimize content strategy using AI insights',
      requiredAgents: [
        AgentType.CONTENT_CURATOR,
        AgentType.PREDICTIVE_ANALYTICS,
        AgentType.COMMUNITY_MANAGER,
        AgentType.PERFORMANCE_OPTIMIZER,
      ],
      workflow: [
        {
          stepId: 'analyze_trends',
          agentType: AgentType.CONTENT_CURATOR,
          taskType: 'analyze_trends',
          dependencies: [],
          payload: { category: 'all', timeframe: 'medium' },
          timeout: 60,
          retryCount: 0,
        },
        {
          stepId: 'predict_engagement',
          agentType: AgentType.PREDICTIVE_ANALYTICS,
          taskType: 'predict_content_performance',
          dependencies: [],
          payload: { artistId },
          timeout: 45,
          retryCount: 0,
        },
        {
          stepId: 'analyze_audience',
          agentType: AgentType.COMMUNITY_MANAGER,
          taskType: 'analyze_audience_sentiment',
          dependencies: [],
          payload: { artistId },
          timeout: 30,
          retryCount: 0,
        },
        {
          stepId: 'create_strategy',
          agentType: AgentType.CONTENT_CURATOR,
          taskType: 'create_strategy',
          dependencies: ['analyze_trends', 'predict_engagement', 'analyze_audience'],
          payload: { artistId, goals: ['engagement_increase'] },
          timeout: 60,
          retryCount: 0,
        },
        {
          stepId: 'setup_tests',
          agentType: AgentType.PERFORMANCE_OPTIMIZER,
          taskType: 'create_ab_test',
          dependencies: ['create_strategy'],
          payload: { artistId, testType: 'content' },
          timeout: 30,
          retryCount: 0,
        },
      ],
      status: 'pending',
      priority: 'medium',
      results: new Map(),
    };
  }

  // Get agent status and health information
  public getAgentHealth(agentId?: string): Map<string, AgentRegistration> | AgentRegistration | null {
    if (agentId) {
      return this.agents.get(agentId) || null;
    }
    return new Map(this.agents);
  }

  // Get registry statistics
  public getRegistryStats() {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'active').length;
    const totalTasks = Array.from(this.agents.values()).reduce((sum, a) => sum + a.performance.tasksCompleted, 0);
    const averageUptime = Array.from(this.agents.values()).reduce((sum, a) => sum + a.performance.uptime, 0) / totalAgents;

    return {
      totalAgents,
      activeAgents,
      inactiveAgents: totalAgents - activeAgents,
      totalTasks,
      averageUptime,
      coordinationTasks: this.coordinationTasks.size,
    };
  }

  // Shutdown the registry and all agents
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Agent Registry...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.performanceTracker) {
      clearInterval(this.performanceTracker);
    }

    // Shutdown all agents
    for (const registration of this.agents.values()) {
      try {
        if ('shutdown' in registration.agent && typeof registration.agent.shutdown === 'function') {
          await registration.agent.shutdown();
        }
        registration.status = 'inactive';
      } catch (error) {
        this.logger.error(`Error shutting down agent ${registration.id}:`, error);
      }
    }

    this.logger.info('Agent Registry shutdown complete');
  }

  // Private helper methods
  private async executeWorkflowStep(step: WorkflowStep, context: Map<string, any>): Promise<any> {
    // Find an agent of the required type
    const agents = this.getAgentsByType(step.agentType);
    if (agents.length === 0) {
      throw new Error(`No active agent found for type: ${step.agentType}`);
    }

    // Use load balancing if enabled
    const agent = this.config.enableLoadBalancing 
      ? this.selectLeastLoadedAgent(agents)
      : agents[0];

    // Create task with context data
    const task: AgentTask = {
      id: `${step.stepId}_${Date.now()}`,
      type: step.taskType,
      payload: { ...step.payload, context: Object.fromEntries(context) },
      priority: 'medium',
      retryCount: step.retryCount,
      timeout: step.timeout * 1000, // Convert to milliseconds
    };

    // Execute the task
    return this.executeTask(agent.getId(), task);
  }

  private selectLeastLoadedAgent(agents: BaseAgent[]): BaseAgent {
    // Simple load balancing based on task count
    // In production, this could consider response times, queue sizes, etc.
    return agents.reduce((least, current) => {
      const leastRegistration = this.agents.get(least.getId());
      const currentRegistration = this.agents.get(current.getId());
      
      if (!leastRegistration || !currentRegistration) return least;
      
      return currentRegistration.performance.tasksCompleted < leastRegistration.performance.tasksCompleted
        ? current
        : least;
    });
  }

  private updatePerformanceMetrics(
    registration: AgentRegistration,
    startTime: number,
    success: boolean
  ): void {
    const responseTime = Date.now() - startTime;
    const perf = registration.performance;

    // Update task count
    perf.tasksCompleted++;

    // Update average response time
    perf.averageResponseTime = (perf.averageResponseTime * (perf.tasksCompleted - 1) + responseTime) / perf.tasksCompleted;

    // Update success rate
    const successfulTasks = Math.round(perf.successRate * (perf.tasksCompleted - 1)) + (success ? 1 : 0);
    perf.successRate = successfulTasks / perf.tasksCompleted;
  }

  private createTimeoutPromise<T>(timeoutSeconds: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${timeoutSeconds} seconds`)), timeoutSeconds * 1000);
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const registration of this.agents.values()) {
        try {
          // Check if agent is responsive
          if (registration.agent && 'healthCheck' in registration.agent) {
            const isHealthy = (registration.agent as any).healthCheck();
            if (!isHealthy && registration.status === 'active') {
              registration.status = 'error';
              this.logger.warn(`Agent ${registration.id} failed health check`);
            }
          }
        } catch (error) {
          registration.status = 'error';
          this.logger.error(`Health check failed for agent ${registration.id}:`, error);
        }
      }
    }, this.config.healthCheckInterval * 1000);
  }

  private startPerformanceTracking(): void {
    this.performanceTracker = setInterval(() => {
      // Calculate uptime and other performance metrics
      for (const registration of this.agents.values()) {
        // Simple uptime calculation based on status
        const uptime = registration.status === 'active' ? 100 : 0;
        registration.performance.uptime = (registration.performance.uptime * 0.9) + (uptime * 0.1); // Moving average
      }

      // Log performance summary
      if (this.config.logLevel === 'debug') {
        const stats = this.getRegistryStats();
        this.logger.debug('Registry Performance:', stats);
      }
    }, 60000); // Every minute
  }
}

// Factory function to create and configure all agents
export function createAgentRegistry(
  config: AgentRegistryConfig,
  logger: Logger,
  db?: Database
): AgentRegistry {
  const registry = new AgentRegistry(config, logger, db);

  // Register Predictive Analytics Agent
  const predictiveConfig: PredictiveAnalyticsConfig = {
    enableRevenueForecasting: true,
    enableChurnAnalysis: true,
    enableTrendAnalysis: true,
    enableCompetitorIntelligence: true,
    forecastHorizon: 90,
    confidence: 0.95,
    updateInterval: 24,
    enableRealTimeAnalysis: true,
    maxDataPoints: 10000,
  };

  registry.registerAgent(
    'predictive-analytics-main',
    PredictiveAnalyticsAgent,
    predictiveConfig
  );

  // Register Community Management Agent
  const communityConfig: CommunityManagementConfig = {
    enableSentimentAnalysis: true,
    enableEngagementOptimization: true,
    enableEventManagement: true,
    enableChallengeManagement: true,
    enableLoyaltyPrograms: true,
    responseTimeTarget: 300,
    sentimentThreshold: 0.7,
    engagementGoal: 0.15,
    maxConcurrentEvents: 5,
    enableRealTimeMonitoring: true,
    autoModerationEnabled: true,
  };

  registry.registerAgent(
    'community-manager-main',
    CommunityManagementAgent,
    communityConfig
  );

  // Register Performance Optimizer Agent
  const performanceConfig: PerformanceOptimizerConfig = {
    enableABTesting: true,
    enablePriceOptimization: true,
    enableContentOptimization: true,
    enableResourceOptimization: true,
    defaultTestDuration: 14,
    minimumSampleSize: 1000,
    confidenceLevel: 0.95,
    significanceThreshold: 0.05,
    maxConcurrentTests: 3,
    autoImplementWinners: false,
    rollbackThreshold: 0.1,
    optimizationInterval: 12,
    enableRealTimeOptimization: true,
    riskTolerance: 'medium',
  };

  registry.registerAgent(
    'performance-optimizer-main',
    PerformanceOptimizerAgent,
    performanceConfig
  );

  // Register Content Curation Agent
  const curationConfig: ContentCurationConfig = {
    enableAutoRecommendations: true,
    enableTrendAnalysis: true,
    enableContentScoring: true,
    enableAutoCuration: true,
    qualityThreshold: 0.7,
    engagementThreshold: 0.1,
    monetizationThreshold: 0.05,
    maxRecommendations: 20,
    updateInterval: 6,
    trendAnalysisDepth: 'advanced',
    personalizationLevel: 'high',
    contentFilteringStrength: 'moderate',
    enableRealTimeOptimization: true,
  };

  registry.registerAgent(
    'content-curator-main',
    ContentCurationAgent,
    curationConfig
  );

  // Register Revenue Optimization Agent
  const revenueConfig: RevenueOptimizationConfig = {
    enablePriceOptimization: true,
    enableSegmentationAnalysis: true,
    enableCompetitorTracking: true,
    enableDemandAnalysis: true,
    enableOpportunityDetection: true,
    priceTestingEnabled: true,
    optimizationInterval: 8,
    minConfidenceLevel: 0.9,
    maxPriceChangePercent: 20,
    enableRealTimeOptimization: true,
    riskTolerance: 'moderate',
    focusAreas: ['pricing', 'conversion', 'retention'],
  };

  registry.registerAgent(
    'revenue-optimizer-main',
    RevenueOptimizationAgent,
    revenueConfig
  );

  logger.info('All AI agents registered successfully');
  return registry;
}
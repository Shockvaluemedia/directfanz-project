// Core AI Agent System
export { BaseAgent, AgentType, AgentStatus, type AgentConfig, type AgentContext, type AgentTask, type AgentResponse, type AgentMetrics } from './base-agent';

// Orchestrator and Event Management
export { AIOrchestrator, type OrchestratorConfig, type OrchestratorMetrics, type LoadBalancingStrategy } from './orchestrator';
export { EventBus, type AgentEvent, type EventBusConfig, type EventBusMetrics, type EventHandler } from './event-bus';

// Individual AI Agents
export { ConversationalAgent, type ConversationalAgentConfig, type ConversationContext, type ConversationMessage, type UserProfile, type ArtistPersonality, type EscalationReason } from './agents/conversational-agent';
export { ContentModerationAgent, type ContentModerationConfig, type ModerationResult, type ModerationViolation, type ModerationAction, type ComplianceStatus, type RiskScore, ViolationType } from './agents/content-moderation-agent';
export { RecommendationAgent, type RecommendationAgentConfig, type RecommendationContext, type RecommendationResult, type RecommendationItem, type CrossPromotionSuggestion } from './agents/recommendation-agent';
export { CommunityManagementAgent, type CommunityManagementConfig, type CommunityEvent, type FanChallenge, type LoyaltyProgram, type SentimentAnalysis, type CommunityInsight } from './agents/community-management-agent';

// Advanced Analytics and Optimization Agents
export { PredictiveAnalyticsAgent, type PredictiveAnalyticsConfig, type RevenueForcast, type ChurnAnalysis, type TrendAnalysis, type ContentPerformancePrediction, type MarketAnalysis, type UserSegmentation } from './agents/predictive-analytics-agent';
export { PerformanceOptimizerAgent, type PerformanceOptimizerConfig, type ABTest, type TestVariant, type TestResults, type PriceOptimization, type ContentStrategy, type ResourceAllocation } from './agents/performance-optimizer-agent';
export { ContentCurationAgent, type ContentCurationConfig, type ContentItem, type ContentRecommendation, type ContentCuration, type QualityScore, type AudienceProfile } from './agents/content-curation-agent';
export { RevenueOptimizationAgent, type RevenueOptimizationConfig, type RevenueStream, type PricingStrategy, type MonetizationOpportunity, type CustomerSegmentation, type PricingModel } from './agents/revenue-optimization-agent';

// Safety and Operations Agents
export { ModerationSafetyAgent, type ModerationSafetyConfig, type FraudDetection, type UserSafetyProfile, ActionType } from './agents/moderation-safety-agent';
export { AdminOperationsAgent, type AdminOperationsConfig, type SystemHealth, type ResourceOptimization, type UserManagement, type FinancialOperations, type ComplianceMonitoring } from './agents/admin-operations-agent';

// Agent Registry and Coordination
export { AgentRegistry, createAgentRegistry, type AgentRegistration, type AgentPerformance, type CoordinationTask, type WorkflowStep, type AgentRegistryConfig } from './agent-registry';

// Demo and Utilities
export { demoAIAgents } from './demo-ai-agents';

// AI Agent System Factory
export class AIAgentSystem {
  private orchestrator?: AIOrchestrator;
  private eventBus?: EventBus;
  private agents: Map<string, BaseAgent> = new Map();

  // Initialize the AI agent system
  public async initialize(config: {
    orchestratorConfig?: Partial<import('./orchestrator').OrchestratorConfig>;
    eventBusConfig?: Partial<import('./event-bus').EventBusConfig>;
  } = {}): Promise<void> {
    // Create event bus
    this.eventBus = new EventBus(config.eventBusConfig);
    
    // Create orchestrator
    this.orchestrator = new AIOrchestrator(
      config.orchestratorConfig,
      this.eventBus
    );

    // Wait for initialization
    await new Promise<void>((resolve) => {
      this.orchestrator!.once('initialized', () => resolve());
    });
  }

  // Add a new agent to the system
  public async addAgent<T extends BaseAgent>(
    agent: T,
    config: AgentConfig
  ): Promise<T> {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    await this.orchestrator.registerAgent(agent, config);
    this.agents.set(agent.getId(), agent);
    
    return agent;
  }

  // Remove an agent from the system
  public async removeAgent(agentId: string): Promise<boolean> {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    try {
      await this.orchestrator.unregisterAgent(agentId);
      this.agents.delete(agentId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Execute a task using the orchestrator
  public async executeTask(task: AgentTask): Promise<AgentResponse> {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    return this.orchestrator.distributeTask(task);
  }

  // Get system health
  public getSystemHealth(): any {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    return this.orchestrator.getSystemHealth();
  }

  // Get system metrics
  public getMetrics(): any {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    return this.orchestrator.getMetrics();
  }

  // Get all registered agents
  public getAgents(): Array<{
    id: string;
    type: AgentType;
    status: AgentStatus;
    capabilities: string[];
  }> {
    if (!this.orchestrator) {
      throw new Error('AI Agent System not initialized');
    }

    return this.orchestrator.getAgents();
  }

  // Get agent by ID
  public getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  // Publish event to event bus
  public async publishEvent(event: Omit<AgentEvent, 'id' | 'timestamp'>): Promise<string> {
    if (!this.eventBus) {
      throw new Error('AI Agent System not initialized');
    }

    return this.eventBus.publish(event);
  }

  // Subscribe to events
  public subscribeToEvents(
    eventType: string,
    handler: EventHandler,
    options?: {
      filter?: import('./event-bus').EventFilter;
      priority?: number;
    }
  ): string {
    if (!this.eventBus) {
      throw new Error('AI Agent System not initialized');
    }

    return this.eventBus.subscribe(eventType, handler, options);
  }

  // Unsubscribe from events
  public unsubscribeFromEvents(subscriptionId: string): boolean {
    if (!this.eventBus) {
      throw new Error('AI Agent System not initialized');
    }

    return this.eventBus.unsubscribe(subscriptionId);
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }

    if (this.eventBus) {
      await this.eventBus.shutdown();
    }

    this.agents.clear();
  }
}

// Convenience factory functions
export const createAIAgentSystem = () => new AIAgentSystem();

export const createConversationalAgent = (
  id: string,
  config: ConversationalAgentConfig
): ConversationalAgent => {
  return new ConversationalAgent(id, config);
};

export const createContentModerationAgent = (
  id: string,
  config: ContentModerationConfig
): ContentModerationAgent => {
  return new ContentModerationAgent(id, config);
};

export const createRecommendationAgent = (
  id: string,
  config: RecommendationAgentConfig
): RecommendationAgent => {
  return new RecommendationAgent(id, config);
};

export const createCommunityManagementAgent = (
  id: string,
  config: CommunityManagementConfig
): CommunityManagementAgent => {
  return new CommunityManagementAgent(id, config);
};

export const createPredictiveAnalyticsAgent = (
  id: string,
  config: PredictiveAnalyticsConfig
): PredictiveAnalyticsAgent => {
  return new PredictiveAnalyticsAgent(id, config);
};

export const createPerformanceOptimizerAgent = (
  id: string,
  config: PerformanceOptimizerConfig
): PerformanceOptimizerAgent => {
  return new PerformanceOptimizerAgent(id, config);
};

export const createContentCurationAgent = (
  id: string,
  config: ContentCurationConfig
): ContentCurationAgent => {
  return new ContentCurationAgent(id, config);
};

export const createRevenueOptimizationAgent = (
  id: string,
  config: RevenueOptimizationConfig
): RevenueOptimizationAgent => {
  return new RevenueOptimizationAgent(id, config);
};

export const createModerationSafetyAgent = (
  id: string,
  config: ModerationSafetyConfig
): ModerationSafetyAgent => {
  return new ModerationSafetyAgent(id, config);
};

export const createAdminOperationsAgent = (
  id: string,
  config: AdminOperationsConfig
): AdminOperationsAgent => {
  return new AdminOperationsAgent(id, config);
};

// Default configurations and factory functions
export const DEFAULT_AGENT_CONFIGS = {
  orchestrator: {
    maxConcurrentTasks: 100,
    taskTimeout: 300000,
    healthCheckInterval: 30000,
    autoRestart: true,
    enableMetrics: true,
    logLevel: 'info' as const,
  },
  
  eventBus: {
    maxEventHistory: 1000,
    maxQueueSize: 10000,
    processingTimeout: 30000,
    enablePersistence: false,
    logLevel: 'info' as const,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  conversationalAgent: {
    model: 'gpt-3.5-turbo',
    maxTokens: 200,
    temperature: 0.7,
    responseTimeout: 30000,
    maxConversationLength: 50,
    autoEscalateAfter: 60,
    supportedLanguages: ['en'],
    moderationEnabled: true,
    learningEnabled: true,
  },
  
  contentModerationAgent: {
    strictnessLevel: 'moderate' as const,
    enableImageScanning: true,
    enableVideoScanning: true,
    enableTextScanning: true,
    enableAudioScanning: false,
    autoRejectThreshold: 0.8,
    humanReviewThreshold: 0.6,
    appealEnabled: true,
    maxProcessingTime: 30000,
    enableLearning: true,
    customPolicies: [],
  },
  
  recommendationAgent: {
    enablePersonalization: true,
    enableCollaborativeFiltering: true,
    enableContentBasedFiltering: true,
    enableTrendingBoost: true,
    enableSocialSignals: true,
    enableSerendipity: false,
    diversityWeight: 0.3,
    freshnessWeight: 0.2,
    qualityThreshold: 0.5,
    maxRecommendations: 50,
    minConfidenceScore: 0.3,
    enableCrossPromotion: true,
    enableRealTimeUpdates: true,
    cacheDuration: 3600000, // 1 hour
    fallbackStrategy: 'popular' as const,
  },
  
  communityManagementAgent: {
    enableEventPlanning: true,
    enableChallenges: true,
    enableLoyaltyPrograms: true,
    enableSentimentMonitoring: true,
    enableAutoModeration: true,
    enableEngagementBoosts: true,
    maxEventsPerMonth: 10,
    maxActiveChallenges: 5,
    sentimentCheckInterval: 86400000, // 24 hours
    engagementThreshold: 0.1,
    autoResponseEnabled: true,
    communityGuidelines: [
      'Be respectful to all community members',
      'No spam or self-promotion',
      'Keep content appropriate and on-topic',
      'Support and encourage fellow fans',
    ],
  },
  
  predictiveAnalyticsAgent: {
    enableRevenueForecasting: true,
    enableChurnAnalysis: true,
    enableTrendAnalysis: true,
    enableCompetitorIntelligence: true,
    forecastHorizon: 90,
    confidence: 0.95,
    updateInterval: 24,
    enableRealTimeAnalysis: true,
    maxDataPoints: 10000,
  },
  
  performanceOptimizerAgent: {
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
    riskTolerance: 'medium' as const,
  },
  
  contentCurationAgent: {
    enableAutoRecommendations: true,
    enableTrendAnalysis: true,
    enableContentScoring: true,
    enableAutoCuration: true,
    qualityThreshold: 0.7,
    engagementThreshold: 0.1,
    monetizationThreshold: 0.05,
    maxRecommendations: 20,
    updateInterval: 6,
    trendAnalysisDepth: 'advanced' as const,
    personalizationLevel: 'high' as const,
    contentFilteringStrength: 'moderate' as const,
    enableRealTimeOptimization: true,
  },
  
  revenueOptimizationAgent: {
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
    riskTolerance: 'moderate' as const,
    focusAreas: ['pricing', 'conversion', 'retention'] as const,
  },
  
  agentRegistry: {
    maxConcurrentTasks: 10,
    taskTimeout: 300,
    enableHealthMonitoring: true,
    healthCheckInterval: 30,
    enablePerformanceTracking: true,
    logLevel: 'info' as const,
    enableCoordination: true,
    autoRetryFailedTasks: true,
    maxRetryAttempts: 3,
    enableLoadBalancing: true,
  },
  
  moderationSafetyAgent: {
    enableContentModeration: true,
    enableFraudDetection: true,
    enableUserSafety: true,
    enableRealTimeScanning: true,
    strictnessLevel: 'moderate' as const,
    autoActionThreshold: 0.8,
    humanReviewThreshold: 0.6,
    maxProcessingTime: 30,
    enableAppealProcess: true,
    enableUserReporting: true,
    fraudDetectionSensitivity: 'medium' as const,
    retainModerationLogs: true,
    logRetentionDays: 90,
  },
  
  adminOperationsAgent: {
    enableSystemMonitoring: true,
    enableResourceOptimization: true,
    enableUserManagement: true,
    enableFinancialOperations: true,
    enableComplianceMonitoring: true,
    monitoringInterval: 60,
    alertThresholds: {
      responseTime: 1000,
      errorRate: 0.05,
      cpuUsage: 0.8,
      memoryUsage: 0.8,
      diskUsage: 0.9,
      budgetVariance: 0.15,
    },
    autoRemediation: true,
    costOptimizationEnabled: true,
    maxAutomatedActions: 5,
    enablePredictiveAnalytics: true,
    retainLogsFor: 365,
  },
};

// Task creation helper function
export const createAgentTask = (
  type: string,
  payload: any = {},
  options: {
    priority?: number;
    timeout?: number;
    retries?: number;
    metadata?: Record<string, any>;
  } = {}
): AgentTask => {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    type,
    payload,
    priority: options.priority || 1,
    timeout: options.timeout || 30000,
    retries: options.retries || 0,
    metadata: options.metadata || {},
    createdAt: Date.now(),
    status: 'pending' as const,
  };
};

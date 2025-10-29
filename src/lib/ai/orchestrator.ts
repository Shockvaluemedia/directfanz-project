import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { BaseAgent, AgentType, AgentStatus, AgentTask, AgentResponse, AgentConfig } from './base-agent';
import { EventBus } from './event-bus';
import type { Database } from '@/lib/database/types';

export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  healthCheckInterval: number;
  autoRestart: boolean;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface AgentRegistry {
  [agentId: string]: {
    agent: BaseAgent;
    config: AgentConfig;
    lastHealthCheck: Date;
    status: AgentStatus;
    metrics: any;
  };
}

export interface TaskDistribution {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: number;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-loaded' | 'random' | 'capability-based';
  weights?: Record<string, number>;
}

export interface OrchestratorMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  activeAgents: number;
  queuedTasks: number;
  systemLoad: number;
  uptime: number;
}

// Central AI Orchestrator manages all AI agents
export class AIOrchestrator extends EventEmitter {
  private readonly config: OrchestratorConfig;
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly agents: AgentRegistry = {};
  private readonly pendingTasks: Map<string, AgentTask> = new Map();
  private readonly taskDistributions: TaskDistribution[] = [];
  private readonly metrics: OrchestratorMetrics;
  private readonly db?: Database;
  
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private loadBalancingStrategy: LoadBalancingStrategy = { type: 'least-loaded' };

  constructor(
    config: Partial<OrchestratorConfig> = {},
    eventBus?: EventBus,
    db?: Database
  ) {
    super();

    this.config = {
      maxConcurrentTasks: 100,
      taskTimeout: 300000, // 5 minutes
      healthCheckInterval: 30000, // 30 seconds
      autoRestart: true,
      enableMetrics: true,
      logLevel: 'info',
      ...config,
    };

    this.logger = new Logger('AIOrchestrator', { level: this.config.logLevel });
    this.eventBus = eventBus || new EventBus();
    this.db = db;

    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      activeAgents: 0,
      queuedTasks: 0,
      systemLoad: 0,
      uptime: Date.now(),
    };

    this.initialize();
  }

  // Initialize the orchestrator
  private async initialize(): Promise<void> {
    try {
      // Set up event listeners
      this.setupEventListeners();

      // Start health monitoring
      this.startHealthMonitoring();

      this.logger.info('AI Orchestrator initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize AI Orchestrator:', error);
      this.emit('error', error);
    }
  }

  // Register a new agent
  public async registerAgent(agent: BaseAgent, config: AgentConfig): Promise<void> {
    const agentId = agent.getId();

    if (this.agents[agentId]) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    // Set up agent event listeners
    agent.on('task-completed', (event) => {
      this.handleTaskCompletion(agentId, event);
    });

    agent.on('task-failed', (event) => {
      this.handleTaskFailure(agentId, event);
    });

    agent.on('error', (event) => {
      this.handleAgentError(agentId, event);
    });

    // Register the agent
    this.agents[agentId] = {
      agent,
      config,
      lastHealthCheck: new Date(),
      status: agent.getStatus(),
      metrics: agent.getMetrics(),
    };

    this.updateMetrics();
    this.logger.info(`Agent ${agentId} (${agent.getType()}) registered successfully`);
    this.emit('agent-registered', { agentId, type: agent.getType() });
  }

  // Unregister an agent
  public async unregisterAgent(agentId: string): Promise<void> {
    const agentEntry = this.agents[agentId];
    if (!agentEntry) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    // Gracefully shutdown the agent
    await agentEntry.agent.shutdown();

    // Remove from registry
    delete this.agents[agentId];

    this.updateMetrics();
    this.logger.info(`Agent ${agentId} unregistered successfully`);
    this.emit('agent-unregistered', { agentId });
  }

  // Distribute a task to the most suitable agent
  public async distributeTask(task: AgentTask): Promise<AgentResponse> {
    if (this.isShuttingDown) {
      throw new Error('Orchestrator is shutting down');
    }

    this.metrics.totalTasks++;
    this.pendingTasks.set(task.id, task);

    try {
      // Find the best agent for this task
      const selectedAgent = this.selectAgent(task);
      if (!selectedAgent) {
        throw new Error(`No suitable agent found for task ${task.id}`);
      }

      // Create task distribution record
      const distribution: TaskDistribution = {
        taskId: task.id,
        agentId: selectedAgent.getId(),
        assignedAt: new Date(),
        priority: task.priority,
      };

      this.taskDistributions.push(distribution);
      this.logger.debug(`Task ${task.id} assigned to agent ${selectedAgent.getId()}`);

      // Execute the task
      const startTime = Date.now();
      const response = await selectedAgent.processTask(task);
      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateTaskMetrics(executionTime, response.success);

      // Clean up
      this.pendingTasks.delete(task.id);
      this.removeTaskDistribution(task.id);

      this.emit('task-distributed', { taskId: task.id, agentId: selectedAgent.getId(), response });
      return response;

    } catch (error) {
      this.metrics.failedTasks++;
      this.pendingTasks.delete(task.id);
      this.removeTaskDistribution(task.id);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Task ${task.id} distribution failed: ${errorMessage}`);

      return {
        success: false,
        error: {
          code: 'TASK_DISTRIBUTION_ERROR',
          message: errorMessage,
          details: error,
        },
        metrics: {
          processingTime: 0,
        },
      };
    }
  }

  // Select the best agent for a task based on load balancing strategy
  private selectAgent(task: AgentTask): BaseAgent | null {
    const availableAgents = Object.values(this.agents)
      .filter(entry => {
        const agent = entry.agent;
        const status = agent.getStatus();
        
        // Agent must be active or idle
        if (status !== AgentStatus.ACTIVE && status !== AgentStatus.IDLE) {
          return false;
        }

        // Agent must be able to handle this task type
        if (!agent.validateTask(task)) {
          return false;
        }

        return true;
      });

    if (availableAgents.length === 0) {
      return null;
    }

    switch (this.loadBalancingStrategy.type) {
      case 'least-loaded':
        return this.selectLeastLoadedAgent(availableAgents);
      
      case 'round-robin':
        return this.selectRoundRobinAgent(availableAgents);
      
      case 'capability-based':
        return this.selectCapabilityBasedAgent(availableAgents, task);
      
      case 'random':
      default:
        return availableAgents[Math.floor(Math.random() * availableAgents.length)].agent;
    }
  }

  // Select agent with lowest current load
  private selectLeastLoadedAgent(agents: typeof this.agents[string][]): BaseAgent {
    return agents.reduce((best, current) => {
      const bestMetrics = best.agent.getMetrics();
      const currentMetrics = current.agent.getMetrics();
      
      // Consider both queue size and error rate
      const bestLoad = bestMetrics.totalRequests - bestMetrics.successfulRequests + bestMetrics.errorRate * 10;
      const currentLoad = currentMetrics.totalRequests - currentMetrics.successfulRequests + currentMetrics.errorRate * 10;
      
      return currentLoad < bestLoad ? current : best;
    }).agent;
  }

  // Select agent using round-robin strategy
  private selectRoundRobinAgent(agents: typeof this.agents[string][]): BaseAgent {
    // Simple round-robin based on total tasks distributed
    const index = this.metrics.totalTasks % agents.length;
    return agents[index].agent;
  }

  // Select agent based on capabilities and task requirements
  private selectCapabilityBasedAgent(agents: typeof this.agents[string][], task: AgentTask): BaseAgent {
    // Score agents based on their capabilities for this specific task
    const scoredAgents = agents.map(agentEntry => {
      const capabilities = agentEntry.agent.getCapabilities();
      const metrics = agentEntry.agent.getMetrics();
      
      // Base score on capabilities match
      let score = capabilities.length > 0 ? 1 : 0;
      
      // Bonus for low error rate
      score += (1 - metrics.errorRate) * 0.5;
      
      // Bonus for fast response time
      if (metrics.averageResponseTime > 0) {
        score += Math.max(0, 1 - metrics.averageResponseTime / 10000) * 0.3;
      }
      
      return { agent: agentEntry.agent, score };
    });

    // Select the highest scoring agent
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  // Handle task completion
  private handleTaskCompletion(agentId: string, event: any): void {
    this.metrics.completedTasks++;
    this.updateAgentMetrics(agentId);
    this.logger.debug(`Task ${event.taskId} completed by agent ${agentId}`);
    this.emit('task-completed', { agentId, ...event });
  }

  // Handle task failure
  private handleTaskFailure(agentId: string, event: any): void {
    this.metrics.failedTasks++;
    this.updateAgentMetrics(agentId);
    this.logger.warn(`Task ${event.taskId} failed on agent ${agentId}: ${event.error?.message}`);
    this.emit('task-failed', { agentId, ...event });
  }

  // Handle agent errors
  private handleAgentError(agentId: string, event: any): void {
    this.logger.error(`Agent ${agentId} encountered an error:`, event.error);
    
    if (this.config.autoRestart) {
      this.restartAgent(agentId).catch(error => {
        this.logger.error(`Failed to restart agent ${agentId}:`, error);
      });
    }

    this.emit('agent-error', { agentId, ...event });
  }

  // Restart an agent
  private async restartAgent(agentId: string): Promise<void> {
    const agentEntry = this.agents[agentId];
    if (!agentEntry) {
      return;
    }

    this.logger.info(`Restarting agent ${agentId}`);
    
    try {
      await agentEntry.agent.reset();
      agentEntry.status = agentEntry.agent.getStatus();
      this.logger.info(`Agent ${agentId} restarted successfully`);
    } catch (error) {
      this.logger.error(`Failed to restart agent ${agentId}:`, error);
    }
  }

  // Set up event listeners
  private setupEventListeners(): void {
    this.eventBus.on('system-shutdown', () => {
      this.shutdown();
    });

    this.eventBus.on('agent-health-check', (data) => {
      this.performHealthCheck(data.agentId);
    });
  }

  // Start health monitoring
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performSystemHealthCheck();
    }, this.config.healthCheckInterval);
  }

  // Perform system health check
  private async performSystemHealthCheck(): Promise<void> {
    const agentIds = Object.keys(this.agents);
    
    for (const agentId of agentIds) {
      await this.performHealthCheck(agentId);
    }

    this.updateSystemMetrics();
    this.emit('health-check-completed', this.getSystemHealth());
  }

  // Perform health check on specific agent
  private async performHealthCheck(agentId: string): Promise<void> {
    const agentEntry = this.agents[agentId];
    if (!agentEntry) {
      return;
    }

    try {
      const health = await agentEntry.agent.healthCheck();
      agentEntry.lastHealthCheck = new Date();
      agentEntry.status = health.status;
      agentEntry.metrics = health.metrics;

      if (!health.healthy && this.config.autoRestart) {
        await this.restartAgent(agentId);
      }
    } catch (error) {
      this.logger.error(`Health check failed for agent ${agentId}:`, error);
      
      if (this.config.autoRestart) {
        await this.restartAgent(agentId);
      }
    }
  }

  // Update task metrics
  private updateTaskMetrics(executionTime: number, success: boolean): void {
    const totalCompletedTasks = this.metrics.completedTasks + this.metrics.failedTasks;
    
    if (totalCompletedTasks > 0) {
      this.metrics.averageTaskTime = 
        (this.metrics.averageTaskTime * (totalCompletedTasks - 1) + executionTime) / totalCompletedTasks;
    }
  }

  // Update agent metrics
  private updateAgentMetrics(agentId: string): void {
    const agentEntry = this.agents[agentId];
    if (agentEntry) {
      agentEntry.metrics = agentEntry.agent.getMetrics();
    }
  }

  // Update system metrics
  private updateSystemMetrics(): void {
    this.metrics.activeAgents = Object.values(this.agents)
      .filter(entry => entry.status === AgentStatus.ACTIVE || entry.status === AgentStatus.IDLE)
      .length;

    this.metrics.queuedTasks = this.pendingTasks.size;
    this.metrics.systemLoad = this.calculateSystemLoad();
  }

  // Calculate system load
  private calculateSystemLoad(): number {
    const totalAgents = Object.keys(this.agents).length;
    if (totalAgents === 0) return 0;

    const processingAgents = Object.values(this.agents)
      .filter(entry => entry.status === AgentStatus.PROCESSING)
      .length;

    return (processingAgents / totalAgents) * 100;
  }

  // Remove task distribution record
  private removeTaskDistribution(taskId: string): void {
    const index = this.taskDistributions.findIndex(dist => dist.taskId === taskId);
    if (index >= 0) {
      this.taskDistributions.splice(index, 1);
    }
  }

  // Update general metrics
  private updateMetrics(): void {
    this.metrics.activeAgents = Object.keys(this.agents).length;
  }

  // Get system health report
  public getSystemHealth(): {
    healthy: boolean;
    agents: Array<{
      id: string;
      type: string;
      status: AgentStatus;
      healthy: boolean;
      lastHealthCheck: Date;
    }>;
    metrics: OrchestratorMetrics;
  } {
    const agents = Object.entries(this.agents).map(([id, entry]) => ({
      id,
      type: entry.agent.getType(),
      status: entry.status,
      healthy: entry.status === AgentStatus.ACTIVE || entry.status === AgentStatus.IDLE,
      lastHealthCheck: entry.lastHealthCheck,
    }));

    const healthyAgents = agents.filter(agent => agent.healthy).length;
    const isSystemHealthy = healthyAgents > 0 && healthyAgents / agents.length >= 0.5;

    return {
      healthy: isSystemHealthy,
      agents,
      metrics: { ...this.metrics },
    };
  }

  // Set load balancing strategy
  public setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy;
    this.logger.info(`Load balancing strategy set to: ${strategy.type}`);
  }

  // Get orchestrator metrics
  public getMetrics(): OrchestratorMetrics {
    return { ...this.metrics };
  }

  // Get all registered agents
  public getAgents(): Array<{
    id: string;
    type: AgentType;
    status: AgentStatus;
    capabilities: string[];
    metrics: any;
  }> {
    return Object.entries(this.agents).map(([id, entry]) => ({
      id,
      type: entry.agent.getType(),
      status: entry.status,
      capabilities: entry.agent.getCapabilities(),
      metrics: entry.metrics,
    }));
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info('Initiating orchestrator shutdown...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Wait for pending tasks to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.pendingTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Shutdown all agents
    const shutdownPromises = Object.values(this.agents).map(entry => 
      entry.agent.shutdown()
    );

    await Promise.allSettled(shutdownPromises);

    this.logger.info('AI Orchestrator shutdown completed');
    this.emit('shutdown');
  }
}
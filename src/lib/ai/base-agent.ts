import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import type { Database } from '@/lib/database/types';

// Base interfaces for all AI agents
export interface AgentConfig {
  name: string;
  version: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
  customParams?: Record<string, any>;
}

export interface AgentMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastExecutionTime?: Date;
  errorRate: number;
  uptime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    tokens: number;
  };
}

export interface AgentContext {
  userId?: string;
  artistId?: string;
  sessionId?: string;
  requestId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  context: AgentContext;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics: {
    processingTime: number;
    tokensUsed?: number;
    model?: string;
  };
  metadata?: Record<string, any>;
}

export enum AgentStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  PROCESSING = 'processing',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  SHUTDOWN = 'shutdown',
}

export enum AgentType {
  CONTENT_CREATOR = 'content_creator',
  PERSONALIZATION = 'personalization',
  VISUAL_CREATOR = 'visual_creator',
  CONVERSATIONAL = 'conversational',
  RECOMMENDATION = 'recommendation',
  COMMUNITY_MANAGEMENT = 'community_management',
  PREDICTIVE_ANALYTICS = 'predictive_analytics',
  PERFORMANCE_OPTIMIZER = 'performance_optimizer',
  INSIGHTS_GENERATOR = 'insights_generator',
  CONTENT_MODERATION = 'content_moderation',
  FRAUD_DETECTION = 'fraud_detection',
  SAFETY_MONITOR = 'safety_monitor',
  GROWTH_OPTIMIZER = 'growth_optimizer',
  CAMPAIGN_MANAGEMENT = 'campaign_management',
  SEO_OPTIMIZATION = 'seo_optimization',
  OPERATIONS_MANAGER = 'operations_manager',
  CUSTOMER_SUPPORT = 'customer_support',
  COMPLIANCE_MONITOR = 'compliance_monitor',
}

// Base agent class that all AI agents extend
export abstract class BaseAgent extends EventEmitter {
  protected readonly id: string;
  protected readonly type: AgentType;
  protected readonly config: AgentConfig;
  protected status: AgentStatus;
  protected metrics: AgentMetrics;
  protected logger: Logger;
  protected db?: Database;
  protected taskQueue: AgentTask[] = [];
  protected isProcessing = false;

  constructor(
    id: string,
    type: AgentType,
    config: AgentConfig,
    logger?: Logger,
    db?: Database
  ) {
    super();
    this.id = id;
    this.type = type;
    this.config = config;
    this.status = AgentStatus.INITIALIZING;
    this.logger = logger || new Logger(`Agent-${type}-${id}`);
    this.db = db;

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      uptime: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        tokens: 0,
      },
    };

    this.initialize();
  }

  // Abstract methods that must be implemented by subclasses
  abstract getCapabilities(): string[];
  abstract validateTask(task: AgentTask): boolean;
  abstract executeTask(task: AgentTask): Promise<AgentResponse>;

  // Initialize the agent
  protected async initialize(): Promise<void> {
    try {
      this.status = AgentStatus.INITIALIZING;
      await this.setup();
      this.status = AgentStatus.ACTIVE;
      this.emit('initialized', { id: this.id, type: this.type });
      this.logger.info(`Agent ${this.id} initialized successfully`);
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.logger.error(`Agent ${this.id} initialization failed:`, error);
      this.emit('error', { id: this.id, error });
    }
  }

  // Setup method for agent-specific initialization
  protected async setup(): Promise<void> {
    // Override in subclasses if needed
  }

  // Public API methods
  public getId(): string {
    return this.id;
  }

  public getType(): AgentType {
    return this.type;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  // Task management
  public async processTask(task: AgentTask): Promise<AgentResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validate the task
      if (!this.validateTask(task)) {
        throw new Error(`Invalid task for agent ${this.id}`);
      }

      // Check if agent is available
      if (this.status !== AgentStatus.ACTIVE && this.status !== AgentStatus.IDLE) {
        throw new Error(`Agent ${this.id} is not available (status: ${this.status})`);
      }

      this.status = AgentStatus.PROCESSING;
      this.emit('task-started', { id: this.id, taskId: task.id });

      // Execute the task
      const response = await this.executeTask(task);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      
      this.status = AgentStatus.IDLE;
      this.emit('task-completed', { id: this.id, taskId: task.id, response });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      this.status = AgentStatus.ERROR;

      const errorResponse: AgentResponse = {
        success: false,
        error: {
          code: 'TASK_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        metrics: {
          processingTime,
        },
      };

      this.emit('task-failed', { id: this.id, taskId: task.id, error });
      this.logger.error(`Task ${task.id} failed:`, error);

      return errorResponse;
    }
  }

  // Add task to queue
  public addTask(task: AgentTask): void {
    this.taskQueue.push(task);
    this.emit('task-queued', { id: this.id, taskId: task.id });
    this.processQueue();
  }

  // Process task queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      // Sort by priority and creation time
      this.taskQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const task = this.taskQueue.shift();
      if (task) {
        // Check if task has expired
        if (task.expiresAt && task.expiresAt < new Date()) {
          this.logger.warn(`Task ${task.id} expired, skipping`);
          continue;
        }

        await this.processTask(task);
      }
    }

    this.isProcessing = false;
  }

  // Update agent metrics
  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + processingTime) / totalRequests;

    // Update error rate
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;

    this.metrics.lastExecutionTime = new Date();
  }

  // Health check
  public async healthCheck(): Promise<{
    status: AgentStatus;
    healthy: boolean;
    metrics: AgentMetrics;
    lastSeen: Date;
  }> {
    return {
      status: this.status,
      healthy: this.status === AgentStatus.ACTIVE || this.status === AgentStatus.IDLE,
      metrics: this.getMetrics(),
      lastSeen: new Date(),
    };
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    this.status = AgentStatus.SHUTDOWN;
    
    // Wait for current tasks to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear task queue
    this.taskQueue = [];

    this.emit('shutdown', { id: this.id, type: this.type });
    this.logger.info(`Agent ${this.id} shutdown completed`);
  }

  // Reset agent state
  public async reset(): Promise<void> {
    await this.shutdown();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      uptime: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        tokens: 0,
      },
    };
    await this.initialize();
  }

  // Utility method for making API calls
  protected async makeApiCall<T>(
    endpoint: string,
    payload: any,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'POST',
      headers = {},
      timeout = this.config.timeout || 30000,
      retries = this.config.retryAttempts || 3,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: method !== 'GET' ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError!;
  }
}
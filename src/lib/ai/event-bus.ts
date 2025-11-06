import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';

export interface AgentEvent {
  id: string;
  type: string;
  source: string;
  target?: string | string[]; // specific agent(s) or broadcast if undefined
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ttl?: number; // time-to-live in milliseconds
  correlationId?: string; // for tracking related events
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  filter?: EventFilter;
  priority: number;
  subscribedAt: Date;
}

export interface EventFilter {
  source?: string | string[];
  priority?: string | string[];
  metadata?: Record<string, any>;
  customFilter?: (event: AgentEvent) => boolean;
}

export type EventHandler = (event: AgentEvent) => void | Promise<void>;

export interface EventBusMetrics {
  totalEvents: number;
  eventsPerType: Record<string, number>;
  activeSubscriptions: number;
  averageProcessingTime: number;
  droppedEvents: number;
  errorCount: number;
}

export interface EventBusConfig {
  maxEventHistory: number;
  maxQueueSize: number;
  processingTimeout: number;
  enablePersistence: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts: number;
  retryDelay: number;
}

// Event Bus for real-time communication between AI agents
export class EventBus extends EventEmitter {
  private readonly config: EventBusConfig;
  private readonly logger: Logger;
  private readonly subscriptions: Map<string, EventSubscription> = new Map();
  private readonly eventHistory: AgentEvent[] = [];
  private readonly eventQueue: AgentEvent[] = [];
  private readonly metrics: EventBusMetrics;
  
  private isProcessing = false;
  private subscriptionCounter = 0;

  constructor(config: Partial<EventBusConfig> = {}) {
    super();

    this.config = {
      maxEventHistory: 1000,
      maxQueueSize: 10000,
      processingTimeout: 30000,
      enablePersistence: false,
      logLevel: 'info',
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.logger = new Logger('EventBus', { level: this.config.logLevel });

    this.metrics = {
      totalEvents: 0,
      eventsPerType: {},
      activeSubscriptions: 0,
      averageProcessingTime: 0,
      droppedEvents: 0,
      errorCount: 0,
    };

    this.startProcessing();
  }

  // Publish an event
  public async publish(event: Omit<AgentEvent, 'id' | 'timestamp'>): Promise<string> {
    const fullEvent: AgentEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    // Check TTL
    if (fullEvent.ttl && fullEvent.ttl <= 0) {
      this.logger.debug(`Event ${fullEvent.id} dropped due to expired TTL`);
      this.metrics.droppedEvents++;
      return fullEvent.id;
    }

    // Check queue size
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.logger.warn(`Event queue full, dropping event ${fullEvent.id}`);
      this.metrics.droppedEvents++;
      return fullEvent.id;
    }

    // Add to queue
    this.eventQueue.push(fullEvent);
    
    // Update metrics
    this.metrics.totalEvents++;
    this.metrics.eventsPerType[fullEvent.type] = (this.metrics.eventsPerType[fullEvent.type] || 0) + 1;

    // Add to history
    this.addToHistory(fullEvent);

    this.logger.debug(`Event ${fullEvent.id} published: ${fullEvent.type}`);
    this.emit('event-published', fullEvent);

    return fullEvent.id;
  }

  // Subscribe to events
  public subscribe(
    eventType: string,
    handler: EventHandler,
    options: {
      filter?: EventFilter;
      priority?: number;
    } = {}
  ): string {
    const subscriptionId = `sub_${++this.subscriptionCounter}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      filter: options.filter,
      priority: options.priority || 0,
      subscribedAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.activeSubscriptions++;

    this.logger.debug(`Subscription ${subscriptionId} created for event type: ${eventType}`);
    this.emit('subscription-created', { subscriptionId, eventType });

    return subscriptionId;
  }

  // Unsubscribe from events
  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.subscriptions.delete(subscriptionId);
    this.metrics.activeSubscriptions--;

    this.logger.debug(`Subscription ${subscriptionId} removed`);
    this.emit('subscription-removed', { subscriptionId });

    return true;
  }

  // Subscribe to multiple event types
  public subscribeMany(
    eventTypes: string[],
    handler: EventHandler,
    options: {
      filter?: EventFilter;
      priority?: number;
    } = {}
  ): string[] {
    return eventTypes.map(eventType => 
      this.subscribe(eventType, handler, options)
    );
  }

  // Subscribe to all events from a specific source
  public subscribeToSource(
    source: string,
    handler: EventHandler,
    options: {
      eventTypes?: string[];
      priority?: number;
    } = {}
  ): string {
    const filter: EventFilter = {
      source: [source],
      customFilter: options.eventTypes 
        ? (event) => options.eventTypes!.includes(event.type)
        : undefined,
    };

    return this.subscribe('*', handler, {
      filter,
      priority: options.priority,
    });
  }

  // Get event history
  public getEventHistory(
    filter?: {
      eventType?: string;
      source?: string;
      since?: Date;
      limit?: number;
    }
  ): AgentEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.eventType) {
        events = events.filter(e => e.type === filter.eventType);
      }
      if (filter.source) {
        events = events.filter(e => e.source === filter.source);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events;
  }

  // Get metrics
  public getMetrics(): EventBusMetrics {
    return { ...this.metrics };
  }

  // Get active subscriptions
  public getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  // Start event processing
  private startProcessing(): void {
    setInterval(() => {
      this.processEventQueue();
    }, 10); // Process every 10ms
  }

  // Process event queue
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Sort events by priority and timestamp
      this.eventQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      // Process events in batches
      const batchSize = 10;
      const batch = this.eventQueue.splice(0, Math.min(batchSize, this.eventQueue.length));

      await Promise.all(batch.map(event => this.processEvent(event)));

    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single event
  private async processEvent(event: AgentEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if event has expired
      if (event.ttl) {
        const age = Date.now() - event.timestamp.getTime();
        if (age > event.ttl) {
          this.logger.debug(`Event ${event.id} expired, dropping`);
          this.metrics.droppedEvents++;
          return;
        }
      }

      // Get matching subscriptions
      const matchingSubscriptions = this.getMatchingSubscriptions(event);

      // Sort subscriptions by priority
      matchingSubscriptions.sort((a, b) => b.priority - a.priority);

      // Execute handlers
      const handlerPromises = matchingSubscriptions.map(subscription =>
        this.executeHandler(event, subscription)
      );

      await Promise.allSettled(handlerPromises);

      // Update processing time metrics
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);

      this.emit('event-processed', { eventId: event.id, processingTime, handlerCount: matchingSubscriptions.length });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error(`Error processing event ${event.id}:`, error);
      this.emit('event-error', { eventId: event.id, error });
    }
  }

  // Get subscriptions that match an event
  private getMatchingSubscriptions(event: AgentEvent): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription => {
      // Check event type match
      if (subscription.eventType !== '*' && subscription.eventType !== event.type) {
        return false;
      }

      // Check target match
      if (event.target) {
        const targets = Array.isArray(event.target) ? event.target : [event.target];
        // If event has specific targets and this subscription doesn't match any, skip
        // This would require agent ID mapping which we'll implement later
      }

      // Apply filter if present
      if (subscription.filter) {
        return this.applyEventFilter(event, subscription.filter);
      }

      return true;
    });
  }

  // Apply event filter
  private applyEventFilter(event: AgentEvent, filter: EventFilter): boolean {
    // Check source filter
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(event.source)) {
        return false;
      }
    }

    // Check priority filter
    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      if (!priorities.includes(event.priority)) {
        return false;
      }
    }

    // Check metadata filter
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (!event.metadata || event.metadata[key] !== value) {
          return false;
        }
      }
    }

    // Apply custom filter
    if (filter.customFilter) {
      return filter.customFilter(event);
    }

    return true;
  }

  // Execute event handler with error handling and retries
  private async executeHandler(event: AgentEvent, subscription: EventSubscription): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Handler timeout')), this.config.processingTimeout)
        );

        await Promise.race([
          Promise.resolve(subscription.handler(event)),
          timeout,
        ]);

        return; // Success, no need to retry

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    // All retries failed
    this.metrics.errorCount++;
    this.logger.error(`Handler failed for subscription ${subscription.id} after ${this.config.retryAttempts} attempts:`, lastError);
    this.emit('handler-error', { 
      subscriptionId: subscription.id, 
      eventId: event.id, 
      error: lastError 
    });
  }

  // Add event to history
  private addToHistory(event: AgentEvent): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.splice(0, this.eventHistory.length - this.config.maxEventHistory);
    }
  }

  // Update processing time metrics
  private updateProcessingMetrics(processingTime: number): void {
    const totalProcessed = this.metrics.totalEvents - this.metrics.droppedEvents;
    
    if (totalProcessed > 0) {
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
    }
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear event history
  public clearHistory(): void {
    this.eventHistory.length = 0;
    this.logger.info('Event history cleared');
  }

  // Clear all subscriptions
  public clearSubscriptions(): void {
    this.subscriptions.clear();
    this.metrics.activeSubscriptions = 0;
    this.logger.info('All subscriptions cleared');
  }

  // Health check
  public healthCheck(): {
    healthy: boolean;
    queueSize: number;
    subscriptionCount: number;
    metrics: EventBusMetrics;
  } {
    const queueSize = this.eventQueue.length;
    const subscriptionCount = this.subscriptions.size;
    
    // Consider unhealthy if queue is nearly full or processing is stalled
    const healthy = queueSize < this.config.maxQueueSize * 0.9 && !this.isProcessing;

    return {
      healthy,
      queueSize,
      subscriptionCount,
      metrics: this.getMetrics(),
    };
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    this.logger.info('EventBus shutting down...');

    // Process remaining events with timeout
    const shutdownStart = Date.now();
    const shutdownTimeout = 10000; // 10 seconds

    while (this.eventQueue.length > 0 && (Date.now() - shutdownStart) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear everything
    this.eventQueue.length = 0;
    this.clearSubscriptions();
    this.clearHistory();

    this.logger.info('EventBus shutdown completed');
  }
}
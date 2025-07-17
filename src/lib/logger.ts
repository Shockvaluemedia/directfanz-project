/**
 * Centralized logging system with structured logging
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  private formatLogEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty format for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const level = entry.level.toUpperCase().padEnd(5);
      const context = entry.context ? ` [${JSON.stringify(entry.context)}]` : '';
      const error = entry.error ? `\n  Error: ${entry.error.message}\n  Stack: ${entry.error.stack}` : '';
      
      return `${timestamp} ${level} ${entry.message}${context}${error}`;
    } else {
      // JSON format for production
      return JSON.stringify(entry);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    const formattedLog = this.formatLogEntry(entry);

    // Console output
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedLog);
        }
        break;
    }

    // In production, you might want to send logs to external services
    if (this.isProduction) {
      this.sendToExternalService(entry);
    }
  }

  private async sendToExternalService(entry: LogEntry) {
    // This is where you would integrate with external logging services
    // like Sentry, LogRocket, DataDog, etc.
    
    // Send errors to Sentry
    if (entry.level === LogLevel.ERROR && entry.error) {
      try {
        // Dynamically import Sentry to avoid circular dependencies
        const { captureError } = await import('./sentry');
        const error = new Error(entry.error.message);
        // Attach the original error as a property
        (error as any).originalError = entry.error;
        captureError(
          error,
          {
            ...entry.context,
            metadata: entry.metadata,
            logger: true,
          }
        );
      } catch (error) {
        // If Sentry integration fails, just log to console
        console.error('Failed to send error to Sentry:', error);
      }
    }
  }

  error(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  // Specialized logging methods
  apiRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext) {
    this.info(`${method} ${url} ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration,
    });
  }

  apiError(method: string, url: string, error: Error, context?: LogContext) {
    this.error(`API Error: ${method} ${url}`, {
      ...context,
      method,
      url,
    }, error);
  }

  authEvent(event: string, userId?: string, context?: LogContext) {
    this.info(`Auth: ${event}`, {
      ...context,
      userId,
      event,
    });
  }

  paymentEvent(event: string, amount?: number, currency?: string, context?: LogContext) {
    this.info(`Payment: ${event}`, {
      ...context,
      event,
      amount,
      currency,
    });
  }

  subscriptionEvent(event: string, subscriptionId: string, context?: LogContext) {
    this.info(`Subscription: ${event}`, {
      ...context,
      event,
      subscriptionId,
    });
  }

  contentEvent(event: string, contentId: string, context?: LogContext) {
    this.info(`Content: ${event}`, {
      ...context,
      event,
      contentId,
    });
  }

  securityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext) {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    this.log(level, `Security: ${event}`, {
      ...context,
      event,
      severity,
    });
  }
}

// Create singleton instance
export const logger = new Logger();

// Request ID generator
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Performance monitoring
export class PerformanceMonitor {
  private startTime: number;
  private operation: string;
  private context?: LogContext;

  constructor(operation: string, context?: LogContext) {
    this.operation = operation;
    this.context = context;
    this.startTime = Date.now();
  }

  end(metadata?: Record<string, any>) {
    const duration = Date.now() - this.startTime;
    
    if (duration > 1000) {
      logger.warn(`Slow operation: ${this.operation} took ${duration}ms`, this.context, {
        ...metadata,
        duration,
        operation: this.operation,
      });
    } else {
      logger.debug(`Operation completed: ${this.operation} in ${duration}ms`, this.context, {
        ...metadata,
        duration,
        operation: this.operation,
      });
    }

    return duration;
  }
}

// Helper function to create performance monitor
export const monitor = (operation: string, context?: LogContext) => {
  return new PerformanceMonitor(operation, context);
};

// Error boundary logging
export const logUnhandledError = (error: Error, context?: LogContext) => {
  logger.error('Unhandled error occurred', context, error, {
    type: 'unhandled_error',
    fatal: true,
  });
};

// Process error handlers
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (error) => {
    logUnhandledError(error, { type: 'uncaught_exception' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logUnhandledError(error, { 
      type: 'unhandled_rejection',
      promise: promise.toString(),
    });
  });
}
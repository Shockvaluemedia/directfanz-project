import * as Sentry from '@sentry/nextjs';

// Initialize Sentry for error tracking and performance monitoring
export function initSentry() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      integrations: [
        new Sentry.BrowserTracing({
          // Set sampling rate for performance monitoring
          tracePropagationTargets: ['localhost', /^https:\/\/yourapi\.domain\.com\/api/],
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Environment
      environment: process.env.NODE_ENV,
      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
      // Additional options
      beforeSend(event) {
        // Filter out common non-critical errors
        if (event.exception) {
          const error = event.exception.values?.[0];
          if (error?.value?.includes('Non-Error promise rejection captured')) {
            return null;
          }
          if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
            return null;
          }
        }
        return event;
      },
    });
  }
}

// Custom error reporting functions
export function reportError(error: Error, context?: Record<string, any>) {
  console.error('Error reported:', error, context);

  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope(scope => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setContext(key, context[key]);
        });
      }
      Sentry.captureException(error);
    });
  }
}

export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  console.log(`[${level.toUpperCase()}] ${message}`, context);

  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope(scope => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setContext(key, context[key]);
        });
      }
      Sentry.captureMessage(message, level);
    });
  }
}

// User context for error tracking
export function setUserContext(user: { id: string; email?: string; role?: string; name?: string }) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
      role: user.role,
    });
  }
}

// Performance monitoring helpers
export function startTransaction(name: string, op: string) {
  if (process.env.NODE_ENV === 'production') {
    return Sentry.startTransaction({ name, op });
  }
  return null;
}

export function addBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'warning' | 'error' = 'info'
) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
    });
  }
}

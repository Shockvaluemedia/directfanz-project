import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  integrations: [
    Sentry.httpIntegration({ tracing: true }),
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],

  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value) {
        // Filter out database connection timeouts during startup
        if (error.value.includes('connect ECONNREFUSED') && process.uptime() < 30) {
          return null;
        }

        // Filter out Redis connection errors during startup
        if (error.value.includes('Redis connection') && process.uptime() < 30) {
          return null;
        }
      }
    }

    // In development, also log to console
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Server Error:', event);
    }

    return event;
  },

  // Server-specific configuration
  initialScope: {
    tags: {
      platform: 'server',
      version: process.env.npm_package_version || '1.0.0',
      runtime: 'nodejs',
    },
    contexts: {
      runtime: {
        name: 'node',
        version: process.version,
      },
    },
  },

  // Enable auto instrumentation
  skipOpenTelemetrySetup: false,
});

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  beforeSend(event, hint) {
    // Filter out known non-critical errors for edge runtime
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value) {
        // Filter out edge runtime specific errors
        if (error.value.includes('Dynamic Code Evaluation')) {
          return null;
        }
      }
    }

    return event;
  },

  // Edge runtime specific configuration
  initialScope: {
    tags: {
      platform: 'edge',
      version: process.env.npm_package_version || '1.0.0',
      runtime: 'edge',
    },
  },
});

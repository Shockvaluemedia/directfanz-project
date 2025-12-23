import * as Sentry from '@sentry/nextjs';
import { initializeSentryAWS } from '../src/lib/sentry-aws-integration';

// Initialize AWS-integrated Sentry service
const sentryAWSService = initializeSentryAWS({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  cloudWatchRegion: process.env.AWS_REGION || 'us-east-1',
  enableCloudWatchIntegration: process.env.NODE_ENV === 'production',
  enableXRayIntegration: process.env.NODE_ENV === 'production',
  customTags: {
    platform: 'client',
    version: process.env.npm_package_version || '1.0.0',
  },
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      // Set sampling rate for performance monitoring
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.vercel\.app/,
        /^https:\/\/directfanz\.com/,
        /^https:\/\/[^/]*\.directfanz\.com/,
      ],
    }),
  ],

  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value) {
        // Filter out common browser extension errors
        if (error.value.includes('Non-Error promise rejection captured')) {
          return null;
        }
        if (error.value.includes('ResizeObserver loop limit exceeded')) {
          return null;
        }
        if (error.value.includes('Script error.')) {
          return null;
        }
        // Filter out network errors that might be caused by ad blockers
        if (error.value.includes('NetworkError') || error.value.includes('Failed to fetch')) {
          return null;
        }
      }
    }

    // Add AWS context to client-side errors
    if (event.contexts) {
      event.contexts.aws = {
        region: process.env.AWS_REGION || 'us-east-1',
        environment: process.env.NODE_ENV,
        platform: 'client',
      };
    }

    // In development, also log to console
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Error:', event);
    }

    return event;
  },

  // Additional client configuration
  initialScope: {
    tags: {
      platform: 'client',
      version: process.env.npm_package_version || '1.0.0',
      infrastructure: 'aws',
    },
  },
});

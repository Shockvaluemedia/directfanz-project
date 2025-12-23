import * as Sentry from '@sentry/nextjs';
import { initializeSentryAWS } from './src/lib/sentry-aws-integration';

// Initialize AWS-integrated Sentry service for server-side
const sentryAWSService = initializeSentryAWS({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  cloudWatchRegion: process.env.AWS_REGION || 'us-east-1',
  enableCloudWatchIntegration: true,
  enableXRayIntegration: true,
  customTags: {
    platform: 'server',
    version: process.env.npm_package_version || '1.0.0',
    runtime: 'nodejs',
  },
});

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

        // Filter out AWS SDK throttling errors (these are handled by retry logic)
        if (error.value.includes('Throttling') || error.value.includes('RequestLimitExceeded')) {
          return null;
        }
      }
    }

    // Add AWS context to server-side errors
    if (event.contexts) {
      event.contexts.aws = {
        region: process.env.AWS_REGION || 'us-east-1',
        environment: process.env.NODE_ENV,
        platform: 'server',
        service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'ecs-service',
        taskArn: process.env.ECS_TASK_ARN,
      };
    }

    // Add ECS metadata if available
    if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
      event.contexts = event.contexts || {};
      event.contexts.ecs = {
        taskArn: process.env.ECS_TASK_ARN,
        taskDefinitionFamily: process.env.ECS_TASK_DEFINITION_FAMILY,
        taskDefinitionRevision: process.env.ECS_TASK_DEFINITION_REVISION,
        containerName: process.env.ECS_CONTAINER_NAME,
      };
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
      infrastructure: 'aws',
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

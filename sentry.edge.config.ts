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
        // Filter out CloudFront/edge specific errors
        if (error.value.includes('CloudFront') && error.value.includes('timeout')) {
          return null;
        }
      }
    }

    // Add AWS edge context
    if (event.contexts) {
      event.contexts.aws = {
        region: process.env.AWS_REGION || 'us-east-1',
        environment: process.env.NODE_ENV,
        platform: 'edge',
        runtime: 'edge',
      };
    }

    // Add CloudFront context if available
    if (event.request?.headers) {
      const cfHeaders = Object.keys(event.request.headers).filter(key => 
        key.toLowerCase().startsWith('cloudfront-')
      );
      
      if (cfHeaders.length > 0) {
        event.contexts = event.contexts || {};
        event.contexts.cloudfront = {};
        cfHeaders.forEach(header => {
          if (event.request?.headers && event.contexts?.cloudfront) {
            event.contexts.cloudfront[header] = event.request.headers[header];
          }
        });
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
      infrastructure: 'aws',
    },
  },
});

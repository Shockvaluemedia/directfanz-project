/**
 * AWS Configuration utilities for ECS deployment
 * Handles AWS Parameter Store integration and service configuration
 */

import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';
import { logger } from './logger';

// AWS SSM Client for Parameter Store
let ssmClient: SSMClient | null = null;

/**
 * Initialize AWS SSM client
 */
const getSSMClient = () => {
  if (!ssmClient) {
    ssmClient = new SSMClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
    });
  }
  return ssmClient;
};

/**
 * Get parameter from AWS Parameter Store
 * Falls back to environment variable if Parameter Store is not available
 */
export const getParameter = async (
  parameterName: string,
  fallbackEnvVar?: string,
  withDecryption: boolean = true
): Promise<string | null> => {
  try {
    // If running locally or Parameter Store is not configured, use environment variables
    if (process.env.NODE_ENV === 'development' || !process.env.AWS_REGION) {
      const envValue = fallbackEnvVar ? process.env[fallbackEnvVar] : process.env[parameterName];
      return envValue || null;
    }

    const client = getSSMClient();
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: withDecryption,
    });

    const response = await client.send(command);
    return response.Parameter?.Value || null;
  } catch (error) {
    logger.warn(`Failed to get parameter ${parameterName} from Parameter Store, falling back to environment variable`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to environment variable
    const envValue = fallbackEnvVar ? process.env[fallbackEnvVar] : process.env[parameterName];
    return envValue || null;
  }
};

/**
 * Get multiple parameters from AWS Parameter Store
 * Falls back to environment variables if Parameter Store is not available
 */
export const getParameters = async (
  parameterNames: string[],
  fallbackEnvVars?: Record<string, string>,
  withDecryption: boolean = true
): Promise<Record<string, string | null>> => {
  try {
    // If running locally or Parameter Store is not configured, use environment variables
    if (process.env.NODE_ENV === 'development' || !process.env.AWS_REGION) {
      const result: Record<string, string | null> = {};
      parameterNames.forEach(name => {
        const envVar = fallbackEnvVars?.[name] || name;
        result[name] = process.env[envVar] || null;
      });
      return result;
    }

    const client = getSSMClient();
    const command = new GetParametersCommand({
      Names: parameterNames,
      WithDecryption: withDecryption,
    });

    const response = await client.send(command);
    const result: Record<string, string | null> = {};

    // Process successful parameters
    response.Parameters?.forEach(param => {
      if (param.Name && param.Value) {
        result[param.Name] = param.Value;
      }
    });

    // Handle invalid parameters with fallback
    response.InvalidParameters?.forEach(paramName => {
      logger.warn(`Parameter ${paramName} not found in Parameter Store, using environment variable`);
      const envVar = fallbackEnvVars?.[paramName] || paramName;
      result[paramName] = process.env[envVar] || null;
    });

    return result;
  } catch (error) {
    logger.warn('Failed to get parameters from Parameter Store, falling back to environment variables', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to environment variables
    const result: Record<string, string | null> = {};
    parameterNames.forEach(name => {
      const envVar = fallbackEnvVars?.[name] || name;
      result[name] = process.env[envVar] || null;
    });
    return result;
  }
};

/**
 * AWS service configuration
 */
export const AWS_CONFIG = {
  // ECS Configuration
  ECS: {
    CLUSTER_NAME: process.env.ECS_CLUSTER_NAME || 'directfanz-cluster',
    SERVICE_NAME: process.env.ECS_SERVICE_NAME || 'directfanz-web',
    TASK_DEFINITION: process.env.ECS_TASK_DEFINITION || 'directfanz-web-task',
  },

  // ALB Configuration
  ALB: {
    TARGET_GROUP_ARN: process.env.ALB_TARGET_GROUP_ARN,
    HEALTH_CHECK_PATH: '/api/health',
    HEALTH_CHECK_INTERVAL: 30,
    HEALTH_CHECK_TIMEOUT: 5,
    HEALTHY_THRESHOLD: 2,
    UNHEALTHY_THRESHOLD: 3,
  },

  // RDS Configuration
  RDS: {
    ENDPOINT: process.env.RDS_ENDPOINT,
    PORT: process.env.RDS_PORT || '5432',
    DATABASE: process.env.RDS_DATABASE || 'directfanz',
  },

  // ElastiCache Configuration
  ELASTICACHE: {
    ENDPOINT: process.env.ELASTICACHE_ENDPOINT,
    PORT: process.env.ELASTICACHE_PORT || '6379',
    AUTH_TOKEN: process.env.ELASTICACHE_AUTH_TOKEN,
  },

  // S3 Configuration
  S3: {
    BUCKET: process.env.AWS_S3_BUCKET_NAME,
    REGION: process.env.AWS_REGION || 'us-east-1',
    CLOUDFRONT_DOMAIN: process.env.AWS_CLOUDFRONT_DOMAIN,
  },

  // Parameter Store paths
  PARAMETER_STORE: {
    DATABASE_URL: '/directfanz/database/url',
    REDIS_URL: '/directfanz/redis/url',
    NEXTAUTH_SECRET: '/directfanz/auth/nextauth-secret',
    STRIPE_SECRET_KEY: '/directfanz/stripe/secret-key',
    OPENAI_API_KEY: '/directfanz/openai/api-key',
    SENDGRID_API_KEY: '/directfanz/sendgrid/api-key',
    SENTRY_DSN: '/directfanz/sentry/dsn',
    ENCRYPTION_KEY: '/directfanz/security/encryption-key',
    JWT_SECRET: '/directfanz/security/jwt-secret',
  },
};

/**
 * Load configuration from Parameter Store or environment variables
 */
export const loadAWSConfiguration = async (): Promise<{
  databaseUrl: string | null;
  redisUrl: string | null;
  nextAuthSecret: string | null;
  stripeSecretKey: string | null;
  openAiApiKey: string | null;
  sendGridApiKey: string | null;
  sentryDsn: string | null;
  encryptionKey: string | null;
  jwtSecret: string | null;
}> => {
  const parameters = await getParameters(
    [
      AWS_CONFIG.PARAMETER_STORE.DATABASE_URL,
      AWS_CONFIG.PARAMETER_STORE.REDIS_URL,
      AWS_CONFIG.PARAMETER_STORE.NEXTAUTH_SECRET,
      AWS_CONFIG.PARAMETER_STORE.STRIPE_SECRET_KEY,
      AWS_CONFIG.PARAMETER_STORE.OPENAI_API_KEY,
      AWS_CONFIG.PARAMETER_STORE.SENDGRID_API_KEY,
      AWS_CONFIG.PARAMETER_STORE.SENTRY_DSN,
      AWS_CONFIG.PARAMETER_STORE.ENCRYPTION_KEY,
      AWS_CONFIG.PARAMETER_STORE.JWT_SECRET,
    ],
    {
      [AWS_CONFIG.PARAMETER_STORE.DATABASE_URL]: 'DATABASE_URL',
      [AWS_CONFIG.PARAMETER_STORE.REDIS_URL]: 'REDIS_URL',
      [AWS_CONFIG.PARAMETER_STORE.NEXTAUTH_SECRET]: 'NEXTAUTH_SECRET',
      [AWS_CONFIG.PARAMETER_STORE.STRIPE_SECRET_KEY]: 'STRIPE_SECRET_KEY',
      [AWS_CONFIG.PARAMETER_STORE.OPENAI_API_KEY]: 'OPENAI_API_KEY',
      [AWS_CONFIG.PARAMETER_STORE.SENDGRID_API_KEY]: 'SENDGRID_API_KEY',
      [AWS_CONFIG.PARAMETER_STORE.SENTRY_DSN]: 'SENTRY_DSN',
      [AWS_CONFIG.PARAMETER_STORE.ENCRYPTION_KEY]: 'ENCRYPTION_KEY',
      [AWS_CONFIG.PARAMETER_STORE.JWT_SECRET]: 'JWT_SECRET',
    }
  );

  return {
    databaseUrl: parameters[AWS_CONFIG.PARAMETER_STORE.DATABASE_URL],
    redisUrl: parameters[AWS_CONFIG.PARAMETER_STORE.REDIS_URL],
    nextAuthSecret: parameters[AWS_CONFIG.PARAMETER_STORE.NEXTAUTH_SECRET],
    stripeSecretKey: parameters[AWS_CONFIG.PARAMETER_STORE.STRIPE_SECRET_KEY],
    openAiApiKey: parameters[AWS_CONFIG.PARAMETER_STORE.OPENAI_API_KEY],
    sendGridApiKey: parameters[AWS_CONFIG.PARAMETER_STORE.SENDGRID_API_KEY],
    sentryDsn: parameters[AWS_CONFIG.PARAMETER_STORE.SENTRY_DSN],
    encryptionKey: parameters[AWS_CONFIG.PARAMETER_STORE.ENCRYPTION_KEY],
    jwtSecret: parameters[AWS_CONFIG.PARAMETER_STORE.JWT_SECRET],
  };
};

/**
 * Check if running in AWS ECS environment
 */
export const isRunningInECS = (): boolean => {
  return !!(
    process.env.ECS_CONTAINER_METADATA_URI_V4 ||
    process.env.ECS_CONTAINER_METADATA_URI ||
    process.env.AWS_EXECUTION_ENV?.includes('ECS')
  );
};

/**
 * Get ECS task metadata
 */
export const getECSTaskMetadata = async (): Promise<any> => {
  try {
    const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
    if (!metadataUri) {
      return null;
    }

    const response = await fetch(`${metadataUri}/task`);
    return await response.json();
  } catch (error) {
    logger.warn('Failed to get ECS task metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
};

/**
 * Get container health status for ALB health checks
 */
export const getContainerHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: Record<string, any>;
}> => {
  const checks: Record<string, any> = {};

  try {
    // Check if running in ECS
    checks.ecs = {
      running: isRunningInECS(),
      metadata: await getECSTaskMetadata(),
    };

    // Check environment configuration
    checks.environment = {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      region: process.env.AWS_REGION,
    };

    // Check critical environment variables
    const criticalVars = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
    checks.configuration = {};
    
    for (const varName of criticalVars) {
      const value = await getParameter(
        AWS_CONFIG.PARAMETER_STORE[varName as keyof typeof AWS_CONFIG.PARAMETER_STORE] || varName,
        varName,
        false
      );
      checks.configuration[varName] = !!value;
    }

    const allConfigured = Object.values(checks.configuration).every(Boolean);
    
    return {
      status: allConfigured ? 'healthy' : 'unhealthy',
      checks,
    };
  } catch (error) {
    logger.error('Container health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      status: 'unhealthy',
      checks: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
};
/**
 * Environment Validation Module
 * 
 * Validates environment variables at application startup and provides
 * clear error messages for missing or invalid configurations.
 * 
 * Requirements: 3.4, 3.5
 */

import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Database (Required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication (Required)
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  
  // Redis (Optional but recommended for production)
  REDIS_URL: z.string().optional(),
  
  // Stripe (Optional but required for payments)
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // AWS (Optional but required for file uploads)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  
  // Email (Optional but required for notifications)
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_VERSION: z.string().default('0.1.0'),
  
  // Monitoring (Optional)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Infer the type from schema
export type EnvConfig = z.infer<typeof envSchema>;

// Feature flags based on environment variables
export interface FeatureFlags {
  hasDatabase: boolean;
  hasRedis: boolean;
  hasPayments: boolean;
  hasFileUploads: boolean;
  hasEmail: boolean;
  hasMonitoring: boolean;
}

// Validation result
export interface ValidationResult {
  success: boolean;
  config?: EnvConfig;
  errors: string[];
  warnings: string[];
  features: FeatureFlags;
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Parse and validate environment variables
    const config = envSchema.parse(process.env);
    
    // Check for production-specific requirements
    if (config.NODE_ENV === 'production') {
      validateProductionRequirements(config, errors, warnings);
    }
    
    // Check for feature completeness
    validateFeatureRequirements(config, warnings);
    
    // Determine available features
    const features = determineFeatures(config);
    
    return {
      success: errors.length === 0,
      config,
      errors,
      warnings,
      features
    };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      errors.push(...zodErrors);
    } else {
      errors.push(`Unexpected validation error: ${error}`);
    }
    
    return {
      success: false,
      errors,
      warnings,
      features: {
        hasDatabase: false,
        hasRedis: false,
        hasPayments: false,
        hasFileUploads: false,
        hasEmail: false,
        hasMonitoring: false
      }
    };
  }
}

/**
 * Validate production-specific requirements
 */
function validateProductionRequirements(
  config: EnvConfig, 
  errors: string[], 
  warnings: string[]
): void {
  // Production must have secure NEXTAUTH_SECRET
  if (config.NEXTAUTH_SECRET.includes('development') || 
      config.NEXTAUTH_SECRET.includes('test')) {
    errors.push('NEXTAUTH_SECRET must not contain development/test values in production');
  }
  
  // Production should have HTTPS URLs
  if (config.NEXTAUTH_URL && !config.NEXTAUTH_URL.startsWith('https://')) {
    warnings.push('NEXTAUTH_URL should use HTTPS in production');
  }
  
  if (config.NEXT_PUBLIC_APP_URL && !config.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
    warnings.push('NEXT_PUBLIC_APP_URL should use HTTPS in production');
  }
  
  // Production should have Redis for performance
  if (!config.REDIS_URL) {
    warnings.push('REDIS_URL is recommended for production performance');
  }
  
  // Production should have monitoring
  if (!config.SENTRY_DSN) {
    warnings.push('SENTRY_DSN is recommended for production error tracking');
  }
}

/**
 * Validate feature-specific requirements
 */
function validateFeatureRequirements(config: EnvConfig, warnings: string[]): void {
  // Payment feature requirements
  const hasAnyStripeKey = config.STRIPE_PUBLISHABLE_KEY || config.STRIPE_SECRET_KEY;
  if (hasAnyStripeKey && (!config.STRIPE_PUBLISHABLE_KEY || !config.STRIPE_SECRET_KEY)) {
    warnings.push('Both STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY are required for payments');
  }
  
  // File upload feature requirements
  const hasAnyAwsKey = config.AWS_ACCESS_KEY_ID || config.AWS_SECRET_ACCESS_KEY;
  if (hasAnyAwsKey && (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY || !config.AWS_S3_BUCKET_NAME)) {
    warnings.push('AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME are all required for file uploads');
  }
  
  // Email feature requirements
  if (config.SENDGRID_API_KEY && !config.FROM_EMAIL) {
    warnings.push('FROM_EMAIL is required when SENDGRID_API_KEY is set');
  }
}

/**
 * Determine available features based on configuration
 */
function determineFeatures(config: EnvConfig): FeatureFlags {
  return {
    hasDatabase: !!config.DATABASE_URL,
    hasRedis: !!config.REDIS_URL,
    hasPayments: !!(config.STRIPE_PUBLISHABLE_KEY && config.STRIPE_SECRET_KEY),
    hasFileUploads: !!(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY && config.AWS_S3_BUCKET_NAME),
    hasEmail: !!(config.SENDGRID_API_KEY && config.FROM_EMAIL),
    hasMonitoring: !!config.SENTRY_DSN
  };
}

/**
 * Get validated environment configuration
 * Throws error if validation fails
 */
export function getValidatedEnv(): EnvConfig {
  const result = validateEnvironment();
  
  if (!result.success) {
    const errorMessage = [
      '❌ Environment validation failed:',
      '',
      ...result.errors.map(err => `  • ${err}`),
      '',
      'Please check your environment variables and try again.',
      'See docs/guides/ENVIRONMENT_VARIABLES.md for configuration help.'
    ].join('\n');
    
    throw new Error(errorMessage);
  }
  
  // Log warnings if any
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    result.warnings.forEach(warning => console.warn(`  • ${warning}`));
    console.warn('');
  }
  
  // Log available features
  const enabledFeatures = Object.entries(result.features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature);
    
  if (enabledFeatures.length > 0) {
    console.log('✅ Enabled features:', enabledFeatures.join(', '));
  }
  
  return result.config!;
}

/**
 * Validate specific feature requirements
 */
export function validateFeature(feature: keyof FeatureFlags): boolean {
  const result = validateEnvironment();
  return result.features[feature];
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(name: string, required: boolean = false): string | undefined {
  const value = process.env[name];
  
  if (required && !value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  
  return value;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get database URL with validation
 */
export function getDatabaseUrl(): string {
  const url = getEnvVar('DATABASE_URL', true);
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  return url;
}

/**
 * Get NextAuth configuration
 */
export function getAuthConfig(): { secret: string; url: string } {
  const secret = getEnvVar('NEXTAUTH_SECRET', true);
  const url = getEnvVar('NEXTAUTH_URL', true);
  
  if (!secret || !url) {
    throw new Error('NEXTAUTH_SECRET and NEXTAUTH_URL are required');
  }
  
  return { secret, url };
}

/**
 * Get Stripe configuration (if available)
 */
export function getStripeConfig(): { publishableKey: string; secretKey: string } | null {
  const publishableKey = getEnvVar('STRIPE_PUBLISHABLE_KEY');
  const secretKey = getEnvVar('STRIPE_SECRET_KEY');
  
  if (!publishableKey || !secretKey) {
    return null;
  }
  
  return { publishableKey, secretKey };
}

/**
 * Get AWS configuration (if available)
 */
export function getAwsConfig(): { 
  accessKeyId: string; 
  secretAccessKey: string; 
  region: string; 
  bucketName: string; 
} | null {
  const accessKeyId = getEnvVar('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnvVar('AWS_SECRET_ACCESS_KEY');
  const region = getEnvVar('AWS_REGION') || 'us-east-1';
  const bucketName = getEnvVar('AWS_S3_BUCKET_NAME');
  
  if (!accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }
  
  return { accessKeyId, secretAccessKey, region, bucketName };
}

// Export the validated environment for use throughout the app
let validatedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    validatedEnv = getValidatedEnv();
  }
  return validatedEnv;
}
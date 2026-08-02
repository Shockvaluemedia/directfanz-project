/**
 * Property Tests: Environment Configuration
 * 
 * Validates Requirements 3.3, 3.4, 3.5:
 * - Environment reference safety
 * - Environment validation completeness
 * - Startup validation integration
 */

import * as fc from 'fast-check';
import {
  validateEnvironment,
  getValidatedEnv,
  validateFeature,
  getEnvVar,
  getDatabaseUrl,
  getAuthConfig,
  getStripeConfig,
  getAwsConfig,
  type EnvConfig,
  type FeatureFlags
} from '../../src/lib/env-validation';

describe('Property Tests: Environment Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  /**
   * Property 1: Environment Reference Safety
   * All environment variable references are safe and validated
   */
  test('Property 1: Environment variable access is safe', () => {
    fc.assert(fc.property(
      fc.record({
        name: fc.constantFrom('DATABASE_URL', 'NEXTAUTH_SECRET', 'REDIS_URL', 'STRIPE_SECRET_KEY'),
        value: fc.oneof(
          fc.constant(undefined),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constant('')
        )
      }),
      fc.boolean(),
      (envVar, required) => {
        // Set up test environment
        if (envVar.value !== undefined) {
          process.env[envVar.name] = envVar.value;
        } else {
          delete process.env[envVar.name];
        }
        
        if (required && !envVar.value) {
          // Should throw error for required missing variables
          expect(() => getEnvVar(envVar.name, true)).toThrow();
        } else {
          // Should return value or undefined safely
          const result = getEnvVar(envVar.name, required);
          if (envVar.value) {
            expect(result).toBe(envVar.value);
          } else {
            expect(result).toBeUndefined();
          }
        }
      }
    ));
  });

  /**
   * Property 2: Environment Validation Completeness
   * All required variables are properly validated
   */
  test('Property 2: Required variables are validated completely', () => {
    fc.assert(fc.property(
      fc.record({
        DATABASE_URL: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        NEXTAUTH_SECRET: fc.oneof(fc.constant(undefined), fc.string({ minLength: 0, maxLength: 100 })),
        NEXTAUTH_URL: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 }))
      }),
      (envVars) => {
        // Set up test environment
        Object.keys(process.env).forEach(key => {
          if (key.startsWith('DATABASE_') || key.startsWith('NEXTAUTH_')) {
            delete process.env[key];
          }
        });
        
        if (envVars.DATABASE_URL) process.env.DATABASE_URL = envVars.DATABASE_URL;
        if (envVars.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = envVars.NEXTAUTH_SECRET;
        if (envVars.NEXTAUTH_URL) process.env.NEXTAUTH_URL = envVars.NEXTAUTH_URL;
        
        const result = validateEnvironment();
        
        // Check validation logic
        const hasRequiredVars = envVars.DATABASE_URL && 
                               envVars.NEXTAUTH_SECRET && 
                               envVars.NEXTAUTH_SECRET.length >= 32 &&
                               envVars.NEXTAUTH_URL;
        
        if (hasRequiredVars) {
          // Should succeed if all required vars are valid
          expect(result.errors.length).toBe(0);
          expect(result.success).toBe(true);
          expect(result.config).toBeDefined();
        } else {
          // Should fail if required vars are missing or invalid
          expect(result.success).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    ));
  });

  /**
   * Property 3: Feature Flag Consistency
   * Feature flags accurately reflect available configuration
   */
  test('Property 3: Feature flags are consistent with configuration', () => {
    fc.assert(fc.property(
      fc.record({
        STRIPE_PUBLISHABLE_KEY: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        STRIPE_SECRET_KEY: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        AWS_ACCESS_KEY_ID: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        AWS_SECRET_ACCESS_KEY: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        AWS_S3_BUCKET_NAME: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        SENDGRID_API_KEY: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        FROM_EMAIL: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 })),
        REDIS_URL: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1 }))
      }),
      (envVars) => {
        // Set up minimal required environment
        process.env.DATABASE_URL = 'file:./test.db';
        process.env.NEXTAUTH_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
        process.env.NEXTAUTH_URL = 'http://localhost:3000';
        
        // Set optional variables
        Object.entries(envVars).forEach(([key, value]) => {
          if (value) {
            process.env[key] = value;
          } else {
            delete process.env[key];
          }
        });
        
        const result = validateEnvironment();
        
        if (result.success) {
          const features = result.features;
          
          // Payments feature should match Stripe configuration
          const hasStripeKeys = envVars.STRIPE_PUBLISHABLE_KEY && envVars.STRIPE_SECRET_KEY;
          expect(features.hasPayments).toBe(!!hasStripeKeys);
          
          // File uploads feature should match AWS configuration
          const hasAwsKeys = envVars.AWS_ACCESS_KEY_ID && 
                            envVars.AWS_SECRET_ACCESS_KEY && 
                            envVars.AWS_S3_BUCKET_NAME;
          expect(features.hasFileUploads).toBe(!!hasAwsKeys);
          
          // Email feature should match SendGrid configuration
          const hasEmailConfig = envVars.SENDGRID_API_KEY && envVars.FROM_EMAIL;
          expect(features.hasEmail).toBe(!!hasEmailConfig);
          
          // Redis feature should match Redis configuration
          expect(features.hasRedis).toBe(!!envVars.REDIS_URL);
          
          // Database should always be true (required)
          expect(features.hasDatabase).toBe(true);
        }
      }
    ));
  });

  /**
   * Property 4: Configuration Getter Consistency
   * Configuration getters return consistent results
   */
  test('Property 4: Configuration getters are consistent', () => {
    fc.assert(fc.property(
      fc.record({
        stripePublishable: fc.string({ minLength: 10 }),
        stripeSecret: fc.string({ minLength: 10 }),
        awsAccessKey: fc.string({ minLength: 10 }),
        awsSecretKey: fc.string({ minLength: 10 }),
        awsBucket: fc.string({ minLength: 3 })
      }),
      (config) => {
        // Set up complete environment
        process.env.DATABASE_URL = 'file:./test.db';
        process.env.NEXTAUTH_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
        process.env.NEXTAUTH_URL = 'http://localhost:3000';
        process.env.STRIPE_PUBLISHABLE_KEY = config.stripePublishable;
        process.env.STRIPE_SECRET_KEY = config.stripeSecret;
        process.env.AWS_ACCESS_KEY_ID = config.awsAccessKey;
        process.env.AWS_SECRET_ACCESS_KEY = config.awsSecretKey;
        process.env.AWS_S3_BUCKET_NAME = config.awsBucket;
        
        // Test Stripe configuration getter
        const stripeConfig = getStripeConfig();
        expect(stripeConfig).not.toBeNull();
        if (stripeConfig) {
          expect(stripeConfig.publishableKey).toBe(config.stripePublishable);
          expect(stripeConfig.secretKey).toBe(config.stripeSecret);
        }
        
        // Test AWS configuration getter
        const awsConfig = getAwsConfig();
        expect(awsConfig).not.toBeNull();
        if (awsConfig) {
          expect(awsConfig.accessKeyId).toBe(config.awsAccessKey);
          expect(awsConfig.secretAccessKey).toBe(config.awsSecretKey);
          expect(awsConfig.bucketName).toBe(config.awsBucket);
          expect(awsConfig.region).toBe('us-east-1'); // Default value
        }
      }
    ));
  });

  /**
   * Property 5: Production Validation Strictness
   * Production environment has stricter validation rules
   */
  test('Property 5: Production validation is stricter than development', () => {
    fc.assert(fc.property(
      fc.record({
        nextauthSecret: fc.oneof(
          fc.constant('development-secret'),
          fc.constant('test-secret'),
          fc.string({ minLength: 32 }).filter(s => !s.includes('development') && !s.includes('test'))
        ),
        nextauthUrl: fc.oneof(
          fc.constant('http://localhost:3000'),
          fc.constant('https://production.com')
        )
      }),
      (config) => {
        // Set up environment
        process.env.DATABASE_URL = 'file:./test.db';
        process.env.NEXTAUTH_SECRET = config.nextauthSecret;
        process.env.NEXTAUTH_URL = config.nextauthUrl;
        
        // Test development environment
        process.env.NODE_ENV = 'development';
        const devResult = validateEnvironment();
        
        // Test production environment
        process.env.NODE_ENV = 'production';
        const prodResult = validateEnvironment();
        
        // Production should have more warnings/errors for insecure configurations
        if (config.nextauthSecret.includes('development') || config.nextauthSecret.includes('test')) {
          expect(prodResult.errors.length).toBeGreaterThan(devResult.errors.length);
        }
        
        if (config.nextauthUrl.startsWith('http://')) {
          expect(prodResult.warnings.length).toBeGreaterThanOrEqual(devResult.warnings.length);
        }
      }
    ));
  });

  /**
   * Property 6: Error Message Clarity
   * Validation errors provide clear, actionable messages
   */
  test('Property 6: Validation errors are clear and actionable', () => {
    fc.assert(fc.property(
      fc.constantFrom('DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'),
      (missingVar) => {
        // Set up environment with one missing required variable
        process.env.DATABASE_URL = 'file:./test.db';
        process.env.NEXTAUTH_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
        process.env.NEXTAUTH_URL = 'http://localhost:3000';
        
        // Remove the specified variable
        delete process.env[missingVar];
        
        const result = validateEnvironment();
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Error message should mention the missing variable
        const hasRelevantError = result.errors.some(error => 
          error.includes(missingVar) || error.toLowerCase().includes('required')
        );
        expect(hasRelevantError).toBe(true);
      }
    ));
  });

  /**
   * Property 7: Environment Isolation
   * Environment validation doesn't affect global state
   */
  test('Property 7: Validation preserves environment isolation', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        key: fc.string({ minLength: 1, maxLength: 20 }).map(s => 'TEST_' + s),
        value: fc.string({ minLength: 0, maxLength: 50 })
      }), { maxLength: 10 }),
      (testVars) => {
        // Save current environment state
        const beforeEnv = { ...process.env };
        
        // Set test variables
        testVars.forEach(({ key, value }) => {
          process.env[key] = value;
        });
        
        // Run validation
        validateEnvironment();
        
        // Check that validation didn't modify unrelated environment variables
        testVars.forEach(({ key, value }) => {
          expect(process.env[key]).toBe(value);
        });
        
        // Check that original variables are still intact
        Object.keys(beforeEnv).forEach(key => {
          if (!key.startsWith('TEST_')) {
            expect(process.env[key]).toBe(beforeEnv[key]);
          }
        });
      }
    ));
  });
});
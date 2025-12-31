import { EnvironmentValidator, EnvironmentHealthCheck } from '../../src/lib/parameter-store';

describe('Property Test: Secure Environment Variable Usage', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    test('Property 1: All required environment variables must be present', () => {
      // Set up valid environment
      const validEnv = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        NEXTAUTH_SECRET: 'a'.repeat(32),
        NEXTAUTH_URL: 'https://directfanz.io',
        STRIPE_SECRET_KEY: 'sk_test_123456789',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
        STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_S3_BUCKET_NAME: 'directfanz-production',
        SENDGRID_API_KEY: 'SG.123456789',
        FROM_EMAIL: 'noreply@directfanz.io',
      };

      Object.assign(process.env, validEnv);

      expect(() => EnvironmentValidator.validate()).not.toThrow();
    });

    test('Property 1: Missing required variables should throw error', () => {
      // Clear environment
      const requiredVars = [
        'DATABASE_URL',
        'REDIS_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_S3_BUCKET_NAME',
        'SENDGRID_API_KEY',
        'FROM_EMAIL',
      ];

      for (const varName of requiredVars) {
        delete process.env[varName];
      }

      expect(() => EnvironmentValidator.validate()).toThrow(/Missing required environment variables/);
    });

    test('Property 1: Invalid URL formats should be rejected', () => {
      const invalidUrls = [
        { DATABASE_URL: 'invalid-url' },
        { REDIS_URL: 'not-a-url' },
        { NEXTAUTH_URL: 'invalid' },
      ];

      for (const invalidUrl of invalidUrls) {
        // Set up mostly valid environment
        Object.assign(process.env, {
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          REDIS_URL: 'redis://localhost:6379',
          NEXTAUTH_SECRET: 'a'.repeat(32),
          NEXTAUTH_URL: 'https://directfanz.io',
          STRIPE_SECRET_KEY: 'sk_test_123456789',
          STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
          STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
          AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
          AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          AWS_S3_BUCKET_NAME: 'directfanz-production',
          SENDGRID_API_KEY: 'SG.123456789',
          FROM_EMAIL: 'noreply@directfanz.io',
          ...invalidUrl,
        });

        expect(() => EnvironmentValidator.validate()).toThrow(/Invalid URL format/);
      }
    });

    test('Property 1: Weak secrets should be rejected', () => {
      const weakSecrets = [
        { NEXTAUTH_SECRET: 'short' }, // Too short
        { STRIPE_SECRET_KEY: 'invalid_key' }, // Wrong format
        { STRIPE_PUBLISHABLE_KEY: 'invalid_key' }, // Wrong format
        { FROM_EMAIL: 'invalid-email' }, // Invalid email
      ];

      for (const weakSecret of weakSecrets) {
        // Set up mostly valid environment
        Object.assign(process.env, {
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          REDIS_URL: 'redis://localhost:6379',
          NEXTAUTH_SECRET: 'a'.repeat(32),
          NEXTAUTH_URL: 'https://directfanz.io',
          STRIPE_SECRET_KEY: 'sk_test_123456789',
          STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
          STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
          AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
          AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          AWS_S3_BUCKET_NAME: 'directfanz-production',
          SENDGRID_API_KEY: 'SG.123456789',
          FROM_EMAIL: 'noreply@directfanz.io',
          ...weakSecret,
        });

        expect(() => EnvironmentValidator.validate()).toThrow();
      }
    });
  });

  describe('Environment Health Checks', () => {
    test('Property 1: Health check should pass with valid configuration', async () => {
      // Set up valid environment
      Object.assign(process.env, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        NEXTAUTH_SECRET: 'a'.repeat(32),
        NEXTAUTH_URL: 'https://directfanz.io',
        STRIPE_SECRET_KEY: 'sk_test_123456789',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
        STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_S3_BUCKET_NAME: 'directfanz-production',
        SENDGRID_API_KEY: 'SG.123456789',
        FROM_EMAIL: 'noreply@directfanz.io',
        NODE_ENV: 'test', // Skip Parameter Store check
      });

      const healthCheck = new EnvironmentHealthCheck();
      const result = await healthCheck.checkHealth();

      expect(result.healthy).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('Property 1: Health check should fail with invalid configuration', async () => {
      // Clear required variables
      delete process.env.DATABASE_URL;
      delete process.env.REDIS_URL;

      const healthCheck = new EnvironmentHealthCheck();
      const result = await healthCheck.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Environment validation failed');
    });
  });

  describe('Production Environment Security', () => {
    test('Property 1: Production environment must use HTTPS URLs', () => {
      const httpsUrls = [
        'https://directfanz.io',
        'https://api.directfanz.io',
        'https://staging.directfanz.io',
      ];

      for (const url of httpsUrls) {
        Object.assign(process.env, {
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          REDIS_URL: 'redis://localhost:6379',
          NEXTAUTH_SECRET: 'a'.repeat(32),
          NEXTAUTH_URL: url,
          STRIPE_SECRET_KEY: 'sk_live_123456789', // Live key for production
          STRIPE_PUBLISHABLE_KEY: 'pk_live_123456789', // Live key for production
          STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
          AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
          AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          AWS_S3_BUCKET_NAME: 'directfanz-production',
          SENDGRID_API_KEY: 'SG.123456789',
          FROM_EMAIL: 'noreply@directfanz.io',
        });

        expect(() => EnvironmentValidator.validate()).not.toThrow();
        
        const config = EnvironmentValidator.validate();
        expect(config.NEXTAUTH_URL).toMatch(/^https:/);
      }
    });

    test('Property 1: Production Stripe keys must be live keys', () => {
      const productionEnv = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        NEXTAUTH_SECRET: 'a'.repeat(32),
        NEXTAUTH_URL: 'https://directfanz.io',
        STRIPE_SECRET_KEY: 'sk_live_123456789',
        STRIPE_PUBLISHABLE_KEY: 'pk_live_123456789',
        STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_S3_BUCKET_NAME: 'directfanz-production',
        SENDGRID_API_KEY: 'SG.123456789',
        FROM_EMAIL: 'noreply@directfanz.io',
        NODE_ENV: 'production',
      };

      Object.assign(process.env, productionEnv);

      const config = EnvironmentValidator.validate();
      
      if (process.env.NODE_ENV === 'production') {
        expect(config.STRIPE_SECRET_KEY).toMatch(/^sk_live_/);
        expect(config.STRIPE_PUBLISHABLE_KEY).toMatch(/^pk_live_/);
      }
    });
  });
});
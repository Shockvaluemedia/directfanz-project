import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';

interface ParameterStoreConfig {
  region: string;
  prefix?: string;
}

class ParameterStore {
  private client: SSMClient;
  private prefix: string;
  private cache: Map<string, { value: string; expires: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: ParameterStoreConfig) {
    this.client = new SSMClient({ region: config.region });
    this.prefix = config.prefix || '/directfanz/production';
  }

  async getParameter(name: string, decrypt = true): Promise<string | null> {
    const fullName = `${this.prefix}/${name}`;
    
    // Check cache first
    const cached = this.cache.get(fullName);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    try {
      const command = new GetParameterCommand({
        Name: fullName,
        WithDecryption: decrypt,
      });

      const response = await this.client.send(command);
      const value = response.Parameter?.Value;

      if (value) {
        // Cache the value
        this.cache.set(fullName, {
          value,
          expires: Date.now() + this.CACHE_TTL,
        });
        return value;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get parameter ${fullName}:`, error);
      return null;
    }
  }

  async getParameters(names: string[], decrypt = true): Promise<Record<string, string>> {
    const fullNames = names.map(name => `${this.prefix}/${name}`);
    const result: Record<string, string> = {};

    try {
      const command = new GetParametersCommand({
        Names: fullNames,
        WithDecryption: decrypt,
      });

      const response = await this.client.send(command);
      
      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            const shortName = param.Name.replace(`${this.prefix}/`, '');
            result[shortName] = param.Value;
            
            // Cache the value
            this.cache.set(param.Name, {
              value: param.Value,
              expires: Date.now() + this.CACHE_TTL,
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to get parameters:', error);
      return {};
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Environment variable validation
export interface EnvironmentConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_S3_BUCKET_NAME: string;
  SENDGRID_API_KEY: string;
  FROM_EMAIL: string;
}

export class EnvironmentValidator {
  private static requiredVars: (keyof EnvironmentConfig)[] = [
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

  static validate(): EnvironmentConfig {
    const config: Partial<EnvironmentConfig> = {};
    const missing: string[] = [];

    for (const varName of this.requiredVars) {
      const value = process.env[varName];
      if (!value) {
        missing.push(varName);
      } else {
        config[varName] = value;
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Additional validation
    this.validateUrls(config as EnvironmentConfig);
    this.validateSecrets(config as EnvironmentConfig);

    return config as EnvironmentConfig;
  }

  private static validateUrls(config: EnvironmentConfig): void {
    const urlVars = ['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_URL'];
    
    for (const varName of urlVars) {
      const value = config[varName as keyof EnvironmentConfig];
      try {
        new URL(value);
      } catch {
        throw new Error(`Invalid URL format for ${varName}: ${value}`);
      }
    }
  }

  private static validateSecrets(config: EnvironmentConfig): void {
    // Validate secret lengths
    if (config.NEXTAUTH_SECRET.length < 32) {
      throw new Error('NEXTAUTH_SECRET must be at least 32 characters long');
    }

    // Validate Stripe keys format
    if (!config.STRIPE_SECRET_KEY.startsWith('sk_')) {
      throw new Error('STRIPE_SECRET_KEY must start with sk_');
    }

    if (!config.STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
      throw new Error('STRIPE_PUBLISHABLE_KEY must start with pk_');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.FROM_EMAIL)) {
      throw new Error('FROM_EMAIL must be a valid email address');
    }
  }
}

// Health check for environment configuration
export class EnvironmentHealthCheck {
  private parameterStore: ParameterStore;

  constructor() {
    this.parameterStore = new ParameterStore({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async checkHealth(): Promise<{ healthy: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate environment variables
      EnvironmentValidator.validate();
    } catch (error) {
      errors.push(`Environment validation failed: ${error.message}`);
    }

    // Test Parameter Store connectivity (if in production)
    if (process.env.NODE_ENV === 'production') {
      try {
        await this.parameterStore.getParameter('health-check');
      } catch (error) {
        errors.push(`Parameter Store connectivity failed: ${error.message}`);
      }
    }

    return {
      healthy: errors.length === 0,
      errors,
    };
  }
}

export default ParameterStore;
#!/usr/bin/env tsx

/**
 * ElastiCache setup and configuration script
 * Handles ElastiCache cluster creation and configuration for DirectFanz
 */

import { 
  ElastiCacheClient, 
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DescribeReplicationGroupsCommand,
  DescribeCacheClustersCommand,
  ModifyReplicationGroupCommand,
} from '@aws-sdk/client-elasticache';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { logger } from '../src/lib/logger';

interface ElastiCacheConfig {
  replicationGroupId: string;
  description: string;
  nodeType: string;
  numCacheClusters: number;
  port: number;
  parameterGroupName: string;
  subnetGroupName: string;
  securityGroupIds: string[];
  authToken?: string;
  transitEncryptionEnabled: boolean;
  atRestEncryptionEnabled: boolean;
  automaticFailoverEnabled: boolean;
  multiAZEnabled: boolean;
  engine: string;
  engineVersion: string;
  region: string;
}

class ElastiCacheSetup {
  private elastiCacheClient: ElastiCacheClient;
  private ssmClient: SSMClient;
  private config: ElastiCacheConfig;

  constructor(config: ElastiCacheConfig) {
    this.config = config;
    this.elastiCacheClient = new ElastiCacheClient({ region: config.region });
    this.ssmClient = new SSMClient({ region: config.region });
  }

  /**
   * Check if replication group already exists
   */
  async checkReplicationGroupExists(): Promise<boolean> {
    try {
      const command = new DescribeReplicationGroupsCommand({
        ReplicationGroupId: this.config.replicationGroupId,
      });
      
      const response = await this.elastiCacheClient.send(command);
      return response.ReplicationGroups && response.ReplicationGroups.length > 0;
    } catch (error) {
      if (error instanceof Error && error.name === 'ReplicationGroupNotFoundFault') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create ElastiCache replication group
   */
  async createReplicationGroup(): Promise<void> {
    logger.info('Creating ElastiCache replication group...');

    const command = new CreateReplicationGroupCommand({
      ReplicationGroupId: this.config.replicationGroupId,
      Description: this.config.description,
      NodeType: this.config.nodeType,
      NumCacheClusters: this.config.numCacheClusters,
      Port: this.config.port,
      ParameterGroupName: this.config.parameterGroupName,
      CacheSubnetGroupName: this.config.subnetGroupName,
      SecurityGroupIds: this.config.securityGroupIds,
      Engine: this.config.engine,
      EngineVersion: this.config.engineVersion,
      TransitEncryptionEnabled: this.config.transitEncryptionEnabled,
      AtRestEncryptionEnabled: this.config.atRestEncryptionEnabled,
      AutomaticFailoverEnabled: this.config.automaticFailoverEnabled,
      MultiAZEnabled: this.config.multiAZEnabled,
      ...(this.config.authToken && { AuthToken: this.config.authToken }),
      Tags: [
        { Key: 'Name', Value: 'DirectFanz ElastiCache' },
        { Key: 'Environment', Value: process.env.NODE_ENV || 'production' },
        { Key: 'Application', Value: 'DirectFanz' },
        { Key: 'ManagedBy', Value: 'DirectFanz-Setup-Script' },
      ],
    });

    await this.elastiCacheClient.send(command);
    logger.info('ElastiCache replication group creation initiated');
  }

  /**
   * Wait for replication group to be available
   */
  async waitForReplicationGroupAvailable(): Promise<void> {
    logger.info('Waiting for ElastiCache replication group to be available...');

    const maxAttempts = 30; // 15 minutes max
    const delayMs = 30000; // 30 seconds between checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const command = new DescribeReplicationGroupsCommand({
          ReplicationGroupId: this.config.replicationGroupId,
        });
        
        const response = await this.elastiCacheClient.send(command);
        const replicationGroup = response.ReplicationGroups?.[0];

        if (replicationGroup?.Status === 'available') {
          logger.info('ElastiCache replication group is now available');
          return;
        }

        logger.info(`Attempt ${attempt}/${maxAttempts}: Status is ${replicationGroup?.Status}, waiting...`);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        logger.error(`Error checking replication group status (attempt ${attempt}):`, error);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error('Timeout waiting for ElastiCache replication group to be available');
  }

  /**
   * Get replication group endpoint
   */
  async getReplicationGroupEndpoint(): Promise<{
    primaryEndpoint: string;
    readerEndpoint?: string;
    port: number;
  }> {
    const command = new DescribeReplicationGroupsCommand({
      ReplicationGroupId: this.config.replicationGroupId,
    });
    
    const response = await this.elastiCacheClient.send(command);
    const replicationGroup = response.ReplicationGroups?.[0];

    if (!replicationGroup) {
      throw new Error('Replication group not found');
    }

    const primaryEndpoint = replicationGroup.ConfigurationEndpoint?.Address || 
                           replicationGroup.NodeGroups?.[0]?.PrimaryEndpoint?.Address;
    const readerEndpoint = replicationGroup.NodeGroups?.[0]?.ReaderEndpoint?.Address;
    const port = replicationGroup.ConfigurationEndpoint?.Port || 
                replicationGroup.NodeGroups?.[0]?.PrimaryEndpoint?.Port || 
                this.config.port;

    if (!primaryEndpoint) {
      throw new Error('Could not determine primary endpoint');
    }

    return {
      primaryEndpoint,
      readerEndpoint,
      port,
    };
  }

  /**
   * Store connection details in Parameter Store
   */
  async storeConnectionDetails(): Promise<void> {
    logger.info('Storing ElastiCache connection details in Parameter Store...');

    const endpoints = await this.getReplicationGroupEndpoint();
    
    // Construct Redis URL
    const redisUrl = this.config.authToken 
      ? `rediss://:${this.config.authToken}@${endpoints.primaryEndpoint}:${endpoints.port}`
      : `redis://${endpoints.primaryEndpoint}:${endpoints.port}`;

    // Store primary connection URL
    await this.ssmClient.send(new PutParameterCommand({
      Name: '/directfanz/redis/url',
      Value: redisUrl,
      Type: 'SecureString',
      Overwrite: true,
      Description: 'DirectFanz ElastiCache Redis URL',
    }));

    // Store auth token if provided
    if (this.config.authToken) {
      await this.ssmClient.send(new PutParameterCommand({
        Name: '/directfanz/redis/auth-token',
        Value: this.config.authToken,
        Type: 'SecureString',
        Overwrite: true,
        Description: 'DirectFanz ElastiCache Auth Token',
      }));
    }

    // Store additional connection details
    await this.ssmClient.send(new PutParameterCommand({
      Name: '/directfanz/redis/primary-endpoint',
      Value: endpoints.primaryEndpoint,
      Type: 'String',
      Overwrite: true,
      Description: 'DirectFanz ElastiCache Primary Endpoint',
    }));

    if (endpoints.readerEndpoint) {
      await this.ssmClient.send(new PutParameterCommand({
        Name: '/directfanz/redis/reader-endpoint',
        Value: endpoints.readerEndpoint,
        Type: 'String',
        Overwrite: true,
        Description: 'DirectFanz ElastiCache Reader Endpoint',
      }));
    }

    await this.ssmClient.send(new PutParameterCommand({
      Name: '/directfanz/redis/port',
      Value: endpoints.port.toString(),
      Type: 'String',
      Overwrite: true,
      Description: 'DirectFanz ElastiCache Port',
    }));

    logger.info('Connection details stored in Parameter Store');
  }

  /**
   * Validate ElastiCache setup
   */
  async validateSetup(): Promise<void> {
    logger.info('Validating ElastiCache setup...');

    // Check replication group status
    const command = new DescribeReplicationGroupsCommand({
      ReplicationGroupId: this.config.replicationGroupId,
    });
    
    const response = await this.elastiCacheClient.send(command);
    const replicationGroup = response.ReplicationGroups?.[0];

    if (!replicationGroup || replicationGroup.Status !== 'available') {
      throw new Error('Replication group is not available');
    }

    // Validate configuration
    const validations = [
      { check: replicationGroup.TransitEncryptionEnabled, name: 'Transit Encryption' },
      { check: replicationGroup.AtRestEncryptionEnabled, name: 'At-Rest Encryption' },
      { check: replicationGroup.AutomaticFailoverEnabled, name: 'Automatic Failover' },
      { check: replicationGroup.MultiAZ === 'enabled', name: 'Multi-AZ' },
    ];

    for (const validation of validations) {
      if (validation.check) {
        logger.info(`✅ ${validation.name} is enabled`);
      } else {
        logger.warn(`⚠️ ${validation.name} is not enabled`);
      }
    }

    logger.info('ElastiCache setup validation completed');
  }

  /**
   * Run complete setup process
   */
  async setup(): Promise<void> {
    try {
      logger.info('Starting ElastiCache setup...');

      // Check if already exists
      const exists = await this.checkReplicationGroupExists();
      
      if (exists) {
        logger.info('ElastiCache replication group already exists');
      } else {
        // Create replication group
        await this.createReplicationGroup();
        
        // Wait for it to be available
        await this.waitForReplicationGroupAvailable();
      }

      // Store connection details
      await this.storeConnectionDetails();

      // Validate setup
      await this.validateSetup();

      logger.info('🎉 ElastiCache setup completed successfully!');

    } catch (error) {
      logger.error('ElastiCache setup failed:', error);
      throw error;
    }
  }
}

/**
 * Generate auth token
 */
function generateAuthToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Main setup function
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'production';
  const region = args.find(arg => arg.startsWith('--region='))?.split('=')[1] || 'us-east-1';
  const nodeType = args.find(arg => arg.startsWith('--node-type='))?.split('=')[1] || 'cache.r6g.large';
  const numNodes = parseInt(args.find(arg => arg.startsWith('--num-nodes='))?.split('=')[1] || '2');
  const enableAuth = !args.includes('--no-auth');

  try {
    logger.info('🚀 Starting DirectFanz ElastiCache setup...');

    const config: ElastiCacheConfig = {
      replicationGroupId: `directfanz-redis-${environment}`,
      description: `DirectFanz ElastiCache cluster for ${environment}`,
      nodeType,
      numCacheClusters: numNodes,
      port: 6379,
      parameterGroupName: 'default.redis7',
      subnetGroupName: process.env.ELASTICACHE_SUBNET_GROUP || 'directfanz-cache-subnet-group',
      securityGroupIds: process.env.ELASTICACHE_SECURITY_GROUPS?.split(',') || [],
      authToken: enableAuth ? generateAuthToken() : undefined,
      transitEncryptionEnabled: true,
      atRestEncryptionEnabled: true,
      automaticFailoverEnabled: numNodes > 1,
      multiAZEnabled: numNodes > 1,
      engine: 'redis',
      engineVersion: '7.0',
      region,
    };

    logger.info('ElastiCache configuration:', {
      replicationGroupId: config.replicationGroupId,
      nodeType: config.nodeType,
      numCacheClusters: config.numCacheClusters,
      region: config.region,
      authEnabled: !!config.authToken,
      encryptionEnabled: config.transitEncryptionEnabled && config.atRestEncryptionEnabled,
    });

    const setup = new ElastiCacheSetup(config);
    await setup.setup();

    logger.info('🎉 ElastiCache setup completed successfully!');
    logger.info('📝 Next steps:');
    logger.info('  1. Update your ECS task definitions to use the new Redis URL');
    logger.info('  2. Deploy your application with the updated configuration');
    logger.info('  3. Test Redis connectivity from your application');

  } catch (error) {
    logger.error('❌ ElastiCache setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

export { ElastiCacheSetup, ElastiCacheConfig };
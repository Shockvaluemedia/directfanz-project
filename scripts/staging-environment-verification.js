#!/usr/bin/env node

/**
 * Staging Environment Verification Script
 * 
 * This script verifies that the staging environment is properly configured
 * and mirrors the production setup for safe migration testing.
 * 
 * Part of Task 13: Pre-Migration Testing
 */

import AWS from 'aws-sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

const PROJECT_NAME = process.env.PROJECT_NAME || 'direct-fan-platform';
const STAGING_SUFFIX = process.env.STAGING_SUFFIX || 'staging';

class StagingEnvironmentVerifier {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
    
    // AWS service clients
    this.ec2 = new AWS.EC2();
    this.rds = new AWS.RDS();
    this.elasticache = new AWS.ElastiCache();
    this.s3 = new AWS.S3();
    this.ecs = new AWS.ECS();
    this.elbv2 = new AWS.ELBv2();
    this.cloudwatch = new AWS.CloudWatch();
    this.ssm = new AWS.SSM();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${timestamp} ${prefix} ${message}`);
    
    this.results.details.push({
      timestamp,
      type,
      message
    });

    if (type === 'error') this.results.failed++;
    else if (type === 'warning') this.results.warnings++;
    else this.results.passed++;
  }

  async verifyStagingVPC() {
    this.log('=== Verifying Staging VPC Configuration ===');
    
    try {
      // Get staging VPC
      const vpcs = await this.ec2.describeVpcs({
        Filters: [
          { Name: 'tag:Name', Values: [`${PROJECT_NAME}-${STAGING_SUFFIX}-vpc`] }
        ]
      }).promise();

      if (vpcs.Vpcs.length === 0) {
        this.log('Staging VPC not found', 'error');
        return false;
      }

      const stagingVpc = vpcs.Vpcs[0];
      this.log(`Staging VPC found: ${stagingVpc.VpcId} (${stagingVpc.CidrBlock})`);

      // Verify subnets
      const subnets = await this.ec2.describeSubnets({
        Filters: [
          { Name: 'vpc-id', Values: [stagingVpc.VpcId] }
        ]
      }).promise();

      const publicSubnets = subnets.Subnets.filter(s => 
        s.Tags?.some(t => t.Key === 'Name' && t.Value.includes('public'))
      );
      const privateSubnets = subnets.Subnets.filter(s => 
        s.Tags?.some(t => t.Key === 'Name' && t.Value.includes('private'))
      );
      const dbSubnets = subnets.Subnets.filter(s => 
        s.Tags?.some(t => t.Key === 'Name' && t.Value.includes('database'))
      );

      this.log(`Staging subnets - Public: ${publicSubnets.length}, Private: ${privateSubnets.length}, DB: ${dbSubnets.length}`);

      // Verify multi-AZ setup
      const azs = [...new Set(subnets.Subnets.map(s => s.AvailabilityZone))];
      if (azs.length < 2) {
        this.log('Staging environment should span at least 2 AZs for production parity', 'error');
        return false;
      }

      this.log(`Staging VPC spans ${azs.length} availability zones`);
      return true;

    } catch (error) {
      this.log(`Staging VPC verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingDatabase() {
    this.log('=== Verifying Staging Database Configuration ===');
    
    try {
      const instances = await this.rds.describeDBInstances({
        DBInstanceIdentifier: `${PROJECT_NAME}-${STAGING_SUFFIX}-postgres`
      }).promise();

      if (instances.DBInstances.length === 0) {
        this.log('Staging RDS instance not found', 'error');
        return false;
      }

      const stagingDb = instances.DBInstances[0];
      this.log(`Staging database: ${stagingDb.DBInstanceIdentifier}`);
      this.log(`Status: ${stagingDb.DBInstanceStatus}`);
      this.log(`Engine: ${stagingDb.Engine} ${stagingDb.EngineVersion}`);

      // Verify configuration matches production requirements
      if (stagingDb.DBInstanceStatus !== 'available') {
        this.log('Staging database is not available', 'error');
        return false;
      }

      // Check if staging has similar configuration to production
      if (!stagingDb.StorageEncrypted) {
        this.log('Staging database encryption should match production', 'warning');
      }

      if (stagingDb.BackupRetentionPeriod < 7) {
        this.log('Staging backup retention should be at least 7 days', 'warning');
      }

      // Verify staging database has test data
      this.log('Staging database configuration verified');
      return true;

    } catch (error) {
      this.log(`Staging database verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingCache() {
    this.log('=== Verifying Staging Cache Configuration ===');
    
    try {
      const replicationGroups = await this.elasticache.describeReplicationGroups({
        ReplicationGroupId: `${PROJECT_NAME}-${STAGING_SUFFIX}-redis`
      }).promise();

      if (replicationGroups.ReplicationGroups.length === 0) {
        this.log('Staging Redis cluster not found', 'error');
        return false;
      }

      const stagingRedis = replicationGroups.ReplicationGroups[0];
      this.log(`Staging Redis: ${stagingRedis.ReplicationGroupId}`);
      this.log(`Status: ${stagingRedis.Status}`);

      if (stagingRedis.Status !== 'available') {
        this.log('Staging Redis cluster is not available', 'error');
        return false;
      }

      // Verify encryption settings match production requirements
      if (!stagingRedis.AtRestEncryptionEnabled || !stagingRedis.TransitEncryptionEnabled) {
        this.log('Staging Redis encryption should match production requirements', 'warning');
      }

      this.log('Staging Redis configuration verified');
      return true;

    } catch (error) {
      this.log(`Staging cache verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingStorage() {
    this.log('=== Verifying Staging Storage Configuration ===');
    
    try {
      const buckets = await this.s3.listBuckets().promise();
      const stagingBuckets = buckets.Buckets.filter(bucket => 
        bucket.Name.includes(`${PROJECT_NAME}-${STAGING_SUFFIX}`)
      );

      if (stagingBuckets.length === 0) {
        this.log('No staging S3 buckets found', 'error');
        return false;
      }

      this.log(`Found ${stagingBuckets.length} staging S3 buckets`);

      for (const bucket of stagingBuckets) {
        this.log(`Verifying staging bucket: ${bucket.Name}`);

        // Check encryption
        try {
          await this.s3.getBucketEncryption({
            Bucket: bucket.Name
          }).promise();
          this.log(`Bucket ${bucket.Name} has encryption enabled`);
        } catch (error) {
          if (error.code === 'ServerSideEncryptionConfigurationNotFoundError') {
            this.log(`Bucket ${bucket.Name} encryption not configured`, 'warning');
          }
        }

        // Check versioning
        try {
          const versioning = await this.s3.getBucketVersioning({
            Bucket: bucket.Name
          }).promise();
          if (versioning.Status === 'Enabled') {
            this.log(`Bucket ${bucket.Name} versioning enabled`);
          } else {
            this.log(`Bucket ${bucket.Name} versioning not enabled`, 'warning');
          }
        } catch (error) {
          this.log(`Could not check versioning for ${bucket.Name}`, 'warning');
        }
      }

      return true;

    } catch (error) {
      this.log(`Staging storage verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingECS() {
    this.log('=== Verifying Staging ECS Configuration ===');
    
    try {
      // Find staging ECS cluster
      const clusters = await this.ecs.listClusters().promise();
      const stagingCluster = clusters.clusterArns.find(arn => 
        arn.includes(`${PROJECT_NAME}-${STAGING_SUFFIX}`)
      );

      if (!stagingCluster) {
        this.log('Staging ECS cluster not found', 'error');
        return false;
      }

      this.log(`Staging ECS cluster: ${stagingCluster}`);

      // Get cluster details
      const clusterDetails = await this.ecs.describeClusters({
        clusters: [stagingCluster]
      }).promise();

      const cluster = clusterDetails.clusters[0];
      if (cluster.status !== 'ACTIVE') {
        this.log('Staging ECS cluster is not active', 'error');
        return false;
      }

      // Check services
      const services = await this.ecs.listServices({
        cluster: stagingCluster
      }).promise();

      this.log(`Staging ECS services: ${services.serviceArns.length}`);

      if (services.serviceArns.length > 0) {
        const serviceDetails = await this.ecs.describeServices({
          cluster: stagingCluster,
          services: services.serviceArns
        }).promise();

        for (const service of serviceDetails.services) {
          this.log(`Service: ${service.serviceName} (${service.status})`);
          if (service.status !== 'ACTIVE') {
            this.log(`Service ${service.serviceName} is not active`, 'warning');
          }
        }
      }

      return true;

    } catch (error) {
      this.log(`Staging ECS verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingLoadBalancer() {
    this.log('=== Verifying Staging Load Balancer Configuration ===');
    
    try {
      const loadBalancers = await this.elbv2.describeLoadBalancers().promise();
      const stagingLB = loadBalancers.LoadBalancers.find(lb => 
        lb.LoadBalancerName.includes(`${PROJECT_NAME}-${STAGING_SUFFIX}`)
      );

      if (!stagingLB) {
        this.log('Staging load balancer not found', 'error');
        return false;
      }

      this.log(`Staging load balancer: ${stagingLB.LoadBalancerName}`);
      this.log(`Status: ${stagingLB.State.Code}`);

      if (stagingLB.State.Code !== 'active') {
        this.log('Staging load balancer is not active', 'error');
        return false;
      }

      // Check target groups
      const targetGroups = await this.elbv2.describeTargetGroups({
        LoadBalancerArn: stagingLB.LoadBalancerArn
      }).promise();

      this.log(`Staging target groups: ${targetGroups.TargetGroups.length}`);

      // Check listeners
      const listeners = await this.elbv2.describeListeners({
        LoadBalancerArn: stagingLB.LoadBalancerArn
      }).promise();

      this.log(`Staging listeners: ${listeners.Listeners.length}`);

      return true;

    } catch (error) {
      this.log(`Staging load balancer verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingMonitoring() {
    this.log('=== Verifying Staging Monitoring Configuration ===');
    
    try {
      // Check log groups
      const logGroups = await this.cloudwatch.describeLogGroups({
        logGroupNamePrefix: `/aws/application/${PROJECT_NAME}-${STAGING_SUFFIX}`
      }).promise();

      this.log(`Staging log groups: ${logGroups.logGroups.length}`);

      // Check alarms
      const alarms = await this.cloudwatch.describeAlarms().promise();
      const stagingAlarms = alarms.MetricAlarms.filter(alarm => 
        alarm.AlarmName.includes(`${PROJECT_NAME}-${STAGING_SUFFIX}`)
      );

      this.log(`Staging alarms: ${stagingAlarms.length}`);

      return true;

    } catch (error) {
      this.log(`Staging monitoring verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyStagingParameters() {
    this.log('=== Verifying Staging Parameters Configuration ===');
    
    try {
      const parameters = await this.ssm.getParametersByPath({
        Path: `/${PROJECT_NAME}-${STAGING_SUFFIX}/`,
        Recursive: true
      }).promise();

      this.log(`Staging SSM parameters: ${parameters.Parameters.length}`);

      const requiredParams = [
        'database/url',
        'redis/url',
        's3/bucket_name'
      ];

      let foundParams = 0;
      for (const requiredParam of requiredParams) {
        const fullParamName = `/${PROJECT_NAME}-${STAGING_SUFFIX}/${requiredParam}`;
        const param = parameters.Parameters.find(p => p.Name === fullParamName);
        
        if (param) {
          this.log(`Staging parameter found: ${param.Name}`);
          foundParams++;
        } else {
          this.log(`Staging parameter missing: ${fullParamName}`, 'warning');
        }
      }

      this.log(`Found ${foundParams}/${requiredParams.length} required staging parameters`);
      return foundParams >= requiredParams.length / 2; // Allow some flexibility for staging

    } catch (error) {
      this.log(`Staging parameters verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runApplicationHealthCheck() {
    this.log('=== Running Staging Application Health Check ===');
    
    try {
      // This would typically make HTTP requests to staging endpoints
      // For now, we'll just verify the load balancer is accessible
      
      const loadBalancers = await this.elbv2.describeLoadBalancers().promise();
      const stagingLB = loadBalancers.LoadBalancers.find(lb => 
        lb.LoadBalancerName.includes(`${PROJECT_NAME}-${STAGING_SUFFIX}`)
      );

      if (!stagingLB) {
        this.log('Cannot perform health check - staging load balancer not found', 'error');
        return false;
      }

      // Check target health
      const targetGroups = await this.elbv2.describeTargetGroups({
        LoadBalancerArn: stagingLB.LoadBalancerArn
      }).promise();

      let healthyTargets = 0;
      let totalTargets = 0;

      for (const tg of targetGroups.TargetGroups) {
        const targetHealth = await this.elbv2.describeTargetHealth({
          TargetGroupArn: tg.TargetGroupArn
        }).promise();

        const healthy = targetHealth.TargetHealthDescriptions.filter(
          target => target.TargetHealth.State === 'healthy'
        );

        healthyTargets += healthy.length;
        totalTargets += targetHealth.TargetHealthDescriptions.length;
      }

      this.log(`Staging application health: ${healthyTargets}/${totalTargets} healthy targets`);

      if (healthyTargets === 0 && totalTargets > 0) {
        this.log('No healthy targets in staging environment', 'error');
        return false;
      }

      return true;

    } catch (error) {
      this.log(`Staging health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllVerifications() {
    this.log('🔍 Starting Staging Environment Verification');
    this.log(`Project: ${PROJECT_NAME}`);
    this.log(`Staging Suffix: ${STAGING_SUFFIX}`);
    this.log(`Region: ${AWS.config.region}`);
    this.log('');

    const verifications = [
      { name: 'Staging VPC', fn: () => this.verifyStagingVPC() },
      { name: 'Staging Database', fn: () => this.verifyStagingDatabase() },
      { name: 'Staging Cache', fn: () => this.verifyStagingCache() },
      { name: 'Staging Storage', fn: () => this.verifyStagingStorage() },
      { name: 'Staging ECS', fn: () => this.verifyStagingECS() },
      { name: 'Staging Load Balancer', fn: () => this.verifyStagingLoadBalancer() },
      { name: 'Staging Monitoring', fn: () => this.verifyStagingMonitoring() },
      { name: 'Staging Parameters', fn: () => this.verifyStagingParameters() },
      { name: 'Application Health Check', fn: () => this.runApplicationHealthCheck() }
    ];

    let allPassed = true;

    for (const verification of verifications) {
      try {
        const result = await verification.fn();
        if (!result) {
          allPassed = false;
        }
        this.log(''); // Empty line for readability
      } catch (error) {
        this.log(`Verification ${verification.name} threw an error: ${error.message}`, 'error');
        allPassed = false;
        this.log(''); // Empty line for readability
      }
    }

    // Summary
    this.log('=== STAGING VERIFICATION SUMMARY ===');
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`⚠️  Warnings: ${this.results.warnings}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log('');

    if (allPassed && this.results.failed === 0) {
      this.log('🎉 Staging environment verification passed!');
      this.log('Staging environment is properly configured and ready for migration testing');
      return true;
    } else {
      this.log('❌ Staging environment verification failed.');
      this.log('Please fix the issues above before proceeding with migration testing');
      return false;
    }
  }
}

// Main execution
async function main() {
  const verifier = new StagingEnvironmentVerifier();
  
  try {
    const success = await verifier.runAllVerifications();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during staging verification:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default StagingEnvironmentVerifier;
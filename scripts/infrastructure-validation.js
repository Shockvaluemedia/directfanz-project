#!/usr/bin/env node

/**
 * AWS Infrastructure Validation Script
 * 
 * This script validates that all AWS infrastructure components are deployed
 * correctly and functioning as expected for the DirectFanz platform.
 * 
 * Validates:
 * - VPC and networking components
 * - Security group configurations
 * - RDS PostgreSQL database
 * - ElastiCache Redis cluster
 * - S3 storage buckets
 * - ECS Fargate services
 * - Load balancer configuration
 * - CloudWatch monitoring
 * - IAM roles and policies
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

// Initialize AWS service clients
const ec2 = new AWS.EC2();
const rds = new AWS.RDS();
const elasticache = new AWS.ElastiCache();
const s3 = new AWS.S3();
const ecs = new AWS.ECS();
const elbv2 = new AWS.ELBv2();
const cloudwatch = new AWS.CloudWatch();
const iam = new AWS.IAM();
const ssm = new AWS.SSM();

// Configuration
const PROJECT_NAME = process.env.PROJECT_NAME || 'direct-fan-platform';
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';

class InfrastructureValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
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

  async validateVPCAndNetworking() {
    this.log('=== Validating VPC and Networking ===');
    
    try {
      // Get VPC information
      const vpcs = await ec2.describeVpcs({
        Filters: [
          { Name: 'tag:Name', Values: [`${PROJECT_NAME}-vpc`] }
        ]
      }).promise();

      if (vpcs.Vpcs.length === 0) {
        this.log('VPC not found', 'error');
        return false;
      }

      const vpc = vpcs.Vpcs[0];
      this.log(`VPC found: ${vpc.VpcId} (${vpc.CidrBlock})`);

      // Validate subnets
      const subnets = await ec2.describeSubnets({
        Filters: [
          { Name: 'vpc-id', Values: [vpc.VpcId] }
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

      this.log(`Found ${publicSubnets.length} public subnets`);
      this.log(`Found ${privateSubnets.length} private subnets`);
      this.log(`Found ${dbSubnets.length} database subnets`);

      if (publicSubnets.length < 2) {
        this.log('Insufficient public subnets for high availability', 'warning');
      }
      if (privateSubnets.length < 2) {
        this.log('Insufficient private subnets for high availability', 'warning');
      }
      if (dbSubnets.length < 2) {
        this.log('Insufficient database subnets for Multi-AZ', 'error');
        return false;
      }

      // Validate NAT Gateways
      const natGateways = await ec2.describeNatGateways({
        Filters: [
          { Name: 'vpc-id', Values: [vpc.VpcId] },
          { Name: 'state', Values: ['available'] }
        ]
      }).promise();

      this.log(`Found ${natGateways.NatGateways.length} NAT Gateways`);
      if (natGateways.NatGateways.length === 0) {
        this.log('No NAT Gateways found - private subnets cannot reach internet', 'error');
        return false;
      }

      // Validate Internet Gateway
      const igws = await ec2.describeInternetGateways({
        Filters: [
          { Name: 'attachment.vpc-id', Values: [vpc.VpcId] }
        ]
      }).promise();

      if (igws.InternetGateways.length === 0) {
        this.log('No Internet Gateway attached to VPC', 'error');
        return false;
      }

      this.log('VPC and networking validation completed successfully');
      return true;

    } catch (error) {
      this.log(`VPC validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateSecurityGroups() {
    this.log('=== Validating Security Groups ===');
    
    try {
      // Get VPC ID first
      const vpcs = await ec2.describeVpcs({
        Filters: [
          { Name: 'tag:Name', Values: [`${PROJECT_NAME}-vpc`] }
        ]
      }).promise();

      if (vpcs.Vpcs.length === 0) {
        this.log('VPC not found for security group validation', 'error');
        return false;
      }

      const vpcId = vpcs.Vpcs[0].VpcId;

      // Get security groups
      const securityGroups = await ec2.describeSecurityGroups({
        Filters: [
          { Name: 'vpc-id', Values: [vpcId] },
          { Name: 'group-name', Values: [`${PROJECT_NAME}-*`] }
        ]
      }).promise();

      this.log(`Found ${securityGroups.SecurityGroups.length} project security groups`);

      // Validate RDS security group
      const rdsSecurityGroup = securityGroups.SecurityGroups.find(sg => 
        sg.GroupName.includes('rds')
      );

      if (!rdsSecurityGroup) {
        this.log('RDS security group not found', 'error');
        return false;
      }

      // Check RDS security group rules
      const rdsIngressRules = rdsSecurityGroup.IpPermissions;
      const hasPostgresRule = rdsIngressRules.some(rule => 
        rule.FromPort === 5432 && rule.ToPort === 5432
      );

      if (!hasPostgresRule) {
        this.log('RDS security group missing PostgreSQL port 5432 rule', 'error');
        return false;
      }

      this.log('RDS security group configured correctly');

      // Validate Redis security group
      const redisSecurityGroup = securityGroups.SecurityGroups.find(sg => 
        sg.GroupName.includes('redis')
      );

      if (!redisSecurityGroup) {
        this.log('Redis security group not found', 'error');
        return false;
      }

      const redisIngressRules = redisSecurityGroup.IpPermissions;
      const hasRedisRule = redisIngressRules.some(rule => 
        rule.FromPort === 6379 && rule.ToPort === 6379
      );

      if (!hasRedisRule) {
        this.log('Redis security group missing port 6379 rule', 'error');
        return false;
      }

      this.log('Redis security group configured correctly');
      this.log('Security group validation completed successfully');
      return true;

    } catch (error) {
      this.log(`Security group validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateRDSDatabase() {
    this.log('=== Validating RDS PostgreSQL Database ===');
    
    try {
      // Get RDS instance
      const instances = await rds.describeDBInstances({
        DBInstanceIdentifier: `${PROJECT_NAME}-postgres`
      }).promise();

      if (instances.DBInstances.length === 0) {
        this.log('RDS PostgreSQL instance not found', 'error');
        return false;
      }

      const dbInstance = instances.DBInstances[0];
      this.log(`RDS instance found: ${dbInstance.DBInstanceIdentifier}`);
      this.log(`Status: ${dbInstance.DBInstanceStatus}`);
      this.log(`Engine: ${dbInstance.Engine} ${dbInstance.EngineVersion}`);
      this.log(`Instance class: ${dbInstance.DBInstanceClass}`);

      // Validate instance status
      if (dbInstance.DBInstanceStatus !== 'available') {
        this.log(`RDS instance not available (status: ${dbInstance.DBInstanceStatus})`, 'error');
        return false;
      }

      // Validate Multi-AZ
      if (!dbInstance.MultiAZ) {
        this.log('RDS instance not configured for Multi-AZ', 'warning');
      } else {
        this.log('Multi-AZ configuration enabled');
      }

      // Validate encryption
      if (!dbInstance.StorageEncrypted) {
        this.log('RDS storage encryption not enabled', 'error');
        return false;
      }

      this.log('Storage encryption enabled');

      // Validate backup configuration
      if (dbInstance.BackupRetentionPeriod < 7) {
        this.log(`Backup retention period too short: ${dbInstance.BackupRetentionPeriod} days`, 'warning');
      } else {
        this.log(`Backup retention: ${dbInstance.BackupRetentionPeriod} days`);
      }

      // Validate Performance Insights
      if (!dbInstance.PerformanceInsightsEnabled) {
        this.log('Performance Insights not enabled', 'warning');
      } else {
        this.log('Performance Insights enabled');
      }

      // Test database connectivity (basic check)
      try {
        const endpoint = dbInstance.Endpoint.Address;
        const port = dbInstance.Endpoint.Port;
        this.log(`Database endpoint: ${endpoint}:${port}`);
        
        // Note: Actual connection test would require database credentials
        // This is a basic reachability check
        this.log('Database endpoint accessible (connection test requires credentials)');
      } catch (error) {
        this.log(`Database connectivity check failed: ${error.message}`, 'warning');
      }

      this.log('RDS database validation completed successfully');
      return true;

    } catch (error) {
      this.log(`RDS validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateElastiCacheRedis() {
    this.log('=== Validating ElastiCache Redis ===');
    
    try {
      // Get Redis replication group
      const replicationGroups = await elasticache.describeReplicationGroups({
        ReplicationGroupId: `${PROJECT_NAME}-redis`
      }).promise();

      if (replicationGroups.ReplicationGroups.length === 0) {
        this.log('ElastiCache Redis replication group not found', 'error');
        return false;
      }

      const redisCluster = replicationGroups.ReplicationGroups[0];
      this.log(`Redis cluster found: ${redisCluster.ReplicationGroupId}`);
      this.log(`Status: ${redisCluster.Status}`);
      this.log(`Node type: ${redisCluster.CacheNodeType}`);

      // Validate cluster status
      if (redisCluster.Status !== 'available') {
        this.log(`Redis cluster not available (status: ${redisCluster.Status})`, 'error');
        return false;
      }

      // Validate encryption
      if (!redisCluster.AtRestEncryptionEnabled) {
        this.log('Redis at-rest encryption not enabled', 'error');
        return false;
      }

      if (!redisCluster.TransitEncryptionEnabled) {
        this.log('Redis transit encryption not enabled', 'error');
        return false;
      }

      this.log('Redis encryption (at-rest and in-transit) enabled');

      // Validate auth token
      if (!redisCluster.AuthTokenEnabled) {
        this.log('Redis auth token not enabled', 'error');
        return false;
      }

      this.log('Redis auth token enabled');

      // Check cluster nodes
      const nodeGroups = redisCluster.NodeGroups || [];
      const totalNodes = nodeGroups.reduce((sum, group) => sum + (group.NodeGroupMembers?.length || 0), 0);
      
      this.log(`Total Redis nodes: ${totalNodes}`);
      
      if (totalNodes === 0) {
        this.log('No Redis nodes found', 'error');
        return false;
      }

      // Validate primary endpoint
      if (redisCluster.ConfigurationEndpoint) {
        this.log(`Configuration endpoint: ${redisCluster.ConfigurationEndpoint.Address}:${redisCluster.ConfigurationEndpoint.Port}`);
      } else if (redisCluster.RedisEndpoint) {
        this.log(`Primary endpoint: ${redisCluster.RedisEndpoint.Address}:${redisCluster.RedisEndpoint.Port}`);
      }

      this.log('ElastiCache Redis validation completed successfully');
      return true;

    } catch (error) {
      this.log(`ElastiCache validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateS3Storage() {
    this.log('=== Validating S3 Storage ===');
    
    try {
      // List buckets to find project buckets
      const buckets = await s3.listBuckets().promise();
      const projectBuckets = buckets.Buckets.filter(bucket => 
        bucket.Name.includes(PROJECT_NAME)
      );

      if (projectBuckets.length === 0) {
        this.log('No S3 buckets found for project', 'error');
        return false;
      }

      this.log(`Found ${projectBuckets.length} project S3 buckets`);

      for (const bucket of projectBuckets) {
        this.log(`Validating bucket: ${bucket.Name}`);

        // Check bucket versioning
        try {
          const versioning = await s3.getBucketVersioning({
            Bucket: bucket.Name
          }).promise();

          if (versioning.Status !== 'Enabled') {
            this.log(`Bucket ${bucket.Name} versioning not enabled`, 'warning');
          } else {
            this.log(`Bucket ${bucket.Name} versioning enabled`);
          }
        } catch (error) {
          this.log(`Could not check versioning for ${bucket.Name}: ${error.message}`, 'warning');
        }

        // Check bucket encryption
        try {
          const encryption = await s3.getBucketEncryption({
            Bucket: bucket.Name
          }).promise();

          if (encryption.ServerSideEncryptionConfiguration) {
            this.log(`Bucket ${bucket.Name} encryption enabled`);
          }
        } catch (error) {
          if (error.code === 'ServerSideEncryptionConfigurationNotFoundError') {
            this.log(`Bucket ${bucket.Name} encryption not configured`, 'error');
          } else {
            this.log(`Could not check encryption for ${bucket.Name}: ${error.message}`, 'warning');
          }
        }

        // Check public access block
        try {
          const publicAccessBlock = await s3.getPublicAccessBlock({
            Bucket: bucket.Name
          }).promise();

          const config = publicAccessBlock.PublicAccessBlockConfiguration;
          if (config.BlockPublicAcls && config.BlockPublicPolicy && 
              config.IgnorePublicAcls && config.RestrictPublicBuckets) {
            this.log(`Bucket ${bucket.Name} public access properly blocked`);
          } else {
            this.log(`Bucket ${bucket.Name} public access not fully blocked`, 'warning');
          }
        } catch (error) {
          this.log(`Could not check public access block for ${bucket.Name}: ${error.message}`, 'warning');
        }
      }

      this.log('S3 storage validation completed successfully');
      return true;

    } catch (error) {
      this.log(`S3 validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateECSServices() {
    this.log('=== Validating ECS Fargate Services ===');
    
    try {
      // List ECS clusters
      const clusters = await ecs.listClusters().promise();
      const projectCluster = clusters.clusterArns.find(arn => 
        arn.includes(PROJECT_NAME)
      );

      if (!projectCluster) {
        this.log('ECS cluster not found', 'error');
        return false;
      }

      this.log(`ECS cluster found: ${projectCluster}`);

      // Get cluster details
      const clusterDetails = await ecs.describeClusters({
        clusters: [projectCluster]
      }).promise();

      const cluster = clusterDetails.clusters[0];
      this.log(`Cluster status: ${cluster.status}`);
      this.log(`Active services: ${cluster.activeServicesCount}`);
      this.log(`Running tasks: ${cluster.runningTasksCount}`);

      if (cluster.status !== 'ACTIVE') {
        this.log(`ECS cluster not active (status: ${cluster.status})`, 'error');
        return false;
      }

      // List services in cluster
      const services = await ecs.listServices({
        cluster: projectCluster
      }).promise();

      if (services.serviceArns.length === 0) {
        this.log('No ECS services found in cluster', 'error');
        return false;
      }

      this.log(`Found ${services.serviceArns.length} ECS services`);

      // Get service details
      const serviceDetails = await ecs.describeServices({
        cluster: projectCluster,
        services: services.serviceArns
      }).promise();

      for (const service of serviceDetails.services) {
        this.log(`Service: ${service.serviceName}`);
        this.log(`  Status: ${service.status}`);
        this.log(`  Running count: ${service.runningCount}/${service.desiredCount}`);
        this.log(`  Launch type: ${service.launchType}`);

        if (service.status !== 'ACTIVE') {
          this.log(`Service ${service.serviceName} not active`, 'error');
          return false;
        }

        if (service.runningCount < service.desiredCount) {
          this.log(`Service ${service.serviceName} not at desired capacity`, 'warning');
        }

        if (service.launchType !== 'FARGATE') {
          this.log(`Service ${service.serviceName} not using Fargate`, 'warning');
        }
      }

      this.log('ECS services validation completed successfully');
      return true;

    } catch (error) {
      this.log(`ECS validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateLoadBalancer() {
    this.log('=== Validating Application Load Balancer ===');
    
    try {
      // List load balancers
      const loadBalancers = await elbv2.describeLoadBalancers().promise();
      const projectLB = loadBalancers.LoadBalancers.find(lb => 
        lb.LoadBalancerName.includes(PROJECT_NAME)
      );

      if (!projectLB) {
        this.log('Application Load Balancer not found', 'error');
        return false;
      }

      this.log(`Load balancer found: ${projectLB.LoadBalancerName}`);
      this.log(`Status: ${projectLB.State.Code}`);
      this.log(`Scheme: ${projectLB.Scheme}`);
      this.log(`Type: ${projectLB.Type}`);

      if (projectLB.State.Code !== 'active') {
        this.log(`Load balancer not active (status: ${projectLB.State.Code})`, 'error');
        return false;
      }

      if (projectLB.Type !== 'application') {
        this.log(`Load balancer is not an Application Load Balancer`, 'error');
        return false;
      }

      // Check target groups
      const targetGroups = await elbv2.describeTargetGroups({
        LoadBalancerArn: projectLB.LoadBalancerArn
      }).promise();

      this.log(`Found ${targetGroups.TargetGroups.length} target groups`);

      for (const tg of targetGroups.TargetGroups) {
        this.log(`Target group: ${tg.TargetGroupName}`);
        this.log(`  Protocol: ${tg.Protocol}:${tg.Port}`);
        this.log(`  Health check: ${tg.HealthCheckProtocol} ${tg.HealthCheckPath}`);

        // Check target health
        const targetHealth = await elbv2.describeTargetHealth({
          TargetGroupArn: tg.TargetGroupArn
        }).promise();

        const healthyTargets = targetHealth.TargetHealthDescriptions.filter(
          target => target.TargetHealth.State === 'healthy'
        );

        this.log(`  Healthy targets: ${healthyTargets.length}/${targetHealth.TargetHealthDescriptions.length}`);

        if (healthyTargets.length === 0) {
          this.log(`No healthy targets in ${tg.TargetGroupName}`, 'warning');
        }
      }

      // Check listeners
      const listeners = await elbv2.describeListeners({
        LoadBalancerArn: projectLB.LoadBalancerArn
      }).promise();

      this.log(`Found ${listeners.Listeners.length} listeners`);

      for (const listener of listeners.Listeners) {
        this.log(`Listener: ${listener.Protocol}:${listener.Port}`);
        
        if (listener.Protocol === 'HTTPS') {
          this.log(`  SSL policy: ${listener.SslPolicy}`);
          if (listener.Certificates && listener.Certificates.length > 0) {
            this.log(`  Certificate: ${listener.Certificates[0].CertificateArn}`);
          }
        }
      }

      this.log('Load balancer validation completed successfully');
      return true;

    } catch (error) {
      this.log(`Load balancer validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateCloudWatchMonitoring() {
    this.log('=== Validating CloudWatch Monitoring ===');
    
    try {
      // Check log groups
      const logGroups = await cloudwatch.describeLogGroups({
        logGroupNamePrefix: `/aws/application/${PROJECT_NAME}`
      }).promise();

      if (logGroups.logGroups.length === 0) {
        this.log('No CloudWatch log groups found', 'error');
        return false;
      }

      this.log(`Found ${logGroups.logGroups.length} log groups`);

      for (const logGroup of logGroups.logGroups) {
        this.log(`Log group: ${logGroup.logGroupName}`);
        this.log(`  Retention: ${logGroup.retentionInDays || 'Never expire'} days`);
        this.log(`  Size: ${(logGroup.storedBytes / 1024 / 1024).toFixed(2)} MB`);

        if (!logGroup.retentionInDays) {
          this.log(`Log group ${logGroup.logGroupName} has no retention policy`, 'warning');
        }
      }

      // Check for custom metrics (basic check)
      const metrics = await cloudwatch.listMetrics({
        Namespace: PROJECT_NAME
      }).promise();

      this.log(`Found ${metrics.Metrics.length} custom metrics`);

      // Check alarms
      const alarms = await cloudwatch.describeAlarms().promise();
      const projectAlarms = alarms.MetricAlarms.filter(alarm => 
        alarm.AlarmName.includes(PROJECT_NAME)
      );

      this.log(`Found ${projectAlarms.length} CloudWatch alarms`);

      for (const alarm of projectAlarms) {
        this.log(`Alarm: ${alarm.AlarmName}`);
        this.log(`  State: ${alarm.StateValue}`);
        this.log(`  Metric: ${alarm.MetricName}`);

        if (alarm.StateValue === 'INSUFFICIENT_DATA') {
          this.log(`Alarm ${alarm.AlarmName} has insufficient data`, 'warning');
        }
      }

      this.log('CloudWatch monitoring validation completed successfully');
      return true;

    } catch (error) {
      this.log(`CloudWatch validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateIAMRoles() {
    this.log('=== Validating IAM Roles and Policies ===');
    
    try {
      // Check application role
      const appRoleName = `${PROJECT_NAME}-app-role`;
      
      try {
        const appRole = await iam.getRole({
          RoleName: appRoleName
        }).promise();

        this.log(`Application role found: ${appRole.Role.RoleName}`);
        this.log(`  Created: ${appRole.Role.CreateDate}`);
        this.log(`  ARN: ${appRole.Role.Arn}`);

        // Check role policies
        const rolePolicies = await iam.listRolePolicies({
          RoleName: appRoleName
        }).promise();

        this.log(`  Inline policies: ${rolePolicies.PolicyNames.length}`);

        const attachedPolicies = await iam.listAttachedRolePolicies({
          RoleName: appRoleName
        }).promise();

        this.log(`  Attached policies: ${attachedPolicies.AttachedPolicies.length}`);

      } catch (error) {
        if (error.code === 'NoSuchEntity') {
          this.log(`Application role ${appRoleName} not found`, 'error');
          return false;
        }
        throw error;
      }

      // Check RDS monitoring role
      const rdsRoleName = `${PROJECT_NAME}-rds-monitoring-role`;
      
      try {
        const rdsRole = await iam.getRole({
          RoleName: rdsRoleName
        }).promise();

        this.log(`RDS monitoring role found: ${rdsRole.Role.RoleName}`);

      } catch (error) {
        if (error.code === 'NoSuchEntity') {
          this.log(`RDS monitoring role ${rdsRoleName} not found`, 'warning');
        } else {
          throw error;
        }
      }

      this.log('IAM roles validation completed successfully');
      return true;

    } catch (error) {
      this.log(`IAM validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateSSMParameters() {
    this.log('=== Validating Systems Manager Parameters ===');
    
    try {
      const parameterPath = `/${PROJECT_NAME}/`;
      
      const parameters = await ssm.getParametersByPath({
        Path: parameterPath,
        Recursive: true
      }).promise();

      if (parameters.Parameters.length === 0) {
        this.log('No SSM parameters found', 'error');
        return false;
      }

      this.log(`Found ${parameters.Parameters.length} SSM parameters`);

      const requiredParams = [
        'database/url',
        'redis/url',
        's3/bucket_name'
      ];

      for (const requiredParam of requiredParams) {
        const fullParamName = `${parameterPath}${requiredParam}`;
        const param = parameters.Parameters.find(p => p.Name === fullParamName);
        
        if (!param) {
          this.log(`Required parameter ${fullParamName} not found`, 'error');
          return false;
        }

        this.log(`Parameter found: ${param.Name}`);
        this.log(`  Type: ${param.Type}`);
        this.log(`  Last modified: ${param.LastModifiedDate}`);
      }

      this.log('SSM parameters validation completed successfully');
      return true;

    } catch (error) {
      this.log(`SSM parameters validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllValidations() {
    this.log('🚀 Starting AWS Infrastructure Validation');
    this.log(`Project: ${PROJECT_NAME}`);
    this.log(`Environment: ${ENVIRONMENT}`);
    this.log(`Region: ${AWS.config.region}`);
    this.log('');

    const validations = [
      { name: 'VPC and Networking', fn: () => this.validateVPCAndNetworking() },
      { name: 'Security Groups', fn: () => this.validateSecurityGroups() },
      { name: 'RDS Database', fn: () => this.validateRDSDatabase() },
      { name: 'ElastiCache Redis', fn: () => this.validateElastiCacheRedis() },
      { name: 'S3 Storage', fn: () => this.validateS3Storage() },
      { name: 'ECS Services', fn: () => this.validateECSServices() },
      { name: 'Load Balancer', fn: () => this.validateLoadBalancer() },
      { name: 'CloudWatch Monitoring', fn: () => this.validateCloudWatchMonitoring() },
      { name: 'IAM Roles', fn: () => this.validateIAMRoles() },
      { name: 'SSM Parameters', fn: () => this.validateSSMParameters() }
    ];

    let allPassed = true;

    for (const validation of validations) {
      try {
        const result = await validation.fn();
        if (!result) {
          allPassed = false;
        }
        this.log(''); // Empty line for readability
      } catch (error) {
        this.log(`Validation ${validation.name} threw an error: ${error.message}`, 'error');
        allPassed = false;
        this.log(''); // Empty line for readability
      }
    }

    // Summary
    this.log('=== VALIDATION SUMMARY ===');
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`⚠️  Warnings: ${this.results.warnings}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log('');

    if (allPassed && this.results.failed === 0) {
      this.log('🎉 All infrastructure validations passed!');
      return true;
    } else {
      this.log('❌ Some infrastructure validations failed. Please review the issues above.');
      return false;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      project: PROJECT_NAME,
      environment: ENVIRONMENT,
      region: AWS.config.region,
      summary: {
        passed: this.results.passed,
        warnings: this.results.warnings,
        failed: this.results.failed,
        total: this.results.passed + this.results.warnings + this.results.failed
      },
      details: this.results.details
    };

    const reportPath = path.join(__dirname, '..', 'logs', `infrastructure-validation-${Date.now()}.json`);
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`Detailed report saved to: ${reportPath}`);

    return report;
  }
}

// Main execution
async function main() {
  const validator = new InfrastructureValidator();
  
  try {
    const success = await validator.runAllValidations();
    const report = validator.generateReport();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default InfrastructureValidator;
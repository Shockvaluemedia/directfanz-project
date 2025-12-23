#!/usr/bin/env node

/**
 * AWS Services Basic Functionality Test Script
 * 
 * This script tests basic functionality of all AWS services to ensure
 * they are working correctly and can perform their intended operations.
 */

import AWS from 'aws-sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

const s3 = new AWS.S3();
const rds = new AWS.RDS();
const elasticache = new AWS.ElastiCache();
const ecs = new AWS.ECS();
const cloudwatch = new AWS.CloudWatch();
const ssm = new AWS.SSM();

const PROJECT_NAME = process.env.PROJECT_NAME || 'direct-fan-platform';

class AWSServicesFunctionalityTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
    this.testId = crypto.randomBytes(8).toString('hex');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${timestamp} ${prefix} ${message}`);
    
    this.results.tests.push({
      timestamp,
      type,
      message
    });

    if (type === 'error') this.results.failed++;
    else if (type === 'warning') this.results.warnings++;
    else this.results.passed++;
  }

  async testS3Functionality() {
    this.log('=== Testing S3 Basic Functionality ===');
    
    try {
      // Find project S3 bucket
      const buckets = await s3.listBuckets().promise();
      const projectBucket = buckets.Buckets.find(bucket => 
        bucket.Name.includes(PROJECT_NAME)
      );

      if (!projectBucket) {
        this.log('No project S3 bucket found', 'error');
        return false;
      }

      const bucketName = projectBucket.Name;
      this.log(`Testing S3 bucket: ${bucketName}`);

      // Test 1: List objects (should work even if empty)
      try {
        const objects = await s3.listObjectsV2({
          Bucket: bucketName,
          MaxKeys: 10
        }).promise();
        
        this.log(`S3 list objects successful (${objects.Contents?.length || 0} objects)`);
      } catch (error) {
        this.log(`S3 list objects failed: ${error.message}`, 'error');
        return false;
      }

      // Test 2: Upload a test file
      const testKey = `test-files/functionality-test-${this.testId}.txt`;
      const testContent = `AWS S3 functionality test - ${new Date().toISOString()}`;
      
      try {
        await s3.putObject({
          Bucket: bucketName,
          Key: testKey,
          Body: testContent,
          ContentType: 'text/plain'
        }).promise();
        
        this.log('S3 upload test successful');
      } catch (error) {
        this.log(`S3 upload test failed: ${error.message}`, 'error');
        return false;
      }

      // Test 3: Download the test file
      try {
        const downloadResult = await s3.getObject({
          Bucket: bucketName,
          Key: testKey
        }).promise();
        
        const downloadedContent = downloadResult.Body.toString();
        if (downloadedContent === testContent) {
          this.log('S3 download test successful');
        } else {
          this.log('S3 download content mismatch', 'error');
          return false;
        }
      } catch (error) {
        this.log(`S3 download test failed: ${error.message}`, 'error');
        return false;
      }

      // Test 4: Generate presigned URL
      try {
        const presignedUrl = s3.getSignedUrl('getObject', {
          Bucket: bucketName,
          Key: testKey,
          Expires: 3600 // 1 hour
        });
        
        if (presignedUrl && presignedUrl.includes(bucketName)) {
          this.log('S3 presigned URL generation successful');
        } else {
          this.log('S3 presigned URL generation failed', 'error');
          return false;
        }
      } catch (error) {
        this.log(`S3 presigned URL test failed: ${error.message}`, 'error');
        return false;
      }

      // Test 5: Delete the test file
      try {
        await s3.deleteObject({
          Bucket: bucketName,
          Key: testKey
        }).promise();
        
        this.log('S3 delete test successful');
      } catch (error) {
        this.log(`S3 delete test failed: ${error.message}`, 'warning');
        // Don't fail the entire test for cleanup issues
      }

      // Test 6: Check bucket policies and CORS (if applicable)
      try {
        const bucketLocation = await s3.getBucketLocation({
          Bucket: bucketName
        }).promise();
        
        this.log(`S3 bucket location: ${bucketLocation.LocationConstraint || 'us-east-1'}`);
      } catch (error) {
        this.log(`S3 bucket location check failed: ${error.message}`, 'warning');
      }

      this.log('S3 functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`S3 functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testRDSFunctionality() {
    this.log('=== Testing RDS Basic Functionality ===');
    
    try {
      // Get RDS instance details
      const instances = await rds.describeDBInstances({
        DBInstanceIdentifier: `${PROJECT_NAME}-postgres`
      }).promise();

      if (instances.DBInstances.length === 0) {
        this.log('RDS instance not found', 'error');
        return false;
      }

      const dbInstance = instances.DBInstances[0];
      this.log(`Testing RDS instance: ${dbInstance.DBInstanceIdentifier}`);

      // Test 1: Check instance status
      if (dbInstance.DBInstanceStatus !== 'available') {
        this.log(`RDS instance not available (status: ${dbInstance.DBInstanceStatus})`, 'error');
        return false;
      }
      this.log('RDS instance is available');

      // Test 2: Check backup status
      try {
        const snapshots = await rds.describeDBSnapshots({
          DBInstanceIdentifier: dbInstance.DBInstanceIdentifier,
          SnapshotType: 'automated',
          MaxRecords: 5
        }).promise();
        
        this.log(`Found ${snapshots.DBSnapshots.length} automated backups`);
        
        if (snapshots.DBSnapshots.length > 0) {
          const latestSnapshot = snapshots.DBSnapshots[0];
          this.log(`Latest backup: ${latestSnapshot.DBSnapshotIdentifier} (${latestSnapshot.Status})`);
        }
      } catch (error) {
        this.log(`RDS backup check failed: ${error.message}`, 'warning');
      }

      // Test 3: Check Performance Insights (if enabled)
      if (dbInstance.PerformanceInsightsEnabled) {
        this.log('Performance Insights is enabled');
        
        // We can't easily test PI functionality without additional setup,
        // but we can verify it's configured
        if (dbInstance.PerformanceInsightsRetentionPeriod) {
          this.log(`PI retention period: ${dbInstance.PerformanceInsightsRetentionPeriod} days`);
        }
      } else {
        this.log('Performance Insights is not enabled', 'warning');
      }

      // Test 4: Check monitoring
      if (dbInstance.MonitoringInterval && dbInstance.MonitoringInterval > 0) {
        this.log(`Enhanced monitoring enabled (${dbInstance.MonitoringInterval}s interval)`);
      } else {
        this.log('Enhanced monitoring not enabled', 'warning');
      }

      // Test 5: Verify endpoint accessibility
      const endpoint = dbInstance.Endpoint;
      if (endpoint && endpoint.Address) {
        this.log(`Database endpoint: ${endpoint.Address}:${endpoint.Port}`);
        
        // Note: We can't test actual database connectivity without credentials
        // This would require the application to be running or credentials to be available
        this.log('Database endpoint is configured (connection test requires application credentials)');
      } else {
        this.log('Database endpoint not available', 'error');
        return false;
      }

      this.log('RDS functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`RDS functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testElastiCacheFunctionality() {
    this.log('=== Testing ElastiCache Basic Functionality ===');
    
    try {
      // Get Redis cluster details
      const replicationGroups = await elasticache.describeReplicationGroups({
        ReplicationGroupId: `${PROJECT_NAME}-redis`
      }).promise();

      if (replicationGroups.ReplicationGroups.length === 0) {
        this.log('ElastiCache Redis cluster not found', 'error');
        return false;
      }

      const redisCluster = replicationGroups.ReplicationGroups[0];
      this.log(`Testing Redis cluster: ${redisCluster.ReplicationGroupId}`);

      // Test 1: Check cluster status
      if (redisCluster.Status !== 'available') {
        this.log(`Redis cluster not available (status: ${redisCluster.Status})`, 'error');
        return false;
      }
      this.log('Redis cluster is available');

      // Test 2: Check node health
      const nodeGroups = redisCluster.NodeGroups || [];
      let totalNodes = 0;
      let healthyNodes = 0;

      for (const nodeGroup of nodeGroups) {
        const members = nodeGroup.NodeGroupMembers || [];
        totalNodes += members.length;
        
        for (const member of members) {
          if (member.CurrentRole && member.NodeGroupMemberStatus === 'available') {
            healthyNodes++;
          }
        }
      }

      this.log(`Redis nodes: ${healthyNodes}/${totalNodes} healthy`);
      
      if (healthyNodes === 0) {
        this.log('No healthy Redis nodes found', 'error');
        return false;
      }

      if (healthyNodes < totalNodes) {
        this.log('Some Redis nodes are not healthy', 'warning');
      }

      // Test 3: Check encryption settings
      if (redisCluster.AtRestEncryptionEnabled) {
        this.log('At-rest encryption is enabled');
      } else {
        this.log('At-rest encryption is not enabled', 'warning');
      }

      if (redisCluster.TransitEncryptionEnabled) {
        this.log('Transit encryption is enabled');
      } else {
        this.log('Transit encryption is not enabled', 'warning');
      }

      // Test 4: Check auth token
      if (redisCluster.AuthTokenEnabled) {
        this.log('Auth token is enabled');
      } else {
        this.log('Auth token is not enabled', 'warning');
      }

      // Test 5: Verify endpoints
      if (redisCluster.ConfigurationEndpoint) {
        const endpoint = redisCluster.ConfigurationEndpoint;
        this.log(`Configuration endpoint: ${endpoint.Address}:${endpoint.Port}`);
      } else if (redisCluster.RedisEndpoint) {
        const endpoint = redisCluster.RedisEndpoint;
        this.log(`Primary endpoint: ${endpoint.Address}:${endpoint.Port}`);
      } else {
        this.log('No Redis endpoint found', 'error');
        return false;
      }

      // Note: We can't test actual Redis connectivity without auth token and network access
      this.log('Redis endpoints are configured (connection test requires auth token and network access)');

      this.log('ElastiCache functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`ElastiCache functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testECSFunctionality() {
    this.log('=== Testing ECS Basic Functionality ===');
    
    try {
      // Find ECS cluster
      const clusters = await ecs.listClusters().promise();
      const projectCluster = clusters.clusterArns.find(arn => 
        arn.includes(PROJECT_NAME)
      );

      if (!projectCluster) {
        this.log('ECS cluster not found', 'error');
        return false;
      }

      this.log(`Testing ECS cluster: ${projectCluster}`);

      // Test 1: Check cluster status
      const clusterDetails = await ecs.describeClusters({
        clusters: [projectCluster]
      }).promise();

      const cluster = clusterDetails.clusters[0];
      if (cluster.status !== 'ACTIVE') {
        this.log(`ECS cluster not active (status: ${cluster.status})`, 'error');
        return false;
      }

      this.log(`ECS cluster is active (${cluster.runningTasksCount} running tasks)`);

      // Test 2: Check services
      const services = await ecs.listServices({
        cluster: projectCluster
      }).promise();

      if (services.serviceArns.length === 0) {
        this.log('No ECS services found', 'warning');
        return true; // Not necessarily an error if services aren't deployed yet
      }

      this.log(`Found ${services.serviceArns.length} ECS services`);

      // Test 3: Check service health
      const serviceDetails = await ecs.describeServices({
        cluster: projectCluster,
        services: services.serviceArns
      }).promise();

      let healthyServices = 0;
      for (const service of serviceDetails.services) {
        this.log(`Service: ${service.serviceName}`);
        this.log(`  Status: ${service.status}`);
        this.log(`  Running: ${service.runningCount}/${service.desiredCount}`);
        
        if (service.status === 'ACTIVE' && service.runningCount >= service.desiredCount) {
          healthyServices++;
        }
      }

      this.log(`Healthy services: ${healthyServices}/${serviceDetails.services.length}`);

      // Test 4: Check task definitions
      const taskDefinitions = await ecs.listTaskDefinitions({
        familyPrefix: PROJECT_NAME,
        status: 'ACTIVE'
      }).promise();

      this.log(`Found ${taskDefinitions.taskDefinitionArns.length} active task definitions`);

      if (taskDefinitions.taskDefinitionArns.length === 0) {
        this.log('No active task definitions found', 'warning');
      }

      this.log('ECS functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`ECS functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testCloudWatchFunctionality() {
    this.log('=== Testing CloudWatch Basic Functionality ===');
    
    try {
      // Test 1: Check log groups
      const logGroups = await cloudwatch.describeLogGroups({
        logGroupNamePrefix: `/aws/application/${PROJECT_NAME}`
      }).promise();

      this.log(`Found ${logGroups.logGroups.length} CloudWatch log groups`);

      for (const logGroup of logGroups.logGroups) {
        this.log(`Log group: ${logGroup.logGroupName}`);
        
        // Check recent log streams
        try {
          const logStreams = await cloudwatch.describeLogStreams({
            logGroupName: logGroup.logGroupName,
            orderBy: 'LastEventTime',
            descending: true,
            limit: 5
          }).promise();
          
          this.log(`  Recent streams: ${logStreams.logStreams.length}`);
          
          if (logStreams.logStreams.length > 0) {
            const latestStream = logStreams.logStreams[0];
            if (latestStream.lastEventTime) {
              const lastEvent = new Date(latestStream.lastEventTime);
              this.log(`  Latest activity: ${lastEvent.toISOString()}`);
            }
          }
        } catch (error) {
          this.log(`  Could not check log streams: ${error.message}`, 'warning');
        }
      }

      // Test 2: Check custom metrics
      const metrics = await cloudwatch.listMetrics({
        Namespace: PROJECT_NAME
      }).promise();

      this.log(`Found ${metrics.Metrics.length} custom metrics`);

      // Test 3: Check alarms
      const alarms = await cloudwatch.describeAlarms().promise();
      const projectAlarms = alarms.MetricAlarms.filter(alarm => 
        alarm.AlarmName.includes(PROJECT_NAME)
      );

      this.log(`Found ${projectAlarms.length} project alarms`);

      for (const alarm of projectAlarms) {
        this.log(`Alarm: ${alarm.AlarmName} (${alarm.StateValue})`);
        
        if (alarm.StateValue === 'ALARM') {
          this.log(`  WARNING: Alarm ${alarm.AlarmName} is in ALARM state`, 'warning');
        }
      }

      // Test 4: Test metric publishing
      try {
        await cloudwatch.putMetricData({
          Namespace: PROJECT_NAME,
          MetricData: [
            {
              MetricName: 'FunctionalityTest',
              Value: 1,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [
                {
                  Name: 'TestType',
                  Value: 'Infrastructure'
                }
              ]
            }
          ]
        }).promise();
        
        this.log('CloudWatch metric publishing test successful');
      } catch (error) {
        this.log(`CloudWatch metric publishing failed: ${error.message}`, 'error');
        return false;
      }

      this.log('CloudWatch functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`CloudWatch functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testSSMFunctionality() {
    this.log('=== Testing Systems Manager Basic Functionality ===');
    
    try {
      // Test 1: List parameters
      const parameters = await ssm.getParametersByPath({
        Path: `/${PROJECT_NAME}/`,
        Recursive: true
      }).promise();

      this.log(`Found ${parameters.Parameters.length} SSM parameters`);

      if (parameters.Parameters.length === 0) {
        this.log('No SSM parameters found', 'warning');
        return true; // Not necessarily an error
      }

      // Test 2: Check required parameters
      const requiredParams = [
        'database/url',
        'redis/url',
        's3/bucket_name'
      ];

      let foundParams = 0;
      for (const requiredParam of requiredParams) {
        const fullParamName = `/${PROJECT_NAME}/${requiredParam}`;
        const param = parameters.Parameters.find(p => p.Name === fullParamName);
        
        if (param) {
          this.log(`Parameter found: ${param.Name} (${param.Type})`);
          foundParams++;
        } else {
          this.log(`Required parameter missing: ${fullParamName}`, 'warning');
        }
      }

      this.log(`Found ${foundParams}/${requiredParams.length} required parameters`);

      // Test 3: Test parameter creation and deletion
      const testParamName = `/${PROJECT_NAME}/test/functionality-test-${this.testId}`;
      const testParamValue = `Test value - ${new Date().toISOString()}`;

      try {
        // Create test parameter
        await ssm.putParameter({
          Name: testParamName,
          Value: testParamValue,
          Type: 'String',
          Description: 'Temporary parameter for functionality testing'
        }).promise();
        
        this.log('SSM parameter creation test successful');

        // Read test parameter
        const retrievedParam = await ssm.getParameter({
          Name: testParamName
        }).promise();

        if (retrievedParam.Parameter.Value === testParamValue) {
          this.log('SSM parameter retrieval test successful');
        } else {
          this.log('SSM parameter value mismatch', 'error');
          return false;
        }

        // Delete test parameter
        await ssm.deleteParameter({
          Name: testParamName
        }).promise();
        
        this.log('SSM parameter deletion test successful');

      } catch (error) {
        this.log(`SSM parameter operations failed: ${error.message}`, 'error');
        return false;
      }

      this.log('Systems Manager functionality tests completed successfully');
      return true;

    } catch (error) {
      this.log(`SSM functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllTests() {
    this.log('🧪 Starting AWS Services Functionality Tests');
    this.log(`Project: ${PROJECT_NAME}`);
    this.log(`Region: ${AWS.config.region}`);
    this.log(`Test ID: ${this.testId}`);
    this.log('');

    const tests = [
      { name: 'S3 Storage', fn: () => this.testS3Functionality() },
      { name: 'RDS Database', fn: () => this.testRDSFunctionality() },
      { name: 'ElastiCache Redis', fn: () => this.testElastiCacheFunctionality() },
      { name: 'ECS Services', fn: () => this.testECSFunctionality() },
      { name: 'CloudWatch Monitoring', fn: () => this.testCloudWatchFunctionality() },
      { name: 'Systems Manager', fn: () => this.testSSMFunctionality() }
    ];

    let allPassed = true;

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (!result) {
          allPassed = false;
        }
        this.log(''); // Empty line for readability
      } catch (error) {
        this.log(`Test ${test.name} threw an error: ${error.message}`, 'error');
        allPassed = false;
        this.log(''); // Empty line for readability
      }
    }

    // Summary
    this.log('=== FUNCTIONALITY TEST SUMMARY ===');
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`⚠️  Warnings: ${this.results.warnings}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log('');

    if (allPassed && this.results.failed === 0) {
      this.log('🎉 All AWS services functionality tests passed!');
      return true;
    } else {
      this.log('❌ Some AWS services functionality tests failed. Please review the issues above.');
      return false;
    }
  }
}

// Main execution
async function main() {
  const tester = new AWSServicesFunctionalityTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during functionality testing:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default AWSServicesFunctionalityTester;
#!/usr/bin/env node

/**
 * Network Connectivity Test Script
 * 
 * This script tests network connectivity between AWS infrastructure components
 * to ensure proper network configuration and security group settings.
 */

import AWS from 'aws-sdk';
import net from 'net';
import dns from 'dns';
const { promises: dnsPromises } = dns;

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

const ec2 = new AWS.EC2();
const rds = new AWS.RDS();
const elasticache = new AWS.ElastiCache();

const PROJECT_NAME = process.env.PROJECT_NAME || 'direct-fan-platform';

class NetworkConnectivityTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
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
    else this.results.passed++;
  }

  async testPortConnectivity(host, port, timeout = 5000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  async testDNSResolution(hostname) {
    try {
      const addresses = await dnsPromises.lookup(hostname);
      return addresses.address;
    } catch (error) {
      return null;
    }
  }

  async getVPCInfo() {
    try {
      const vpcs = await ec2.describeVpcs({
        Filters: [
          { Name: 'tag:Name', Values: [`${PROJECT_NAME}-vpc`] }
        ]
      }).promise();

      if (vpcs.Vpcs.length === 0) {
        throw new Error('VPC not found');
      }

      const vpc = vpcs.Vpcs[0];
      
      // Get subnets
      const subnets = await ec2.describeSubnets({
        Filters: [
          { Name: 'vpc-id', Values: [vpc.VpcId] }
        ]
      }).promise();

      return {
        vpc,
        subnets: subnets.Subnets
      };
    } catch (error) {
      throw new Error(`Failed to get VPC info: ${error.message}`);
    }
  }

  async getRDSEndpoint() {
    try {
      const instances = await rds.describeDBInstances({
        DBInstanceIdentifier: `${PROJECT_NAME}-postgres`
      }).promise();

      if (instances.DBInstances.length === 0) {
        throw new Error('RDS instance not found');
      }

      const dbInstance = instances.DBInstances[0];
      return {
        host: dbInstance.Endpoint.Address,
        port: dbInstance.Endpoint.Port
      };
    } catch (error) {
      throw new Error(`Failed to get RDS endpoint: ${error.message}`);
    }
  }

  async getRedisEndpoint() {
    try {
      const replicationGroups = await elasticache.describeReplicationGroups({
        ReplicationGroupId: `${PROJECT_NAME}-redis`
      }).promise();

      if (replicationGroups.ReplicationGroups.length === 0) {
        throw new Error('Redis replication group not found');
      }

      const redisCluster = replicationGroups.ReplicationGroups[0];
      
      let endpoint;
      if (redisCluster.ConfigurationEndpoint) {
        endpoint = {
          host: redisCluster.ConfigurationEndpoint.Address,
          port: redisCluster.ConfigurationEndpoint.Port
        };
      } else if (redisCluster.RedisEndpoint) {
        endpoint = {
          host: redisCluster.RedisEndpoint.Address,
          port: redisCluster.RedisEndpoint.Port
        };
      } else {
        throw new Error('No Redis endpoint found');
      }

      return endpoint;
    } catch (error) {
      throw new Error(`Failed to get Redis endpoint: ${error.message}`);
    }
  }

  async testVPCConnectivity() {
    this.log('=== Testing VPC Connectivity ===');
    
    try {
      const vpcInfo = await this.getVPCInfo();
      this.log(`Testing VPC: ${vpcInfo.vpc.VpcId} (${vpcInfo.vpc.CidrBlock})`);

      // Test subnet connectivity by checking if they're in different AZs
      const azs = [...new Set(vpcInfo.subnets.map(s => s.AvailabilityZone))];
      this.log(`Subnets span ${azs.length} availability zones: ${azs.join(', ')}`);

      if (azs.length < 2) {
        this.log('Subnets should span at least 2 AZs for high availability', 'warning');
      }

      // Check route tables
      const routeTables = await ec2.describeRouteTables({
        Filters: [
          { Name: 'vpc-id', Values: [vpcInfo.vpc.VpcId] }
        ]
      }).promise();

      this.log(`Found ${routeTables.RouteTables.length} route tables`);

      // Check for internet gateway routes
      let hasInternetRoute = false;
      for (const rt of routeTables.RouteTables) {
        for (const route of rt.Routes) {
          if (route.GatewayId && route.GatewayId.startsWith('igw-')) {
            hasInternetRoute = true;
            break;
          }
        }
      }

      if (hasInternetRoute) {
        this.log('Internet gateway route found');
      } else {
        this.log('No internet gateway route found', 'warning');
      }

      return true;
    } catch (error) {
      this.log(`VPC connectivity test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testDatabaseConnectivity() {
    this.log('=== Testing Database Connectivity ===');
    
    try {
      const rdsEndpoint = await this.getRDSEndpoint();
      this.log(`Testing RDS connectivity: ${rdsEndpoint.host}:${rdsEndpoint.port}`);

      // Test DNS resolution
      const resolvedIP = await this.testDNSResolution(rdsEndpoint.host);
      if (resolvedIP) {
        this.log(`DNS resolution successful: ${rdsEndpoint.host} -> ${resolvedIP}`);
      } else {
        this.log(`DNS resolution failed for ${rdsEndpoint.host}`, 'error');
        return false;
      }

      // Test port connectivity
      const isConnectable = await this.testPortConnectivity(rdsEndpoint.host, rdsEndpoint.port);
      if (isConnectable) {
        this.log(`Port ${rdsEndpoint.port} is reachable on ${rdsEndpoint.host}`);
      } else {
        this.log(`Port ${rdsEndpoint.port} is not reachable on ${rdsEndpoint.host}`, 'error');
        this.log('This could indicate security group or network ACL issues', 'error');
        return false;
      }

      return true;
    } catch (error) {
      this.log(`Database connectivity test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testRedisConnectivity() {
    this.log('=== Testing Redis Connectivity ===');
    
    try {
      const redisEndpoint = await this.getRedisEndpoint();
      this.log(`Testing Redis connectivity: ${redisEndpoint.host}:${redisEndpoint.port}`);

      // Test DNS resolution
      const resolvedIP = await this.testDNSResolution(redisEndpoint.host);
      if (resolvedIP) {
        this.log(`DNS resolution successful: ${redisEndpoint.host} -> ${resolvedIP}`);
      } else {
        this.log(`DNS resolution failed for ${redisEndpoint.host}`, 'error');
        return false;
      }

      // Test port connectivity
      const isConnectable = await this.testPortConnectivity(redisEndpoint.host, redisEndpoint.port);
      if (isConnectable) {
        this.log(`Port ${redisEndpoint.port} is reachable on ${redisEndpoint.host}`);
      } else {
        this.log(`Port ${redisEndpoint.port} is not reachable on ${redisEndpoint.host}`, 'error');
        this.log('This could indicate security group or network ACL issues', 'error');
        return false;
      }

      return true;
    } catch (error) {
      this.log(`Redis connectivity test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testInternetConnectivity() {
    this.log('=== Testing Internet Connectivity ===');
    
    try {
      // Test connectivity to AWS services
      const awsServices = [
        { name: 'S3', host: 's3.amazonaws.com', port: 443 },
        { name: 'CloudWatch', host: 'monitoring.us-east-1.amazonaws.com', port: 443 },
        { name: 'ECR', host: 'ecr.us-east-1.amazonaws.com', port: 443 }
      ];

      let allPassed = true;

      for (const service of awsServices) {
        this.log(`Testing ${service.name} connectivity: ${service.host}:${service.port}`);
        
        const isConnectable = await this.testPortConnectivity(service.host, service.port, 10000);
        if (isConnectable) {
          this.log(`${service.name} is reachable`);
        } else {
          this.log(`${service.name} is not reachable`, 'error');
          allPassed = false;
        }
      }

      return allPassed;
    } catch (error) {
      this.log(`Internet connectivity test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testSecurityGroupRules() {
    this.log('=== Testing Security Group Rules ===');
    
    try {
      const vpcInfo = await this.getVPCInfo();
      
      // Get security groups
      const securityGroups = await ec2.describeSecurityGroups({
        Filters: [
          { Name: 'vpc-id', Values: [vpcInfo.vpc.VpcId] },
          { Name: 'group-name', Values: [`${PROJECT_NAME}-*`] }
        ]
      }).promise();

      this.log(`Found ${securityGroups.SecurityGroups.length} project security groups`);

      for (const sg of securityGroups.SecurityGroups) {
        this.log(`Security Group: ${sg.GroupName} (${sg.GroupId})`);
        
        // Check ingress rules
        this.log(`  Ingress rules: ${sg.IpPermissions.length}`);
        for (const rule of sg.IpPermissions) {
          const fromPort = rule.FromPort || 'All';
          const toPort = rule.ToPort || 'All';
          const protocol = rule.IpProtocol === '-1' ? 'All' : rule.IpProtocol;
          
          this.log(`    ${protocol} ${fromPort}-${toPort}`);
          
          // Check for overly permissive rules
          if (rule.IpRanges.some(range => range.CidrIp === '0.0.0.0/0')) {
            if (rule.FromPort !== 80 && rule.FromPort !== 443) {
              this.log(`    WARNING: Rule allows access from anywhere (0.0.0.0/0)`, 'warning');
            }
          }
        }

        // Check egress rules
        this.log(`  Egress rules: ${sg.IpPermissionsEgress.length}`);
        
        // Check for default allow-all egress
        const hasAllowAllEgress = sg.IpPermissionsEgress.some(rule => 
          rule.IpProtocol === '-1' && 
          rule.IpRanges.some(range => range.CidrIp === '0.0.0.0/0')
        );

        if (hasAllowAllEgress) {
          this.log(`    Has allow-all egress rule (common default)`);
        }
      }

      return true;
    } catch (error) {
      this.log(`Security group rules test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllTests() {
    this.log('🔍 Starting Network Connectivity Tests');
    this.log(`Project: ${PROJECT_NAME}`);
    this.log(`Region: ${AWS.config.region}`);
    this.log('');

    const tests = [
      { name: 'VPC Connectivity', fn: () => this.testVPCConnectivity() },
      { name: 'Database Connectivity', fn: () => this.testDatabaseConnectivity() },
      { name: 'Redis Connectivity', fn: () => this.testRedisConnectivity() },
      { name: 'Internet Connectivity', fn: () => this.testInternetConnectivity() },
      { name: 'Security Group Rules', fn: () => this.testSecurityGroupRules() }
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
    this.log('=== CONNECTIVITY TEST SUMMARY ===');
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log('');

    if (allPassed && this.results.failed === 0) {
      this.log('🎉 All network connectivity tests passed!');
      return true;
    } else {
      this.log('❌ Some network connectivity tests failed. Please review the issues above.');
      return false;
    }
  }
}

// Main execution
async function main() {
  const tester = new NetworkConnectivityTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during network testing:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default NetworkConnectivityTester;
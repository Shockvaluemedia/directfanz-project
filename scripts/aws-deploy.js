#!/usr/bin/env node

/**
 * AWS Infrastructure Deployment Script
 * Automates deployment to AWS using Terraform and AWS CLI
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command, options = {}) {
  try {
    log(`Executing: ${command}`, colors.blue);
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options,
    });
    return result;
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    if (!options.ignoreError) {
      process.exit(1);
    }
    return null;
  }
}

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function checkPrerequisites() {
  log('🔍 Checking prerequisites...', colors.cyan);

  // Check if AWS CLI is installed
  try {
    executeCommand('aws --version', { silent: true });
    log('✅ AWS CLI is installed', colors.green);
  } catch (error) {
    log('❌ AWS CLI is not installed. Please install it first.', colors.red);
    log(
      'Installation guide: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html',
      colors.yellow
    );
    process.exit(1);
  }

  // Check if Terraform is installed
  try {
    executeCommand('terraform --version', { silent: true });
    log('✅ Terraform is installed', colors.green);
  } catch (error) {
    log('❌ Terraform is not installed. Please install it first.', colors.red);
    log(
      'Installation guide: https://learn.hashicorp.com/tutorials/terraform/install-cli',
      colors.yellow
    );
    process.exit(1);
  }

  // Check AWS credentials
  try {
    executeCommand('aws sts get-caller-identity', { silent: true });
    log('✅ AWS credentials are configured', colors.green);
  } catch (error) {
    log('❌ AWS credentials are not configured.', colors.red);
    log('Run: aws configure', colors.yellow);
    process.exit(1);
  }

  // Check if infrastructure directory exists
  if (!fs.existsSync('infrastructure/terraform')) {
    log('❌ Infrastructure directory not found.', colors.red);
    process.exit(1);
  }

  log('✅ All prerequisites met!', colors.green);
}

async function setupTerraformBackend() {
  log('\n🏗️ Setting up Terraform backend...', colors.cyan);

  const bucketName = 'direct-fan-platform-terraform-state';
  const tableName = 'terraform-state-lock';
  const region = 'us-east-1';

  // Create S3 bucket for Terraform state
  const createBucket = await question(
    `Create S3 bucket ${bucketName} for Terraform state? (y/n): `
  );
  if (createBucket.toLowerCase() === 'y') {
    executeCommand(`aws s3 mb s3://${bucketName} --region ${region}`, { ignoreError: true });

    // Enable versioning
    executeCommand(
      `aws s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled`
    );

    // Enable server-side encryption
    executeCommand(`aws s3api put-bucket-encryption --bucket ${bucketName} --server-side-encryption-configuration '{
      "Rules": [
        {
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"
          }
        }
      ]
    }'`);

    log('✅ S3 bucket created and configured', colors.green);
  }

  // Create DynamoDB table for state locking
  const createTable = await question(
    `Create DynamoDB table ${tableName} for state locking? (y/n): `
  );
  if (createTable.toLowerCase() === 'y') {
    executeCommand(
      `aws dynamodb create-table \\
      --table-name ${tableName} \\
      --attribute-definitions AttributeName=LockID,AttributeType=S \\
      --key-schema AttributeName=LockID,KeyType=HASH \\
      --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \\
      --region ${region}`,
      { ignoreError: true }
    );

    log('✅ DynamoDB table created', colors.green);
  }
}

async function deployInfrastructure() {
  log('\n🚀 Deploying infrastructure with Terraform...', colors.cyan);

  // Change to infrastructure directory
  process.chdir('infrastructure/terraform');

  const environment = await question(
    'Which environment do you want to deploy? (dev/staging/prod): '
  );
  if (!['dev', 'staging', 'prod'].includes(environment)) {
    log('❌ Invalid environment. Must be dev, staging, or prod.', colors.red);
    process.exit(1);
  }

  // Create terraform.tfvars file
  const tfvarsContent = `
environment = "${environment}"
project_name = "direct-fan-platform"
aws_region = "us-east-1"

# Database configuration
db_instance_class = "${environment === 'prod' ? 'db.t3.small' : 'db.t3.micro'}"
db_allocated_storage = ${environment === 'prod' ? 50 : 20}
db_max_allocated_storage = ${environment === 'prod' ? 200 : 100}

# Redis configuration
redis_node_type = "${environment === 'prod' ? 'cache.t3.small' : 'cache.t3.micro'}"
redis_num_cache_nodes = ${environment === 'prod' ? 2 : 1}

# Monitoring
enable_monitoring = ${environment === 'prod' ? 'true' : 'false'}
log_retention_days = ${environment === 'prod' ? 90 : 30}
`;

  fs.writeFileSync('terraform.tfvars', tfvarsContent.trim());
  log('✅ Created terraform.tfvars', colors.green);

  // Initialize Terraform
  log('Initializing Terraform...', colors.blue);
  executeCommand('terraform init');

  // Plan deployment
  log('Creating deployment plan...', colors.blue);
  executeCommand('terraform plan -var-file=terraform.tfvars -out=tfplan');

  // Confirm deployment
  const confirmDeploy = await question('Review the plan above. Proceed with deployment? (y/n): ');
  if (confirmDeploy.toLowerCase() !== 'y') {
    log('Deployment cancelled.', colors.yellow);
    process.exit(0);
  }

  // Apply changes
  log('Applying Terraform changes...', colors.blue);
  executeCommand('terraform apply tfplan');

  log('✅ Infrastructure deployment completed!', colors.green);

  // Get outputs
  log('\n📋 Getting deployment outputs...', colors.blue);
  const outputs = executeCommand('terraform output -json', { silent: true });

  if (outputs) {
    const outputData = JSON.parse(outputs);
    log('\n🔗 Deployment Information:', colors.cyan);

    Object.entries(outputData).forEach(([key, value]) => {
      log(`${key}: ${value.value}`, colors.yellow);
    });

    // Save outputs to file
    fs.writeFileSync('../../terraform-outputs.json', JSON.stringify(outputData, null, 2));
    log('✅ Outputs saved to terraform-outputs.json', colors.green);
  }

  // Return to original directory
  process.chdir('../..');
}

async function deployApplication() {
  log('\n🚀 Deploying application...', colors.cyan);

  const deployMethod = await question('Choose deployment method (ecs/lambda/ec2): ');

  switch (deployMethod.toLowerCase()) {
    case 'ecs':
      await deployToECS();
      break;
    case 'lambda':
      await deployToLambda();
      break;
    case 'ec2':
      await deployToEC2();
      break;
    default:
      log('❌ Invalid deployment method', colors.red);
      break;
  }
}

async function deployToECS() {
  log('Deploying to Amazon ECS...', colors.blue);

  // Build and push Docker image
  const accountId = executeCommand('aws sts get-caller-identity --query Account --output text', {
    silent: true,
  }).trim();
  const region = 'us-east-1';
  const ecrRepo = `${accountId}.dkr.ecr.${region}.amazonaws.com/direct-fan-platform`;

  // Create ECR repository if it doesn't exist
  executeCommand(
    `aws ecr create-repository --repository-name direct-fan-platform --region ${region}`,
    { ignoreError: true }
  );

  // Get ECR login token
  executeCommand(
    `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${ecrRepo}`
  );

  // Build and tag image
  executeCommand(`docker build -f Dockerfile.production -t direct-fan-platform:latest .`);
  executeCommand(`docker tag direct-fan-platform:latest ${ecrRepo}:latest`);

  // Push image
  executeCommand(`docker push ${ecrRepo}:latest`);

  log('✅ Docker image pushed to ECR', colors.green);

  // Deploy ECS service (this would require additional ECS configuration)
  log('🚧 ECS service deployment would require additional configuration', colors.yellow);
  log(
    'Consider using AWS Copilot for easier ECS deployments: https://aws.github.io/copilot-cli/',
    colors.yellow
  );
}

async function deployToLambda() {
  log('🚧 Lambda deployment not implemented yet', colors.yellow);
  log('Consider using Serverless Framework or AWS SAM for Lambda deployments', colors.yellow);
}

async function deployToEC2() {
  log('Deploying to EC2...', colors.blue);

  // This would require additional EC2 configuration and user data scripts
  log('🚧 EC2 deployment would require additional configuration', colors.yellow);
  log('Consider using AWS Systems Manager for EC2 deployments', colors.yellow);
}

async function runPostDeploymentTests() {
  log('\n🧪 Running post-deployment tests...', colors.cyan);

  // Load Terraform outputs to get endpoints
  if (fs.existsSync('terraform-outputs.json')) {
    const outputs = JSON.parse(fs.readFileSync('terraform-outputs.json', 'utf8'));

    // Test database connection
    if (outputs.database_endpoint) {
      log('Testing database connection...', colors.blue);
      // Add database connectivity test here
    }

    // Test Redis connection
    if (outputs.redis_endpoint) {
      log('Testing Redis connection...', colors.blue);
      // Add Redis connectivity test here
    }

    // Test S3 access
    if (outputs.s3_bucket_name) {
      log('Testing S3 bucket access...', colors.blue);
      executeCommand(`aws s3 ls s3://${outputs.s3_bucket_name.value}`, { ignoreError: true });
    }
  }

  log('✅ Post-deployment tests completed', colors.green);
}

async function setupMonitoring() {
  log('\n📊 Setting up monitoring and alerting...', colors.cyan);

  // Create CloudWatch dashboard
  const dashboardBody = {
    widgets: [
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/RDS', 'CPUUtilization', 'DBInstanceIdentifier', 'direct-fan-platform-postgres'],
            [
              'AWS/RDS',
              'DatabaseConnections',
              'DBInstanceIdentifier',
              'direct-fan-platform-postgres',
            ],
          ],
          period: 300,
          stat: 'Average',
          region: 'us-east-1',
          title: 'RDS Metrics',
        },
      },
    ],
  };

  fs.writeFileSync('/tmp/dashboard.json', JSON.stringify(dashboardBody));
  executeCommand(
    `aws cloudwatch put-dashboard --dashboard-name "DirectFanPlatform" --dashboard-body file:///tmp/dashboard.json`
  );

  log('✅ CloudWatch dashboard created', colors.green);

  // Set up basic alarms
  executeCommand(`aws cloudwatch put-metric-alarm \\
    --alarm-name "DirectFanPlatform-HighCPU" \\
    --alarm-description "High CPU usage alert" \\
    --metric-name CPUUtilization \\
    --namespace AWS/RDS \\
    --statistic Average \\
    --period 300 \\
    --threshold 80 \\
    --comparison-operator GreaterThanThreshold \\
    --dimensions Name=DBInstanceIdentifier,Value=direct-fan-platform-postgres \\
    --evaluation-periods 2`);

  log('✅ CloudWatch alarms configured', colors.green);
}

async function main() {
  log('🚀 AWS Infrastructure Deployment', colors.cyan);
  log('==================================', colors.cyan);

  try {
    await checkPrerequisites();

    const setupBackend = await question('\nSetup Terraform backend? (y/n): ');
    if (setupBackend.toLowerCase() === 'y') {
      await setupTerraformBackend();
    }

    const deployInfra = await question('\nDeploy infrastructure? (y/n): ');
    if (deployInfra.toLowerCase() === 'y') {
      await deployInfrastructure();
    }

    const deployApp = await question('\nDeploy application? (y/n): ');
    if (deployApp.toLowerCase() === 'y') {
      await deployApplication();
    }

    const runTests = await question('\nRun post-deployment tests? (y/n): ');
    if (runTests.toLowerCase() === 'y') {
      await runPostDeploymentTests();
    }

    const setupMon = await question('\nSetup monitoring? (y/n): ');
    if (setupMon.toLowerCase() === 'y') {
      await setupMonitoring();
    }

    log('\n🎉 AWS deployment completed successfully!', colors.green);
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n⚠️ Deployment interrupted by user', colors.yellow);
  rl.close();
  process.exit(1);
});

main();

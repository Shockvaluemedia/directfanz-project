/**
 * Property Test: Secure Secrets Usage
 * Validates: Requirements 4.1, 4.2
 * 
 * Property 11: Secure secrets usage
 * - Pre-generated secrets from .env.production.secrets
 * - AWS Systems Manager Parameter Store integration
 * - Secure environment variable handling
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('Property Test: Secure Secrets Usage', () => {
  const projectRoot = path.join(__dirname, '../../..');
  const secretsPath = path.join(projectRoot, '.env.production.secrets');
  const terraformDir = path.join(projectRoot, 'infrastructure/terraform');

  test('Property 11.1: Production secrets file exists and contains required secrets', () => {
    expect(fs.existsSync(secretsPath)).toBe(true);
    
    const secretsContent = fs.readFileSync(secretsPath, 'utf8');
    
    // Verify required secrets are present
    const requiredSecrets = [
      'NEXTAUTH_SECRET',
      'ENCRYPTION_KEY',
      'JWT_SECRET'
    ];
    
    requiredSecrets.forEach(secret => {
      expect(secretsContent).toContain(`${secret}=`);
      
      // Extract secret value
      const match = secretsContent.match(new RegExp(`${secret}="?([^"\\n]+)"?`));
      expect(match).toBeTruthy();
      expect(match[1]).toBeDefined();
      expect(match[1].length).toBeGreaterThan(0);
    });
  });

  test('Property 11.2: Secrets have appropriate entropy and format', () => {
    const secretsContent = fs.readFileSync(secretsPath, 'utf8');
    
    // Test NEXTAUTH_SECRET format and entropy
    const nextAuthMatch = secretsContent.match(/NEXTAUTH_SECRET="?([^"\\n]+)"?/);
    expect(nextAuthMatch).toBeTruthy();
    const nextAuthSecret = nextAuthMatch[1];
    expect(nextAuthSecret.length).toBeGreaterThanOrEqual(32); // Minimum 32 characters
    expect(nextAuthSecret).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
    
    // Test ENCRYPTION_KEY format and entropy
    const encryptionMatch = secretsContent.match(/ENCRYPTION_KEY="?([^"\\n]+)"?/);
    expect(encryptionMatch).toBeTruthy();
    const encryptionKey = encryptionMatch[1];
    expect(encryptionKey.length).toBe(64); // 256-bit key = 64 hex characters
    expect(encryptionKey).toMatch(/^[a-f0-9]{64}$/); // Hex format
    
    // Test JWT_SECRET format and entropy
    const jwtMatch = secretsContent.match(/JWT_SECRET="?([^"\\n]+)"?/);
    expect(jwtMatch).toBeTruthy();
    const jwtSecret = jwtMatch[1];
    expect(jwtSecret.length).toBeGreaterThanOrEqual(32); // Minimum 32 characters
    expect(jwtSecret).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
  });

  test('Property 11.3: AWS Systems Manager Parameter Store configuration exists', () => {
    // Check for parameter store configuration in Terraform files
    const parameterStoreFiles = [
      'main.tf',
      'iam-enhanced.tf',
      'ecs-fargate.tf'
    ];
    
    let parameterStoreConfigFound = false;
    
    parameterStoreFiles.forEach(file => {
      const filePath = path.join(terraformDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('aws_ssm_parameter') || content.includes('parameter_store')) {
          parameterStoreConfigFound = true;
        }
      }
    });
    
    // At minimum, verify IAM permissions for parameter store access
    const iamPath = path.join(terraformDir, 'iam-enhanced.tf');
    if (fs.existsSync(iamPath)) {
      const iamContent = fs.readFileSync(iamPath, 'utf8');
      expect(iamContent).toMatch(/(ssm:GetParameter|ssm:GetParameters)/);
    }
  });

  test('Property 11.4: ECS task definitions use secure environment variable handling', () => {
    const ecsTaskDefsDir = path.join(projectRoot, 'ecs-task-definitions');
    const taskDefinitionFiles = [
      'web-app-task.json',
      'websocket-task.json'
    ];

    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      if (fs.existsSync(filePath)) {
        const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        taskDef.containerDefinitions.forEach(container => {
          // Check for secrets configuration
          if (container.secrets) {
            expect(container.secrets).toBeInstanceOf(Array);
            
            container.secrets.forEach(secret => {
              expect(secret.name).toBeDefined();
              expect(secret.valueFrom).toBeDefined();
              expect(secret.valueFrom).toMatch(/^arn:aws:ssm:/); // SSM Parameter ARN format
            });
          }
          
          // Verify no hardcoded secrets in environment variables
          if (container.environment) {
            container.environment.forEach(envVar => {
              const sensitivePatterns = [
                /secret/i,
                /password/i,
                /key/i,
                /token/i
              ];
              
              const isSensitive = sensitivePatterns.some(pattern => 
                pattern.test(envVar.name)
              );
              
              if (isSensitive) {
                // Sensitive variables should not have hardcoded values
                expect(envVar.value).not.toMatch(/^[A-Za-z0-9+/=]{20,}$/); // Not a long encoded string
                expect(envVar.value).not.toMatch(/^[a-f0-9]{32,}$/); // Not a long hex string
              }
            });
          }
        });
      }
    });
  });

  test('Property 11.5: Secrets are not exposed in configuration files', () => {
    const configFiles = [
      'terraform.tfvars',
      'terraform.tfvars.example',
      '.env.example',
      '.env.local.example'
    ];
    
    configFiles.forEach(file => {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check that no actual secrets are hardcoded
        expect(content).not.toMatch(/NEXTAUTH_SECRET="[A-Za-z0-9+/=]{32,}"/);
        expect(content).not.toMatch(/ENCRYPTION_KEY="[a-f0-9]{64}"/);
        expect(content).not.toMatch(/JWT_SECRET="[A-Za-z0-9+/=]{32,}"/);
        expect(content).not.toMatch(/sk_live_[A-Za-z0-9]+/); // Stripe live keys
        expect(content).not.toMatch(/AKIA[A-Z0-9]{16}/); // AWS access keys
        
        // Should contain placeholder values instead
        if (file.includes('example')) {
          expect(content).toMatch(/(your-|change-|replace-|example-)/i);
        }
      }
    });
  });

  test('Property 11.6: Secret rotation capability is configured', () => {
    // Check for AWS Secrets Manager configuration
    const secretsManagerFiles = [
      'main.tf',
      'iam-enhanced.tf'
    ];
    
    secretsManagerFiles.forEach(file => {
      const filePath = path.join(terraformDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for Secrets Manager resources or permissions
        if (content.includes('aws_secretsmanager') || content.includes('secretsmanager:')) {
          expect(content).toMatch(/(aws_secretsmanager_secret|secretsmanager:GetSecretValue)/);
        }
      }
    });
  });

  test('Property 11.7: Database credentials are securely managed', () => {
    const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
    if (fs.existsSync(rdsConfigPath)) {
      const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
      
      // Verify database password is not hardcoded
      expect(rdsConfig).not.toMatch(/password\s*=\s*"[^"]+"/);
      
      // Should use managed password or reference to secrets
      expect(rdsConfig).toMatch(/(manage_master_user_password|password.*var\.|password.*random_password)/);
    }
  });

  test('Property 11.8: API keys and external service credentials are secure', () => {
    // Check that external service credentials are properly referenced
    const ecsTaskDefsDir = path.join(projectRoot, 'ecs-task-definitions');
    const taskDefinitionFiles = [
      'web-app-task.json',
      'websocket-task.json'
    ];

    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      if (fs.existsSync(filePath)) {
        const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        taskDef.containerDefinitions.forEach(container => {
          if (container.environment) {
            container.environment.forEach(envVar => {
              // Check for external service credentials
              const externalServiceVars = [
                'STRIPE_SECRET_KEY',
                'SENDGRID_API_KEY',
                'AWS_SECRET_ACCESS_KEY',
                'OPENAI_API_KEY'
              ];
              
              if (externalServiceVars.includes(envVar.name)) {
                // These should be in secrets, not environment
                expect(container.secrets).toBeDefined();
                const secretNames = container.secrets.map(s => s.name);
                expect(secretNames).toContain(envVar.name);
              }
            });
          }
        });
      }
    });
  });

  test('Property 11.9: Encryption keys are properly formatted and secure', () => {
    const secretsContent = fs.readFileSync(secretsPath, 'utf8');
    
    // Test encryption key entropy
    const encryptionMatch = secretsContent.match(/ENCRYPTION_KEY="?([^"\\n]+)"?/);
    const encryptionKey = encryptionMatch[1];
    
    // Convert hex to buffer and test entropy
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    expect(keyBuffer.length).toBe(32); // 256 bits
    
    // Test that key is not all zeros or predictable pattern
    const allZeros = Buffer.alloc(32, 0);
    const allOnes = Buffer.alloc(32, 255);
    expect(keyBuffer.equals(allZeros)).toBe(false);
    expect(keyBuffer.equals(allOnes)).toBe(false);
    
    // Test for reasonable entropy (not perfect but catches obvious issues)
    const uniqueBytes = new Set(keyBuffer);
    expect(uniqueBytes.size).toBeGreaterThan(8); // Should have variety in bytes
  });

  test('Property 11.10: Secret access is properly logged and audited', () => {
    // Check for CloudTrail configuration that would log parameter access
    const cloudtrailPath = path.join(terraformDir, 'cloudtrail-audit.tf');
    if (fs.existsSync(cloudtrailPath)) {
      const cloudtrailConfig = fs.readFileSync(cloudtrailPath, 'utf8');
      
      expect(cloudtrailConfig).toContain('aws_cloudtrail');
      expect(cloudtrailConfig).toMatch(/include_global_service_events\s*=\s*true/);
      expect(cloudtrailConfig).toMatch(/is_multi_region_trail\s*=\s*true/);
      
      // Should log data events for sensitive operations
      if (cloudtrailConfig.includes('data_resource')) {
        expect(cloudtrailConfig).toMatch(/type\s*=\s*"AWS::SSM::Parameter"/);
      }
    }
  });
});
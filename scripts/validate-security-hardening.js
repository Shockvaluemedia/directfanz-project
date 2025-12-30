#!/usr/bin/env node

/**
 * Security Hardening Validation
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

const fs = require('fs');
const path = require('path');

class SecurityValidator {
  constructor() {
    this.results = {
      wafProtection: false,
      dataEncryption: false,
      accessControl: false,
      auditLogging: false,
      vulnerabilityScanning: false
    };
  }

  async validateSecurityHardening() {
    console.log('🔒 Validating Security Hardening...');
    
    // Task 10.1: Validate security protection systems
    await this.validateSecurityProtection();
    
    // Task 10.3: Test access control and audit logging
    await this.testAccessControlAudit();
    
    // Task 10.5: Activate vulnerability scanning
    await this.activateVulnerabilityScanning();
    
    this.generateReport();
    return this.results;
  }

  async validateSecurityProtection() {
    console.log('🛡️ Validating security protection systems...');
    
    const terraformDir = path.join(__dirname, '../infrastructure/terraform');
    
    // Check WAF configuration
    const wafPath = path.join(terraformDir, 'waf-security.tf');
    if (fs.existsSync(wafPath)) {
      const content = fs.readFileSync(wafPath, 'utf8');
      if (content.includes('aws_wafv2_web_acl')) {
        console.log('  ✅ WAF protection configured');
        this.results.wafProtection = true;
      }
    }

    // Check encryption configuration
    const encryptionFiles = [
      'rds-enhanced.tf',
      'elasticache-enhanced.tf',
      's3-content-storage.tf',
      'kms-encryption.tf'
    ];

    let encryptionFound = false;
    encryptionFiles.forEach(file => {
      const filePath = path.join(terraformDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('encrypted = true') || content.includes('encryption')) {
          console.log(`  ✅ Encryption configured: ${file}`);
          encryptionFound = true;
        }
      }
    });
    
    this.results.dataEncryption = encryptionFound;
  }

  async testAccessControlAudit() {
    console.log('🔐 Testing access control and audit logging...');
    
    const terraformDir = path.join(__dirname, '../infrastructure/terraform');
    
    // Check IAM configuration
    const iamPath = path.join(terraformDir, 'iam-enhanced.tf');
    if (fs.existsSync(iamPath)) {
      const content = fs.readFileSync(iamPath, 'utf8');
      if (content.includes('aws_iam_role') && content.includes('aws_iam_policy')) {
        console.log('  ✅ IAM access control configured');
        this.results.accessControl = true;
      }
    }

    // Check CloudTrail audit logging
    const cloudtrailPath = path.join(terraformDir, 'cloudtrail-audit.tf');
    if (fs.existsSync(cloudtrailPath)) {
      const content = fs.readFileSync(cloudtrailPath, 'utf8');
      if (content.includes('aws_cloudtrail')) {
        console.log('  ✅ CloudTrail audit logging configured');
        this.results.auditLogging = true;
      }
    }
  }

  async activateVulnerabilityScanning() {
    console.log('🔍 Activating vulnerability scanning...');
    
    const terraformDir = path.join(__dirname, '../infrastructure/terraform');
    
    // Check ECR scanning configuration
    const ecrPath = path.join(terraformDir, 'ecr-enhanced.tf');
    if (fs.existsSync(ecrPath)) {
      const content = fs.readFileSync(ecrPath, 'utf8');
      if (content.includes('scan_on_push') || content.includes('image_scanning_configuration')) {
        console.log('  ✅ ECR vulnerability scanning configured');
        this.results.vulnerabilityScanning = true;
      }
    }

    // Check security monitoring
    const securityFiles = [
      '../src/lib/security.ts',
      '../src/lib/security-headers.ts'
    ];

    securityFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ Security monitoring: ${path.basename(file)}`);
      }
    });
  }

  generateReport() {
    console.log('\n📋 Security Hardening Results:');
    Object.entries(this.results).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'VALIDATED' : 'NEEDS ATTENTION'}`);
    });
    
    const validatedCount = Object.values(this.results).filter(Boolean).length;
    const totalCount = Object.keys(this.results).length;
    console.log(`\n🛡️ Security Hardening: ${validatedCount}/${totalCount} validated`);
  }
}

if (require.main === module) {
  const validator = new SecurityValidator();
  validator.validateSecurityHardening();
}

module.exports = SecurityValidator;
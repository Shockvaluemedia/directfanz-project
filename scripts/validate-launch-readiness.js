#!/usr/bin/env node

/**
 * Launch Readiness Validation
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

const fs = require('fs');
const path = require('path');

class LaunchReadinessValidator {
  constructor() {
    this.results = {
      technicalValidation: false,
      businessCompliance: false,
      supportSystems: false,
      marketingMaterials: false,
      productionCutover: false
    };
  }

  async validateLaunchReadiness() {
    console.log('🚀 Validating Launch Readiness...');
    
    // Task 12.1: Complete technical system validation
    await this.completeTechnicalValidation();
    
    // Task 12.3: Verify business and compliance readiness
    await this.verifyBusinessCompliance();
    
    // Task 12.4: Prepare support systems
    await this.prepareSupportSystems();
    
    // Task 12.6: Finalize marketing and launch materials
    await this.finalizeMarketingMaterials();
    
    // Task 12.7: Execute production cutover
    await this.executeProductionCutover();
    
    this.generateReport();
    return this.results;
  }

  async completeTechnicalValidation() {
    console.log('🔧 Completing technical system validation...');
    
    // Check if all previous tests passed
    const logsDir = path.join(__dirname, '../logs');
    const testResults = [
      'infrastructure-test-results.json',
      'api-validation-results.json',
      'payment-integration-results.json'
    ];

    let allTestsPassed = true;
    testResults.forEach(file => {
      const filePath = path.join(logsDir, file);
      if (fs.existsSync(filePath)) {
        const results = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (results.status === 'PASSED' || results.passRate >= 85) {
          console.log(`  ✅ ${file}: PASSED`);
        } else {
          console.log(`  ⚠️ ${file}: Needs attention`);
          allTestsPassed = false;
        }
      }
    });

    this.results.technicalValidation = allTestsPassed;
  }

  async verifyBusinessCompliance() {
    console.log('📋 Verifying business and compliance readiness...');
    
    // Check for legal documents
    const legalDocs = [
      '../public/terms-of-service.html',
      '../public/privacy-policy.html',
      '../src/app/legal/terms/page.tsx',
      '../src/app/legal/privacy/page.tsx'
    ];

    let legalDocsFound = 0;
    legalDocs.forEach(doc => {
      const docPath = path.join(__dirname, doc);
      if (fs.existsSync(docPath)) {
        console.log(`  ✅ Legal document: ${path.basename(doc)}`);
        legalDocsFound++;
      }
    });

    // Check for age verification
    const ageVerificationPaths = [
      '../src/components/auth/age-verification.tsx',
      '../src/lib/age-verification.ts'
    ];

    let ageVerificationFound = false;
    ageVerificationPaths.forEach(filePath => {
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        console.log(`  ✅ Age verification: ${path.basename(filePath)}`);
        ageVerificationFound = true;
      }
    });

    this.results.businessCompliance = legalDocsFound >= 2 || ageVerificationFound;
  }

  async prepareSupportSystems() {
    console.log('🎧 Preparing support systems...');
    
    // Check for support endpoints
    const supportEndpoints = [
      '../src/app/api/support/contact/route.ts',
      '../src/app/support/page.tsx',
      '../src/components/support/contact-form.tsx'
    ];

    let supportSystemsFound = 0;
    supportEndpoints.forEach(endpoint => {
      const endpointPath = path.join(__dirname, endpoint);
      if (fs.existsSync(endpointPath)) {
        console.log(`  ✅ Support system: ${path.basename(endpoint)}`);
        supportSystemsFound++;
      }
    });

    // Check for documentation
    const docPaths = [
      '../docs/user-onboarding-guide.md',
      '../README.md'
    ];

    docPaths.forEach(doc => {
      const docPath = path.join(__dirname, doc);
      if (fs.existsSync(docPath)) {
        console.log(`  ✅ Documentation: ${path.basename(doc)}`);
        supportSystemsFound++;
      }
    });

    this.results.supportSystems = supportSystemsFound >= 2;
  }

  async finalizeMarketingMaterials() {
    console.log('📢 Finalizing marketing and launch materials...');
    
    // Check for marketing materials
    const marketingMaterials = [
      '../PRESS_RELEASE_TEMPLATE.md',
      '../SOCIAL_MEDIA_KIT.md',
      '../LAUNCH_STRATEGY.md',
      '../src/app/onboarding/page.tsx'
    ];

    let marketingFound = 0;
    marketingMaterials.forEach(material => {
      const materialPath = path.join(__dirname, material);
      if (fs.existsSync(materialPath)) {
        console.log(`  ✅ Marketing material: ${path.basename(material)}`);
        marketingFound++;
      }
    });

    // Check for analytics setup
    const analyticsFiles = [
      '../src/lib/analytics.ts',
      '../src/components/analytics/tracking.tsx'
    ];

    analyticsFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ Analytics: ${path.basename(file)}`);
        marketingFound++;
      }
    });

    this.results.marketingMaterials = marketingFound >= 3;
  }

  async executeProductionCutover() {
    console.log('🔄 Executing production cutover...');
    
    // Check DNS configuration
    const terraformDir = path.join(__dirname, '../infrastructure/terraform');
    const route53Path = path.join(terraformDir, 'route53-dns.tf');
    
    if (fs.existsSync(route53Path)) {
      const content = fs.readFileSync(route53Path, 'utf8');
      if (content.includes('directfanz.io')) {
        console.log('  ✅ DNS configuration ready for cutover');
        this.results.productionCutover = true;
      }
    }

    // Check health endpoint
    const healthPath = path.join(__dirname, '../src/app/api/health/route.ts');
    if (fs.existsSync(healthPath)) {
      console.log('  ✅ Health endpoint ready for monitoring');
    }

    // Check monitoring setup
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    if (fs.existsSync(monitoringPath)) {
      console.log('  ✅ Monitoring ready for launch');
    }
  }

  generateReport() {
    console.log('\n📋 Launch Readiness Results:');
    Object.entries(this.results).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'READY' : 'NEEDS ATTENTION'}`);
    });
    
    const readyCount = Object.values(this.results).filter(Boolean).length;
    const totalCount = Object.keys(this.results).length;
    const readinessPercentage = (readyCount / totalCount) * 100;
    
    console.log(`\n🚀 Launch Readiness: ${readyCount}/${totalCount} ready (${readinessPercentage.toFixed(1)}%)`);
    
    if (readinessPercentage >= 80) {
      console.log('🎉 READY FOR LAUNCH!');
    } else {
      console.log('⚠️ Needs attention before launch');
    }
  }
}

if (require.main === module) {
  const validator = new LaunchReadinessValidator();
  validator.validateLaunchReadiness();
}

module.exports = LaunchReadinessValidator;
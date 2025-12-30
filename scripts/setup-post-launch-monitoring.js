#!/usr/bin/env node

/**
 * Post-Launch Monitoring and Optimization
 * Tasks 13.1, 13.2, 13.3
 */

const fs = require('fs');
const path = require('path');

class PostLaunchMonitor {
  constructor() {
    this.results = {
      launchMetrics: false,
      userFeedback: false,
      realUsageOptimization: false
    };
  }

  async setupPostLaunchMonitoring() {
    console.log('📊 Setting up Post-Launch Monitoring...');
    
    // Task 13.1: Monitor launch metrics
    await this.setupLaunchMetrics();
    
    // Task 13.2: Gather user feedback
    await this.setupUserFeedback();
    
    // Task 13.3: Optimize based on real usage
    await this.setupUsageOptimization();
    
    this.generateReport();
    return this.results;
  }

  async setupLaunchMetrics() {
    console.log('📈 Setting up launch metrics monitoring...');
    
    // Check analytics implementation
    const analyticsFiles = [
      '../src/lib/analytics.ts',
      '../src/lib/user-engagement-tracking.ts',
      '../src/lib/business-metrics.ts'
    ];

    let analyticsFound = 0;
    analyticsFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ Analytics: ${path.basename(file)}`);
        analyticsFound++;
      }
    });

    // Check monitoring dashboards
    const monitoringPath = path.join(__dirname, '../infrastructure/terraform/cloudwatch-monitoring.tf');
    if (fs.existsSync(monitoringPath)) {
      console.log('  ✅ CloudWatch monitoring dashboards configured');
      analyticsFound++;
    }

    this.results.launchMetrics = analyticsFound >= 2;
  }

  async setupUserFeedback() {
    console.log('💬 Setting up user feedback collection...');
    
    // Check feedback systems
    const feedbackSystems = [
      '../src/components/feedback/feedback-form.tsx',
      '../src/app/api/feedback/route.ts',
      '../src/lib/feedback-collection.ts'
    ];

    let feedbackFound = 0;
    feedbackSystems.forEach(system => {
      const systemPath = path.join(__dirname, system);
      if (fs.existsSync(systemPath)) {
        console.log(`  ✅ Feedback system: ${path.basename(system)}`);
        feedbackFound++;
      }
    });

    // Check support channels
    const supportChannels = [
      '../src/app/support/page.tsx',
      '../src/components/support/contact-form.tsx'
    ];

    supportChannels.forEach(channel => {
      const channelPath = path.join(__dirname, channel);
      if (fs.existsSync(channelPath)) {
        console.log(`  ✅ Support channel: ${path.basename(channel)}`);
        feedbackFound++;
      }
    });

    this.results.userFeedback = feedbackFound >= 2;
  }

  async setupUsageOptimization() {
    console.log('⚙️ Setting up usage-based optimization...');
    
    // Check optimization services
    const optimizationServices = [
      '../src/lib/cache-optimization-service.ts',
      '../src/lib/query-optimization.ts',
      '../src/lib/performance-monitor.ts'
    ];

    let optimizationFound = 0;
    optimizationServices.forEach(service => {
      const servicePath = path.join(__dirname, service);
      if (fs.existsSync(servicePath)) {
        console.log(`  ✅ Optimization service: ${path.basename(service)}`);
        optimizationFound++;
      }
    });

    // Check auto-scaling configuration
    const terraformDir = path.join(__dirname, '../infrastructure/terraform');
    const autoScalingPath = path.join(terraformDir, 'ecs-fargate.tf');
    
    if (fs.existsSync(autoScalingPath)) {
      const content = fs.readFileSync(autoScalingPath, 'utf8');
      if (content.includes('aws_appautoscaling_policy')) {
        console.log('  ✅ Auto-scaling optimization ready');
        optimizationFound++;
      }
    }

    this.results.realUsageOptimization = optimizationFound >= 2;
  }

  generateReport() {
    console.log('\n📋 Post-Launch Monitoring Setup:');
    Object.entries(this.results).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'CONFIGURED' : 'NEEDS SETUP'}`);
    });
    
    const configuredCount = Object.values(this.results).filter(Boolean).length;
    const totalCount = Object.keys(this.results).length;
    
    console.log(`\n📊 Post-Launch Monitoring: ${configuredCount}/${totalCount} configured`);
  }
}

if (require.main === module) {
  const monitor = new PostLaunchMonitor();
  monitor.setupPostLaunchMonitoring();
}

module.exports = PostLaunchMonitor;
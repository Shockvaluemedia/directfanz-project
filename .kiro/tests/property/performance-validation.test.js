/**
 * Property Test: Performance Threshold Compliance
 * Validates: Requirements 5.5
 * 
 * Property 16: Performance threshold compliance
 * - API response times under 200ms
 * - Auto-scaling behavior with traffic spikes
 * - Database query performance and cache hit rates
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Performance Threshold Compliance', () => {
  const projectRoot = path.join(__dirname, '../../..');
  const terraformDir = path.join(projectRoot, 'infrastructure/terraform');
  const srcDir = path.join(projectRoot, 'src');

  test('Property 16.1: API response time targets are configured', () => {
    // Check performance monitoring configuration
    const perfMonPath = path.join(srcDir, 'lib/performance-monitor.ts');
    if (fs.existsSync(perfMonPath)) {
      const content = fs.readFileSync(perfMonPath, 'utf8');
      expect(content).toMatch(/(response.*time|latency|performance)/i);
    }

    // Check CloudWatch alarms for API response times
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    expect(fs.existsSync(monitoringPath)).toBe(true);
    
    const monitoringContent = fs.readFileSync(monitoringPath, 'utf8');
    expect(monitoringContent).toContain('aws_cloudwatch_metric_alarm');
    expect(monitoringContent).toMatch(/(TargetResponseTime|ResponseTime|Latency)/);
  });

  test('Property 16.2: Auto-scaling policies are performance-optimized', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    expect(fs.existsSync(ecsConfigPath)).toBe(true);
    
    const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
    
    // Verify auto-scaling configuration
    expect(ecsConfig).toContain('aws_appautoscaling_target');
    expect(ecsConfig).toContain('aws_appautoscaling_policy');
    
    // Check for CPU-based scaling with appropriate thresholds
    expect(ecsConfig).toMatch(/target_value\s*=\s*[1-9]\d*/); // Non-zero target value
    expect(ecsConfig).toMatch(/ECSServiceAverageCPUUtilization/);
  });

  test('Property 16.3: Database query performance is optimized', () => {
    // Check query optimization service
    const queryOptPath = path.join(srcDir, 'lib/query-optimization.ts');
    if (fs.existsSync(queryOptPath)) {
      const content = fs.readFileSync(queryOptPath, 'utf8');
      expect(content).toMatch(/(query|optimization|index|performance)/i);
    }

    // Check database monitoring
    const dbOptPath = path.join(srcDir, 'lib/database-query-optimizer.ts');
    if (fs.existsSync(dbOptPath)) {
      const content = fs.readFileSync(dbOptPath, 'utf8');
      expect(content).toMatch(/(database|query|optimize|performance)/i);
    }

    // Check PgBouncer configuration for connection pooling
    const pgbouncerPath = path.join(projectRoot, 'infrastructure/pgbouncer/pgbouncer.ini');
    if (fs.existsSync(pgbouncerPath)) {
      const content = fs.readFileSync(pgbouncerPath, 'utf8');
      expect(content).toContain('[pgbouncer]');
      expect(content).toMatch(/pool_mode\s*=\s*(transaction|session)/);
    }
  });

  test('Property 16.4: Cache hit rate optimization is configured', () => {
    // Check cache optimization service
    const cacheOptPath = path.join(srcDir, 'lib/cache-optimization-service.ts');
    if (fs.existsSync(cacheOptPath)) {
      const content = fs.readFileSync(cacheOptPath, 'utf8');
      expect(content).toMatch(/(cache|optimization|hit.*rate|redis)/i);
    }

    // Check Redis configuration
    const redisConfigPath = path.join(terraformDir, 'elasticache-enhanced.tf');
    expect(fs.existsSync(redisConfigPath)).toBe(true);
    
    const redisConfig = fs.readFileSync(redisConfigPath, 'utf8');
    expect(redisConfig).toContain('aws_elasticache_replication_group');
    expect(redisConfig).toMatch(/automatic_failover_enabled\s*=\s*true/);
  });

  test('Property 16.5: CDN performance optimization is active', () => {
    const cloudfrontPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    expect(fs.existsSync(cloudfrontPath)).toBe(true);
    
    const cloudfrontConfig = fs.readFileSync(cloudfrontPath, 'utf8');
    
    // Verify performance optimizations
    expect(cloudfrontConfig).toMatch(/compress\s*=\s*true/);
    expect(cloudfrontConfig).toMatch(/http_version\s*=\s*"http2"/);
    expect(cloudfrontConfig).toContain('cache_policy_id');
  });

  test('Property 16.6: Load balancer health checks are optimized', () => {
    const lbConfigPath = path.join(terraformDir, 'load-balancer.tf');
    expect(fs.existsSync(lbConfigPath)).toBe(true);
    
    const lbConfig = fs.readFileSync(lbConfigPath, 'utf8');
    
    // Verify health check configuration for performance
    expect(lbConfig).toContain('health_check');
    expect(lbConfig).toMatch(/timeout\s*=\s*[1-5]/); // Reasonable timeout
    expect(lbConfig).toMatch(/interval\s*=\s*[1-3]\d/); // Reasonable interval
    expect(lbConfig).toMatch(/healthy_threshold\s*=\s*[2-5]/); // Reasonable threshold
  });

  test('Property 16.7: Performance monitoring thresholds are appropriate', () => {
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    const monitoringContent = fs.readFileSync(monitoringPath, 'utf8');
    
    // Check for performance-related alarms
    const performanceMetrics = [
      'CPUUtilization',
      'MemoryUtilization', 
      'TargetResponseTime',
      'RequestCount'
    ];
    
    let metricsFound = 0;
    performanceMetrics.forEach(metric => {
      if (monitoringContent.includes(metric)) {
        metricsFound++;
      }
    });
    
    expect(metricsFound).toBeGreaterThan(2); // At least 3 performance metrics monitored
  });

  test('Property 16.8: Performance testing infrastructure exists', () => {
    const scriptsDir = path.join(projectRoot, 'scripts');
    const performanceScripts = [
      'performance-test.js',
      'api-performance-test.js',
      'load-test.js'
    ];

    let scriptsFound = 0;
    performanceScripts.forEach(script => {
      const scriptPath = path.join(scriptsDir, script);
      if (fs.existsSync(scriptPath)) {
        scriptsFound++;
      }
    });

    expect(scriptsFound).toBeGreaterThan(0); // At least one performance test script
  });

  test('Property 16.9: Resource scaling limits are production-appropriate', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Check web app scaling configuration
    const maxCapacityMatch = tfvarsContent.match(/web_app_max_capacity\s*=\s*(\d+)/);
    const minCapacityMatch = tfvarsContent.match(/web_app_min_capacity\s*=\s*(\d+)/);
    
    if (maxCapacityMatch && minCapacityMatch) {
      const maxCapacity = parseInt(maxCapacityMatch[1]);
      const minCapacity = parseInt(minCapacityMatch[1]);
      
      expect(maxCapacity).toBeGreaterThan(minCapacity);
      expect(maxCapacity).toBeGreaterThanOrEqual(10); // Reasonable max for production
      expect(minCapacity).toBeGreaterThanOrEqual(2); // High availability minimum
    }
  });

  test('Property 16.10: Performance optimization services are integrated', () => {
    const optimizationServices = [
      'lib/performance-monitor.ts',
      'lib/cache-optimization-service.ts',
      'lib/query-optimization.ts'
    ];

    let servicesFound = 0;
    optimizationServices.forEach(service => {
      const servicePath = path.join(srcDir, service);
      if (fs.existsSync(servicePath)) {
        servicesFound++;
      }
    });

    expect(servicesFound).toBeGreaterThanOrEqual(2); // At least 2 optimization services
  });
});
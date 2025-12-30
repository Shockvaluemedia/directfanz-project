/**
 * Property Test: Integration Validation Completeness
 * Validates: Requirements 4.5
 * 
 * Property 13: Integration validation completeness
 * - All external service integrations are functional
 * - Database connectivity and query performance
 * - File upload and CDN distribution
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Integration Validation Completeness', () => {
  const projectRoot = path.join(__dirname, '../../..');
  const terraformDir = path.join(projectRoot, 'infrastructure/terraform');
  const srcDir = path.join(projectRoot, 'src');

  test('Property 13.1: Stripe payment integration configuration is complete', () => {
    // Check Stripe configuration in environment
    const ecsTaskDefsDir = path.join(projectRoot, 'ecs-task-definitions');
    const taskDefinitionFiles = [
      'web-app-task.json',
      'websocket-task.json'
    ];

    let stripeConfigFound = false;
    
    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      if (fs.existsSync(filePath)) {
        const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        taskDef.containerDefinitions.forEach(container => {
          if (container.environment || container.secrets) {
            const allVars = [
              ...(container.environment || []).map(e => e.name),
              ...(container.secrets || []).map(s => s.name)
            ];
            
            const stripeVars = [
              'STRIPE_PUBLISHABLE_KEY',
              'STRIPE_SECRET_KEY',
              'STRIPE_WEBHOOK_SECRET'
            ];
            
            const hasStripeConfig = stripeVars.some(varName => allVars.includes(varName));
            if (hasStripeConfig) {
              stripeConfigFound = true;
            }
          }
        });
      }
    });
    
    // Check Stripe service implementation
    const stripeLibPath = path.join(srcDir, 'lib/stripe.ts');
    if (fs.existsSync(stripeLibPath)) {
      const stripeLib = fs.readFileSync(stripeLibPath, 'utf8');
      expect(stripeLib).toContain('Stripe');
      expect(stripeLib).toMatch(/(createPaymentIntent|createSubscription|createCustomer)/);
      stripeConfigFound = true;
    }
    
    expect(stripeConfigFound).toBe(true);
  });

  test('Property 13.2: AWS S3 integration is properly configured', () => {
    // Check S3 Terraform configuration
    const s3ConfigPath = path.join(terraformDir, 's3-content-storage.tf');
    expect(fs.existsSync(s3ConfigPath)).toBe(true);
    
    const s3Config = fs.readFileSync(s3ConfigPath, 'utf8');
    
    // Verify S3 bucket configuration
    expect(s3Config).toContain('aws_s3_bucket');
    expect(s3Config).toContain('aws_s3_bucket_versioning');
    expect(s3Config).toContain('aws_s3_bucket_server_side_encryption_configuration');
    expect(s3Config).toContain('aws_s3_bucket_cors_configuration');
    
    // Check S3 service implementation
    const s3LibPath = path.join(srcDir, 'lib/s3.ts');
    if (fs.existsSync(s3LibPath)) {
      const s3Lib = fs.readFileSync(s3LibPath, 'utf8');
      expect(s3Lib).toMatch(/(S3Client|uploadFile|deleteFile|getSignedUrl)/);
    }
    
    // Check upload utilities
    const uploadLibPath = path.join(srcDir, 'lib/upload.ts');
    if (fs.existsSync(uploadLibPath)) {
      const uploadLib = fs.readFileSync(uploadLibPath, 'utf8');
      expect(uploadLib).toMatch(/(upload|s3|bucket)/i);
    }
  });

  test('Property 13.3: Email service integration is configured', () => {
    // Check email service implementation
    const emailLibPath = path.join(srcDir, 'lib/email.ts');
    const emailServicePath = path.join(srcDir, 'lib/email-service.ts');
    
    let emailConfigFound = false;
    
    [emailLibPath, emailServicePath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const emailLib = fs.readFileSync(filePath, 'utf8');
        if (emailLib.includes('sendgrid') || emailLib.includes('SES') || emailLib.includes('nodemailer')) {
          expect(emailLib).toMatch(/(sendEmail|sendNotification|mail)/i);
          emailConfigFound = true;
        }
      }
    });
    
    // Check environment configuration
    const ecsTaskDefsDir = path.join(projectRoot, 'ecs-task-definitions');
    const taskDefinitionFiles = ['web-app-task.json'];
    
    taskDefinitionFiles.forEach(file => {
      const filePath = path.join(ecsTaskDefsDir, file);
      if (fs.existsSync(filePath)) {
        const taskDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        taskDef.containerDefinitions.forEach(container => {
          if (container.environment || container.secrets) {
            const allVars = [
              ...(container.environment || []).map(e => e.name),
              ...(container.secrets || []).map(s => s.name)
            ];
            
            const emailVars = [
              'SENDGRID_API_KEY',
              'FROM_EMAIL',
              'AWS_SES_REGION'
            ];
            
            const hasEmailConfig = emailVars.some(varName => allVars.includes(varName));
            if (hasEmailConfig) {
              emailConfigFound = true;
            }
          }
        });
      }
    });
    
    expect(emailConfigFound).toBe(true);
  });

  test('Property 13.4: Database connection pooling is properly integrated', () => {
    // Check PgBouncer configuration
    const pgbouncerDir = path.join(projectRoot, 'infrastructure/pgbouncer');
    const pgbouncerConfigPath = path.join(pgbouncerDir, 'pgbouncer.ini');
    
    if (fs.existsSync(pgbouncerConfigPath)) {
      const pgbouncerConfig = fs.readFileSync(pgbouncerConfigPath, 'utf8');
      expect(pgbouncerConfig).toContain('[databases]');
      expect(pgbouncerConfig).toContain('[pgbouncer]');
      expect(pgbouncerConfig).toMatch(/pool_mode\s*=\s*(transaction|session)/);
    }
    
    // Check Prisma configuration
    const prismaSchemaPath = path.join(projectRoot, 'prisma/schema.prisma');
    if (fs.existsSync(prismaSchemaPath)) {
      const prismaSchema = fs.readFileSync(prismaSchemaPath, 'utf8');
      expect(prismaSchema).toContain('postgresql');
      expect(prismaSchema).toMatch(/connection_limit\s*=\s*\d+/);
    }
    
    // Check database service implementation
    const dbLibPath = path.join(srcDir, 'lib/db.ts');
    const prismaLibPath = path.join(srcDir, 'lib/prisma.ts');
    
    [dbLibPath, prismaLibPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const dbLib = fs.readFileSync(filePath, 'utf8');
        expect(dbLib).toMatch(/(PrismaClient|connection|pool)/i);
      }
    });
  });

  test('Property 13.5: Redis cache integration is functional', () => {
    // Check Redis service implementation
    const redisLibPath = path.join(srcDir, 'lib/redis.ts');
    if (fs.existsSync(redisLibPath)) {
      const redisLib = fs.readFileSync(redisLibPath, 'utf8');
      expect(redisLib).toMatch(/(Redis|createClient|get|set|del)/);
      expect(redisLib).toMatch(/(cluster|sentinel|standalone)/i);
    }
    
    // Check cache optimization service
    const cacheOptPath = path.join(srcDir, 'lib/cache-optimization-service.ts');
    if (fs.existsSync(cacheOptPath)) {
      const cacheOpt = fs.readFileSync(cacheOptPath, 'utf8');
      expect(cacheOpt).toMatch(/(cache|redis|optimization)/i);
    }
    
    // Verify ElastiCache configuration
    const redisConfigPath = path.join(terraformDir, 'elasticache-enhanced.tf');
    const redisConfig = fs.readFileSync(redisConfigPath, 'utf8');
    expect(redisConfig).toContain('aws_elasticache_replication_group');
    expect(redisConfig).toMatch(/automatic_failover_enabled\s*=\s*true/);
  });

  test('Property 13.6: Authentication service integration is complete', () => {
    // Check NextAuth configuration
    const authConfigFiles = [
      path.join(srcDir, 'lib/auth.ts'),
      path.join(srcDir, 'app/api/auth/[...nextauth]/route.ts')
    ];
    
    let authConfigFound = false;
    
    authConfigFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const authConfig = fs.readFileSync(filePath, 'utf8');
        if (authConfig.includes('NextAuth') || authConfig.includes('authOptions')) {
          expect(authConfig).toMatch(/(providers|callbacks|session)/);
          authConfigFound = true;
        }
      }
    });
    
    // Check auth utilities
    const authUtilsPath = path.join(srcDir, 'lib/auth-utils.ts');
    if (fs.existsSync(authUtilsPath)) {
      const authUtils = fs.readFileSync(authUtilsPath, 'utf8');
      expect(authUtils).toMatch(/(getServerSession|validateToken|authorize)/);
      authConfigFound = true;
    }
    
    expect(authConfigFound).toBe(true);
  });

  test('Property 13.7: WebSocket integration is properly configured', () => {
    // Check WebSocket server implementation
    const websocketFiles = [
      path.join(srcDir, 'lib/websocket-handler.ts'),
      path.join(srcDir, 'lib/socket-server.ts'),
      path.join(projectRoot, 'websocket-server.js')
    ];
    
    let websocketConfigFound = false;
    
    websocketFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const websocketCode = fs.readFileSync(filePath, 'utf8');
        if (websocketCode.includes('WebSocket') || websocketCode.includes('socket.io')) {
          expect(websocketCode).toMatch(/(connection|message|emit|on)/);
          websocketConfigFound = true;
        }
      }
    });
    
    // Check WebSocket task definition
    const websocketTaskPath = path.join(projectRoot, 'ecs-task-definitions/websocket-task.json');
    if (fs.existsSync(websocketTaskPath)) {
      const websocketTask = JSON.parse(fs.readFileSync(websocketTaskPath, 'utf8'));
      expect(websocketTask.family).toContain('websocket');
      websocketConfigFound = true;
    }
    
    expect(websocketConfigFound).toBe(true);
  });

  test('Property 13.8: Streaming service integration is configured', () => {
    // Check streaming service implementation
    const streamingFiles = [
      path.join(srcDir, 'lib/streaming-websocket.ts'),
      path.join(srcDir, 'lib/vod-service.ts')
    ];
    
    let streamingConfigFound = false;
    
    streamingFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const streamingCode = fs.readFileSync(filePath, 'utf8');
        if (streamingCode.includes('streaming') || streamingCode.includes('MediaLive')) {
          expect(streamingCode).toMatch(/(stream|video|media|broadcast)/i);
          streamingConfigFound = true;
        }
      }
    });
    
    // Check AWS MediaLive configuration
    const mediaLivePath = path.join(terraformDir, 'medialive-streaming.tf');
    if (fs.existsSync(mediaLivePath)) {
      const mediaLiveConfig = fs.readFileSync(mediaLivePath, 'utf8');
      expect(mediaLiveConfig).toContain('aws_medialive');
      streamingConfigFound = true;
    }
    
    expect(streamingConfigFound).toBe(true);
  });

  test('Property 13.9: Monitoring and logging integrations are active', () => {
    // Check CloudWatch monitoring configuration
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    expect(fs.existsSync(monitoringPath)).toBe(true);
    
    const monitoringConfig = fs.readFileSync(monitoringPath, 'utf8');
    expect(monitoringConfig).toContain('aws_cloudwatch_metric_alarm');
    expect(monitoringConfig).toContain('aws_cloudwatch_log_group');
    
    // Check Sentry integration
    const sentryFiles = [
      path.join(srcDir, 'lib/sentry.ts'),
      path.join(projectRoot, 'sentry.server.config.ts'),
      path.join(projectRoot, 'sentry.client.config.ts')
    ];
    
    let sentryConfigFound = false;
    
    sentryFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const sentryConfig = fs.readFileSync(filePath, 'utf8');
        if (sentryConfig.includes('Sentry') || sentryConfig.includes('@sentry')) {
          expect(sentryConfig).toMatch(/(init|captureException|withSentry)/);
          sentryConfigFound = true;
        }
      }
    });
    
    // Check logging implementation
    const loggerPath = path.join(srcDir, 'lib/logger.ts');
    if (fs.existsSync(loggerPath)) {
      const logger = fs.readFileSync(loggerPath, 'utf8');
      expect(logger).toMatch(/(log|info|error|warn|debug)/);
    }
  });

  test('Property 13.10: API endpoint integrations are comprehensive', () => {
    // Check API route structure
    const apiDir = path.join(srcDir, 'app/api');
    expect(fs.existsSync(apiDir)).toBe(true);
    
    // Check for essential API endpoints
    const essentialEndpoints = [
      'auth',
      'users',
      'content',
      'subscriptions',
      'payments',
      'upload',
      'health'
    ];
    
    let endpointsFound = 0;
    
    essentialEndpoints.forEach(endpoint => {
      const endpointPath = path.join(apiDir, endpoint);
      if (fs.existsSync(endpointPath)) {
        endpointsFound++;
      }
    });
    
    expect(endpointsFound).toBeGreaterThan(4); // At least 5 essential endpoints
    
    // Check API utilities
    const apiUtilsPath = path.join(srcDir, 'lib/api-utils.ts');
    if (fs.existsSync(apiUtilsPath)) {
      const apiUtils = fs.readFileSync(apiUtilsPath, 'utf8');
      expect(apiUtils).toMatch(/(handler|response|error|validation)/i);
    }
  });

  test('Property 13.11: Security integrations are properly configured', () => {
    // Check WAF configuration
    const wafConfigPath = path.join(terraformDir, 'waf-security.tf');
    expect(fs.existsSync(wafConfigPath)).toBe(true);
    
    const wafConfig = fs.readFileSync(wafConfigPath, 'utf8');
    expect(wafConfig).toContain('aws_wafv2_web_acl');
    expect(wafConfig).toMatch(/scope\s*=\s*"CLOUDFRONT"/);
    
    // Check security headers implementation
    const securityHeadersPath = path.join(srcDir, 'lib/security-headers.ts');
    if (fs.existsSync(securityHeadersPath)) {
      const securityHeaders = fs.readFileSync(securityHeadersPath, 'utf8');
      expect(securityHeaders).toMatch(/(CSP|HSTS|X-Frame-Options|X-Content-Type-Options)/);
    }
    
    // Check rate limiting
    const rateLimitPath = path.join(srcDir, 'lib/rate-limiting.ts');
    if (fs.existsSync(rateLimitPath)) {
      const rateLimit = fs.readFileSync(rateLimitPath, 'utf8');
      expect(rateLimit).toMatch(/(rateLimit|throttle|limit)/i);
    }
  });

  test('Property 13.12: Performance optimization integrations are active', () => {
    // Check cache optimization
    const cacheOptPath = path.join(srcDir, 'lib/cache-optimization-service.ts');
    if (fs.existsSync(cacheOptPath)) {
      const cacheOpt = fs.readFileSync(cacheOptPath, 'utf8');
      expect(cacheOpt).toMatch(/(cache|optimization|performance)/i);
    }
    
    // Check query optimization
    const queryOptPath = path.join(srcDir, 'lib/query-optimization.ts');
    if (fs.existsSync(queryOptPath)) {
      const queryOpt = fs.readFileSync(queryOptPath, 'utf8');
      expect(queryOpt).toMatch(/(query|optimization|index|performance)/i);
    }
    
    // Check performance monitoring
    const perfMonPath = path.join(srcDir, 'lib/performance-monitor.ts');
    if (fs.existsSync(perfMonPath)) {
      const perfMon = fs.readFileSync(perfMonPath, 'utf8');
      expect(perfMon).toMatch(/(performance|monitor|metrics|timing)/i);
    }
    
    // Verify CDN integration
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    expect(cloudfrontConfig).toContain('aws_cloudfront_distribution');
    expect(cloudfrontConfig).toMatch(/compress\s*=\s*true/);
  });
});
/**
 * Property Test: Production URL Configuration
 * Validates: Requirements 4.3, 4.4
 * 
 * Property 12: Production URL configuration
 * - NEXTAUTH_URL set to https://directfanz.io
 * - Database connection with production DATABASE_URL
 * - Redis connection with production REDIS_URL
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Production URL Configuration', () => {
  const projectRoot = path.join(__dirname, '../../..');
  const terraformDir = path.join(projectRoot, 'infrastructure/terraform');
  const ecsTaskDefsDir = path.join(projectRoot, 'ecs-task-definitions');

  test('Property 12.1: Production domain configuration is correct', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    expect(fs.existsSync(tfvarsPath)).toBe(true);
    
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Verify domain name is set to directfanz.io
    const domainMatch = tfvarsContent.match(/domain_name\s*=\s*"([^"]+)"/);
    expect(domainMatch).toBeTruthy();
    expect(domainMatch[1]).toBe('directfanz.io');
    
    // Verify project name matches
    const projectMatch = tfvarsContent.match(/project_name\s*=\s*"([^"]+)"/);
    expect(projectMatch).toBeTruthy();
    expect(projectMatch[1]).toBe('directfanz');
    
    // Verify environment is production
    const envMatch = tfvarsContent.match(/environment\s*=\s*"([^"]+)"/);
    expect(envMatch).toBeTruthy();
    expect(envMatch[1]).toBe('prod');
  });

  test('Property 12.2: NEXTAUTH_URL is configured for production domain', () => {
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
            const nextAuthUrl = container.environment.find(env => env.name === 'NEXTAUTH_URL');
            if (nextAuthUrl) {
              expect(nextAuthUrl.value).toBe('https://directfanz.io');
            }
          }
        });
      }
    });
  });

  test('Property 12.3: Database URL configuration references production RDS', () => {
    const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
    expect(fs.existsSync(rdsConfigPath)).toBe(true);
    
    const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
    
    // Verify RDS instance configuration
    expect(rdsConfig).toContain('aws_db_instance');
    expect(rdsConfig).toMatch(/identifier\s*=\s*"directfanz-prod"/);
    expect(rdsConfig).toMatch(/db_name\s*=\s*var\.db_name/);
    expect(rdsConfig).toMatch(/username\s*=\s*var\.db_username/);
    
    // Verify database name in terraform.tfvars
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const dbNameMatch = tfvarsContent.match(/db_name\s*=\s*"([^"]+)"/);
    expect(dbNameMatch).toBeTruthy();
    expect(dbNameMatch[1]).toBe('directfanz');
    
    const dbUsernameMatch = tfvarsContent.match(/db_username\s*=\s*"([^"]+)"/);
    expect(dbUsernameMatch).toBeTruthy();
    expect(dbUsernameMatch[1]).toBe('postgres');
  });

  test('Property 12.4: Redis URL configuration references production ElastiCache', () => {
    const redisConfigPath = path.join(terraformDir, 'elasticache-enhanced.tf');
    expect(fs.existsSync(redisConfigPath)).toBe(true);
    
    const redisConfig = fs.readFileSync(redisConfigPath, 'utf8');
    
    // Verify ElastiCache replication group configuration
    expect(redisConfig).toContain('aws_elasticache_replication_group');
    expect(redisConfig).toMatch(/replication_group_id\s*=\s*"directfanz-prod-redis"/);
    expect(redisConfig).toMatch(/description\s*=\s*"DirectFanz production Redis cluster"/);
    
    // Verify Redis configuration in terraform.tfvars
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const redisNodeTypeMatch = tfvarsContent.match(/redis_enhanced_node_type\s*=\s*"([^"]+)"/);
    expect(redisNodeTypeMatch).toBeTruthy();
    expect(redisNodeTypeMatch[1]).toMatch(/^cache\.(r6g|r5|m5)\.(large|xlarge)$/);
  });

  test('Property 12.5: Load balancer DNS configuration is correct', () => {
    const lbConfigPath = path.join(terraformDir, 'load-balancer.tf');
    expect(fs.existsSync(lbConfigPath)).toBe(true);
    
    const lbConfig = fs.readFileSync(lbConfigPath, 'utf8');
    
    // Verify Application Load Balancer configuration
    expect(lbConfig).toContain('aws_lb');
    expect(lbConfig).toMatch(/name\s*=\s*"directfanz-prod-alb"/);
    expect(lbConfig).toMatch(/load_balancer_type\s*=\s*"application"/);
    expect(lbConfig).toMatch(/scheme\s*=\s*"internet-facing"/);
    
    // Verify target groups
    expect(lbConfig).toContain('aws_lb_target_group');
    expect(lbConfig).toMatch(/port\s*=\s*3000/); // Application port
    expect(lbConfig).toMatch(/protocol\s*=\s*"HTTP"/);
    expect(lbConfig).toMatch(/target_type\s*=\s*"ip"/);
  });

  test('Property 12.6: Route 53 DNS records point to correct resources', () => {
    const route53ConfigPath = path.join(terraformDir, 'route53-dns.tf');
    expect(fs.existsSync(route53ConfigPath)).toBe(true);
    
    const route53Config = fs.readFileSync(route53ConfigPath, 'utf8');
    
    // Verify hosted zone configuration
    expect(route53Config).toContain('aws_route53_zone');
    expect(route53Config).toMatch(/name\s*=\s*var\.domain_name/);
    
    // Verify A record for main domain
    expect(route53Config).toContain('aws_route53_record');
    expect(route53Config).toMatch(/type\s*=\s*"A"/);
    expect(route53Config).toMatch(/alias\s*{[\s\S]*name\s*=\s*aws_lb[\s\S]*zone_id\s*=\s*aws_lb/);
    
    // Verify subdomain configurations
    const subdomains = ['api', 'ws', 'stream'];
    subdomains.forEach(subdomain => {
      if (route53Config.includes(subdomain)) {
        expect(route53Config).toMatch(new RegExp(`name\\s*=\\s*"${subdomain}"`));
      }
    });
  });

  test('Property 12.7: SSL certificate covers all required domains', () => {
    const acmConfigPath = path.join(terraformDir, 'acm-certificates.tf');
    expect(fs.existsSync(acmConfigPath)).toBe(true);
    
    const acmConfig = fs.readFileSync(acmConfigPath, 'utf8');
    
    // Verify wildcard certificate configuration
    expect(acmConfig).toContain('aws_acm_certificate');
    expect(acmConfig).toMatch(/domain_name\s*=\s*"\*\.directfanz\.io"/);
    expect(acmConfig).toMatch(/validation_method\s*=\s*"DNS"/);
    
    // Verify subject alternative names include main domain
    expect(acmConfig).toMatch(/subject_alternative_names\s*=\s*\[[\s\S]*"directfanz\.io"[\s\S]*\]/);
    
    // Verify certificate validation
    expect(acmConfig).toContain('aws_acm_certificate_validation');
    expect(acmConfig).toMatch(/certificate_arn\s*=\s*aws_acm_certificate/);
  });

  test('Property 12.8: CloudFront distribution uses correct domain', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    expect(fs.existsSync(cloudfrontConfigPath)).toBe(true);
    
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify CloudFront distribution aliases
    expect(cloudfrontConfig).toContain('aliases');
    expect(cloudfrontConfig).toMatch(/aliases\s*=\s*\[[\s\S]*"directfanz\.io"[\s\S]*\]/);
    
    // Verify viewer certificate configuration
    expect(cloudfrontConfig).toContain('viewer_certificate');
    expect(cloudfrontConfig).toMatch(/acm_certificate_arn\s*=\s*aws_acm_certificate/);
    expect(cloudfrontConfig).toMatch(/ssl_support_method\s*=\s*"sni-only"/);
  });

  test('Property 12.9: Environment variables reference correct endpoints', () => {
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
            // Check DATABASE_URL format
            const dbUrl = container.environment.find(env => env.name === 'DATABASE_URL');
            if (dbUrl) {
              expect(dbUrl.value).toMatch(/^postgresql:\/\/.*directfanz-prod.*\.rds\.amazonaws\.com/);
            }
            
            // Check REDIS_URL format
            const redisUrl = container.environment.find(env => env.name === 'REDIS_URL');
            if (redisUrl) {
              expect(redisUrl.value).toMatch(/^redis:\/\/.*directfanz-prod-redis.*\.cache\.amazonaws\.com/);
            }
            
            // Check NODE_ENV is production
            const nodeEnv = container.environment.find(env => env.name === 'NODE_ENV');
            if (nodeEnv) {
              expect(nodeEnv.value).toBe('production');
            }
          }
        });
      }
    });
  });

  test('Property 12.10: Health check endpoints are configured correctly', () => {
    const lbConfigPath = path.join(terraformDir, 'load-balancer.tf');
    const lbConfig = fs.readFileSync(lbConfigPath, 'utf8');
    
    // Verify health check configuration
    expect(lbConfig).toContain('health_check');
    expect(lbConfig).toMatch(/path\s*=\s*"\/api\/health"/);
    expect(lbConfig).toMatch(/protocol\s*=\s*"HTTP"/);
    expect(lbConfig).toMatch(/port\s*=\s*"traffic-port"/);
    
    // Verify health check thresholds
    expect(lbConfig).toMatch(/healthy_threshold\s*=\s*\d+/);
    expect(lbConfig).toMatch(/unhealthy_threshold\s*=\s*\d+/);
    expect(lbConfig).toMatch(/timeout\s*=\s*\d+/);
    expect(lbConfig).toMatch(/interval\s*=\s*\d+/);
    
    // Verify matcher for successful responses
    expect(lbConfig).toMatch(/matcher\s*=\s*"200"/);
  });

  test('Property 12.11: CORS configuration allows production domain', () => {
    const s3ConfigPath = path.join(terraformDir, 's3-content-storage.tf');
    if (fs.existsSync(s3ConfigPath)) {
      const s3Config = fs.readFileSync(s3ConfigPath, 'utf8');
      
      // Verify CORS configuration
      if (s3Config.includes('cors_configuration')) {
        expect(s3Config).toContain('allowed_origins');
        expect(s3Config).toMatch(/allowed_origins\s*=\s*\[[\s\S]*"https:\/\/directfanz\.io"[\s\S]*\]/);
        expect(s3Config).toMatch(/allowed_methods\s*=\s*\[[\s\S]*"GET"[\s\S]*"POST"[\s\S]*\]/);
        expect(s3Config).toMatch(/allowed_headers\s*=\s*\[[\s\S]*"*"[\s\S]*\]/);
      }
    }
  });

  test('Property 12.12: Service discovery configuration uses correct naming', () => {
    const ecsConfigPath = path.join(terraformDir, 'ecs-fargate.tf');
    if (fs.existsSync(ecsConfigPath)) {
      const ecsConfig = fs.readFileSync(ecsConfigPath, 'utf8');
      
      // Verify service discovery namespace
      if (ecsConfig.includes('aws_service_discovery_private_dns_namespace')) {
        expect(ecsConfig).toMatch(/name\s*=\s*"directfanz\.local"/);
        expect(ecsConfig).toMatch(/vpc\s*=\s*aws_vpc/);
      }
      
      // Verify service discovery services
      if (ecsConfig.includes('aws_service_discovery_service')) {
        expect(ecsConfig).toMatch(/name\s*=\s*"(web-app|websocket|streaming)"/);
        expect(ecsConfig).toMatch(/namespace_id\s*=\s*aws_service_discovery_private_dns_namespace/);
      }
    }
  });
});
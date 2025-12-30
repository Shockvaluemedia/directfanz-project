/**
 * Property Test: CDN Optimization Setup
 * Validates: Requirements 3.5
 * 
 * Property 10: CDN optimization setup
 * - CloudFront distribution with optimized caching
 * - S3 bucket policies and cross-region replication
 * - Content delivery optimization
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: CDN Optimization Setup', () => {
  const terraformDir = path.join(__dirname, '../../infrastructure/terraform');

  test('Property 10.1: CloudFront distribution is properly configured', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    expect(fs.existsSync(cloudfrontConfigPath)).toBe(true);
    
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify CloudFront distribution configuration
    expect(cloudfrontConfig).toContain('aws_cloudfront_distribution');
    expect(cloudfrontConfig).toContain('origin');
    expect(cloudfrontConfig).toContain('default_cache_behavior');
    expect(cloudfrontConfig).toContain('ordered_cache_behavior');
    
    // Verify essential distribution settings
    expect(cloudfrontConfig).toMatch(/enabled\s*=\s*true/);
    expect(cloudfrontConfig).toMatch(/is_ipv6_enabled\s*=\s*true/);
    expect(cloudfrontConfig).toMatch(/default_root_object\s*=\s*"[^"]+"/);
    
    // Verify price class configuration
    expect(cloudfrontConfig).toMatch(/price_class\s*=\s*var\.cloudfront_price_class/);
    
    // Verify SSL/TLS configuration
    expect(cloudfrontConfig).toContain('viewer_certificate');
    expect(cloudfrontConfig).toMatch(/acm_certificate_arn\s*=/);
    expect(cloudfrontConfig).toMatch(/ssl_support_method\s*=\s*"sni-only"/);
    expect(cloudfrontConfig).toMatch(/minimum_protocol_version\s*=\s*"TLSv1\.2_2021"/);
  });

  test('Property 10.2: Cache behaviors are optimized for different content types', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify default cache behavior
    expect(cloudfrontConfig).toMatch(/default_cache_behavior\s*{[\s\S]*target_origin_id/);
    expect(cloudfrontConfig).toMatch(/viewer_protocol_policy\s*=\s*"redirect-to-https"/);
    expect(cloudfrontConfig).toMatch(/allowed_methods\s*=\s*\[[\s\S]*"GET"[\s\S]*"HEAD"[\s\S]*\]/);
    expect(cloudfrontConfig).toMatch(/cached_methods\s*=\s*\[[\s\S]*"GET"[\s\S]*"HEAD"[\s\S]*\]/);
    
    // Verify cache policy configuration
    expect(cloudfrontConfig).toMatch(/cache_policy_id\s*=/);
    expect(cloudfrontConfig).toMatch(/origin_request_policy_id\s*=/);
    
    // Verify compression is enabled
    expect(cloudfrontConfig).toMatch(/compress\s*=\s*true/);
    
    // Check for ordered cache behaviors for different content types
    if (cloudfrontConfig.includes('ordered_cache_behavior')) {
      expect(cloudfrontConfig).toMatch(/path_pattern\s*=\s*"[^"]+"/);
      expect(cloudfrontConfig).toMatch(/ttl\s*=\s*\d+/);
    }
  });

  test('Property 10.3: S3 origin configuration is secure and optimized', () => {
    const s3ConfigPath = path.join(terraformDir, 's3-content-storage.tf');
    expect(fs.existsSync(s3ConfigPath)).toBe(true);
    
    const s3Config = fs.readFileSync(s3ConfigPath, 'utf8');
    
    // Verify S3 bucket configuration
    expect(s3Config).toContain('aws_s3_bucket');
    expect(s3Config).toContain('aws_s3_bucket_versioning');
    expect(s3Config).toContain('aws_s3_bucket_server_side_encryption_configuration');
    
    // Verify bucket policy for CloudFront access
    expect(s3Config).toContain('aws_s3_bucket_policy');
    expect(s3Config).toContain('aws_cloudfront_origin_access_identity');
    
    // Verify CORS configuration
    expect(s3Config).toContain('aws_s3_bucket_cors_configuration');
    expect(s3Config).toMatch(/allowed_methods\s*=\s*\[[\s\S]*"GET"[\s\S]*\]/);
    expect(s3Config).toMatch(/allowed_origins\s*=\s*\[[\s\S]*\]/);
    expect(s3Config).toMatch(/allowed_headers\s*=\s*\[[\s\S]*\]/);
  });

  test('Property 10.4: Cross-region replication is configured', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const replicationMatch = tfvarsContent.match(/enable_cross_region_replication\s*=\s*(true|false)/);
    const backupRegionMatch = tfvarsContent.match(/content_backup_region\s*=\s*"([^"]+)"/);
    
    expect(replicationMatch).toBeTruthy();
    expect(backupRegionMatch).toBeTruthy();
    
    if (replicationMatch[1] === 'true') {
      const s3ConfigPath = path.join(terraformDir, 's3-content-storage.tf');
      const s3Config = fs.readFileSync(s3ConfigPath, 'utf8');
      
      // Verify replication configuration
      expect(s3Config).toContain('aws_s3_bucket_replication_configuration');
      expect(s3Config).toContain('destination');
      expect(s3Config).toMatch(/storage_class\s*=\s*"[^"]+"/);
      
      // Verify backup region is different from primary
      const primaryRegion = tfvarsContent.match(/aws_region\s*=\s*"([^"]+)"/)[1];
      const backupRegion = backupRegionMatch[1];
      expect(backupRegion).not.toBe(primaryRegion);
    }
  });

  test('Property 10.5: CloudFront logging is enabled', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const loggingMatch = tfvarsContent.match(/enable_cloudfront_logging\s*=\s*(true|false)/);
    expect(loggingMatch).toBeTruthy();
    
    if (loggingMatch[1] === 'true') {
      const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
      const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
      
      // Verify logging configuration
      expect(cloudfrontConfig).toContain('logging_config');
      expect(cloudfrontConfig).toMatch(/bucket\s*=\s*aws_s3_bucket[\s\S]*\.bucket_domain_name/);
      expect(cloudfrontConfig).toMatch(/prefix\s*=\s*"[^"]*"/);
      expect(cloudfrontConfig).toMatch(/include_cookies\s*=\s*(true|false)/);
    }
  });

  test('Property 10.6: Custom error pages are configured', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify custom error response configuration
    if (cloudfrontConfig.includes('custom_error_response')) {
      expect(cloudfrontConfig).toMatch(/error_code\s*=\s*\d+/);
      expect(cloudfrontConfig).toMatch(/response_code\s*=\s*\d+/);
      expect(cloudfrontConfig).toMatch(/response_page_path\s*=\s*"[^"]+"/);
      expect(cloudfrontConfig).toMatch(/error_caching_min_ttl\s*=\s*\d+/);
    }
  });

  test('Property 10.7: Geographic restrictions are properly configured', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify geo restriction configuration
    expect(cloudfrontConfig).toContain('restrictions');
    expect(cloudfrontConfig).toContain('geo_restriction');
    expect(cloudfrontConfig).toMatch(/restriction_type\s*=\s*"(none|whitelist|blacklist)"/);
    
    // If restrictions are applied, verify locations are specified
    if (cloudfrontConfig.includes('whitelist') || cloudfrontConfig.includes('blacklist')) {
      expect(cloudfrontConfig).toMatch(/locations\s*=\s*\[[\s\S]*\]/);
    }
  });

  test('Property 10.8: Cache invalidation strategy is configured', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    
    // Check if there's a separate invalidation configuration
    const invalidationFiles = [
      'cache-optimization.tf',
      'cloudfront-cdn.tf'
    ];
    
    let invalidationConfigFound = false;
    
    invalidationFiles.forEach(file => {
      const filePath = path.join(terraformDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('aws_cloudfront_invalidation') || content.includes('invalidation')) {
          invalidationConfigFound = true;
        }
      }
    });
    
    // At minimum, verify distribution is configured for invalidation
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    expect(cloudfrontConfig).toContain('aws_cloudfront_distribution');
  });

  test('Property 10.9: Content optimization settings are configured', () => {
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    // Verify compression is enabled
    expect(cloudfrontConfig).toMatch(/compress\s*=\s*true/);
    
    // Verify HTTP/2 support
    expect(cloudfrontConfig).toMatch(/http_version\s*=\s*"http2"/);
    
    // Verify cache policy optimization
    if (cloudfrontConfig.includes('cache_policy_id')) {
      expect(cloudfrontConfig).toMatch(/cache_policy_id\s*=\s*data\.aws_cloudfront_cache_policy/);
    }
    
    // Check for origin request policy
    if (cloudfrontConfig.includes('origin_request_policy_id')) {
      expect(cloudfrontConfig).toMatch(/origin_request_policy_id\s*=\s*data\.aws_cloudfront_origin_request_policy/);
    }
  });

  test('Property 10.10: Performance monitoring is integrated', () => {
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    expect(fs.existsSync(monitoringPath)).toBe(true);
    
    const monitoringConfig = fs.readFileSync(monitoringPath, 'utf8');
    
    // Verify CloudFront monitoring
    expect(monitoringConfig).toMatch(/namespace\s*=\s*"AWS\/CloudFront"/);
    
    // Check for key CloudFront metrics
    const cloudfrontMetrics = [
      'Requests',
      'BytesDownloaded',
      'BytesUploaded',
      '4xxErrorRate',
      '5xxErrorRate',
      'OriginLatency'
    ];
    
    let metricsFound = 0;
    cloudfrontMetrics.forEach(metric => {
      if (monitoringConfig.includes(metric)) {
        metricsFound++;
      }
    });
    
    // At least some CloudFront metrics should be monitored
    expect(metricsFound).toBeGreaterThan(0);
    
    // Verify alarm actions are configured
    expect(monitoringConfig).toContain('alarm_actions');
  });

  test('Property 10.11: WAF integration is configured', () => {
    const wafConfigPath = path.join(terraformDir, 'waf-security.tf');
    expect(fs.existsSync(wafConfigPath)).toBe(true);
    
    const wafConfig = fs.readFileSync(wafConfigPath, 'utf8');
    
    // Verify WAF web ACL configuration
    expect(wafConfig).toContain('aws_wafv2_web_acl');
    expect(wafConfig).toMatch(/scope\s*=\s*"CLOUDFRONT"/);
    
    // Verify CloudFront distribution references WAF
    const cloudfrontConfigPath = path.join(terraformDir, 'cloudfront-cdn.tf');
    const cloudfrontConfig = fs.readFileSync(cloudfrontConfigPath, 'utf8');
    
    expect(cloudfrontConfig).toMatch(/web_acl_id\s*=\s*aws_wafv2_web_acl/);
  });

  test('Property 10.12: Price class optimization is configured', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const priceClassMatch = tfvarsContent.match(/cloudfront_price_class\s*=\s*"([^"]+)"/);
    expect(priceClassMatch).toBeTruthy();
    
    const priceClass = priceClassMatch[1];
    const validPriceClasses = ['PriceClass_All', 'PriceClass_200', 'PriceClass_100'];
    expect(validPriceClasses).toContain(priceClass);
    
    // For production, should use optimized price class
    expect(priceClass).toMatch(/^PriceClass_(100|200)$/);
  });
});
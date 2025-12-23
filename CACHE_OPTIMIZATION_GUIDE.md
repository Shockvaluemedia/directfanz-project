# Cache Optimization Guide for DirectFanz Platform

## Overview

This guide outlines the comprehensive caching optimization strategies implemented for the DirectFanz platform to improve performance, reduce costs, and enhance user experience.

## Caching Architecture

### Multi-Layer Caching Strategy

```
User Request → CloudFront CDN → Application Load Balancer → ECS Application → ElastiCache Redis → RDS Database
```

#### Layer 1: CloudFront CDN
- **Global edge caching** for static assets and API responses
- **Intelligent cache policies** based on content type
- **Cache warming** for popular content
- **Geographic distribution** for low latency

#### Layer 2: Application Cache (ElastiCache Redis)
- **Session storage** and user data caching
- **API response caching** with intelligent TTL
- **Database query result caching**
- **Real-time data caching** for live features

#### Layer 3: Database Query Optimization
- **Connection pooling** with PgBouncer
- **Query result caching** at application level
- **Read replica utilization** for analytics queries

## Cache Optimization Features

### 1. Intelligent Cache Policies

#### Static Assets Policy
```hcl
# Optimized for long-term caching
default_ttl = 31536000  # 1 year
max_ttl     = 63072000  # 2 years
min_ttl     = 0

# Compression enabled
enable_accept_encoding_brotli = true
enable_accept_encoding_gzip   = true

# No query strings or cookies
query_string_behavior = "none"
cookie_behavior = "none"
```

#### Images Policy
```hcl
# Optimized for image processing
default_ttl = 604800    # 1 week
max_ttl     = 1209600   # 2 weeks

# Support for image optimization parameters
query_strings = ["w", "h", "q", "format"]

# WebP support via Accept header
headers = ["Accept", "CloudFront-Viewer-Country"]
```

#### API Response Policy
```hcl
# Balanced caching for dynamic content
default_ttl = 300       # 5 minutes
max_ttl     = 3600      # 1 hour

# Forward authentication and content headers
headers = ["Authorization", "Accept", "Content-Type"]
cookies = ["session-token", "user-id"]
```

### 2. Automated Cache Warming

#### Proactive Cache Warming
- **Scheduled warming** every 6 hours
- **Popular content identification** via analytics
- **Geographic warming** across edge locations
- **Variation warming** for mobile/desktop content

#### Cache Warming URLs
```javascript
const warmingUrls = [
  '/',                    // Homepage
  '/api/health',          // Health check
  '/api/user/profile',    // User profiles
  '/static/css/main.css', // Critical CSS
  '/static/js/main.js',   // Critical JavaScript
  '/trending',            // Popular content
  '/featured-content'     // Featured content
];
```

### 3. Cache Performance Monitoring

#### Key Metrics Tracked
- **Cache Hit Rate**: Target >85%
- **Origin Latency**: Target <500ms
- **Error Rate**: Target <2%
- **Request Volume**: Peak and average
- **Bandwidth Usage**: Cost optimization

#### Automated Alerts
- **Low cache hit rate** (<85%)
- **High origin latency** (>500ms)
- **High error rate** (>2%)
- **Performance degradation trends**

### 4. Application-Level Caching

#### Redis Optimization
```typescript
// Intelligent TTL calculation
const calculateTTL = (key: string) => {
  if (key.includes('user:')) return 300;      // 5 minutes
  if (key.includes('static:')) return 86400;  // 24 hours
  if (key.includes('api:')) return 600;       // 10 minutes
  return 1800; // Default 30 minutes
};

// Cache with background refresh
const getOrSet = async (key, fetcher, ttl) => {
  const cached = await redis.get(key);
  if (cached) {
    // Refresh in background if TTL < 20%
    if (await shouldRefreshInBackground(key, ttl)) {
      refreshInBackground(key, fetcher, ttl);
    }
    return JSON.parse(cached);
  }
  
  const value = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(value));
  return value;
};
```

#### Cache Invalidation Strategies
```typescript
// Tag-based invalidation
await cache.set('user:123:profile', userData, {
  ttl: 300,
  tags: ['user:123', 'profiles']
});

// Invalidate all user data
await cache.invalidateByTags(['user:123']);

// Invalidate all profiles
await cache.invalidateByTags(['profiles']);
```

## Performance Optimizations

### 1. Content Optimization

#### Image Optimization
- **WebP format** support via Accept header
- **Responsive images** with width/height parameters
- **Quality optimization** based on device capabilities
- **Lazy loading** for non-critical images

#### Asset Optimization
- **Brotli compression** for text-based assets
- **Gzip fallback** for older browsers
- **Minification** of CSS and JavaScript
- **Bundle splitting** for optimal caching

### 2. Cache Hit Rate Optimization

#### Strategies for Improvement
1. **Normalize query parameters** to increase cache hits
2. **Remove unnecessary headers** from cache key
3. **Implement cache warming** for popular content
4. **Use consistent URL patterns** across the application

#### Cache Key Optimization
```javascript
// Bad: Different cache keys for same content
/api/users?sort=name&order=asc
/api/users?order=asc&sort=name

// Good: Normalized cache keys
/api/users?order=asc&sort=name
```

### 3. Cost Optimization

#### CloudFront Cost Reduction
- **Price Class 100** for cost-effective global distribution
- **Origin Shield** to reduce origin requests
- **Intelligent compression** to reduce bandwidth
- **Cache warming** to improve hit rates

#### ElastiCache Cost Optimization
- **Memory optimization** with LRU eviction policy
- **Connection pooling** to reduce overhead
- **Cluster mode** for horizontal scaling
- **Reserved instances** for predictable workloads

## Implementation Guide

### 1. Infrastructure Deployment

```bash
# Deploy cache optimization infrastructure
terraform apply -target=aws_cloudfront_cache_policy.optimized_static_assets
terraform apply -target=aws_cloudfront_cache_policy.optimized_images
terraform apply -target=aws_cloudfront_cache_policy.optimized_api
terraform apply -target=aws_lambda_function.cache_warmer
terraform apply -target=aws_lambda_function.cache_analytics
```

### 2. Application Integration

```typescript
import CacheOptimizationService from './cache-optimization-service';

const cache = new CacheOptimizationService({
  redisUrl: process.env.REDIS_URL,
  cloudfrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
  defaultTTL: 1800,
  maxTTL: 86400
});

// Use in API routes
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  
  const user = await cache.getOrSet(
    `user:${userId}:profile`,
    () => getUserFromDatabase(userId),
    { ttl: 300, tags: [`user:${userId}`, 'profiles'] }
  );
  
  res.json(user);
});
```

### 3. Monitoring Setup

```typescript
// Get cache performance metrics
const metrics = await cache.getMetrics();
console.log('Cache Performance:', {
  hitRate: `${metrics.hitRate.toFixed(1)}%`,
  totalRequests: metrics.totalRequests,
  averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`
});

// Optimize cache based on usage patterns
await cache.optimizeCache();
```

## Best Practices

### 1. Cache Strategy Selection

#### Static Content
- **Long TTL** (1 year) with versioning
- **Aggressive caching** at all levels
- **Immutable content** with cache-busting

#### Dynamic Content
- **Short TTL** (5-30 minutes) based on update frequency
- **Conditional caching** based on user context
- **Background refresh** to maintain performance

#### User-Specific Content
- **Private caching** only
- **Session-based TTL**
- **Immediate invalidation** on updates

### 2. Cache Invalidation

#### Proactive Invalidation
- **Tag-based invalidation** for related content
- **Event-driven invalidation** on data updates
- **Scheduled invalidation** for time-sensitive content

#### Reactive Invalidation
- **TTL-based expiration** for automatic cleanup
- **LRU eviction** for memory management
- **Manual invalidation** for emergency updates

### 3. Performance Monitoring

#### Key Performance Indicators
- **Cache Hit Rate**: >85% target
- **Response Time**: <200ms for cached content
- **Error Rate**: <1% for cache operations
- **Memory Usage**: <80% of available cache memory

#### Alerting Thresholds
- **Critical**: Cache hit rate <70%
- **Warning**: Cache hit rate <85%
- **Info**: Cache performance trends

## Troubleshooting

### Common Issues

#### Low Cache Hit Rate
1. **Check cache policies** for proper configuration
2. **Review query parameters** and headers
3. **Analyze cache key patterns** for consistency
4. **Implement cache warming** for popular content

#### High Origin Latency
1. **Optimize application performance**
2. **Implement database query caching**
3. **Use connection pooling** for database connections
4. **Consider origin shield** for CloudFront

#### Cache Memory Issues
1. **Review TTL settings** for appropriate expiration
2. **Implement LRU eviction** policy
3. **Monitor memory usage** patterns
4. **Scale cache cluster** if needed

### Debugging Tools

#### Cache Analysis
```bash
# Redis cache analysis
redis-cli info memory
redis-cli info stats

# CloudFront cache analysis
aws cloudfront get-distribution --id DISTRIBUTION_ID
aws logs filter-log-events --log-group-name /aws/cloudfront/DISTRIBUTION_ID
```

#### Performance Testing
```bash
# Cache warming test
curl -H "Cache-Control: no-cache" https://yourdomain.com/api/test

# Cache hit test
curl -H "Cache-Control: max-age=0" https://yourdomain.com/api/test
```

## Expected Results

### Performance Improvements
- **95%+ cache hit rate** for static assets
- **85%+ cache hit rate** for API responses
- **50-80% reduction** in origin requests
- **30-50% improvement** in response times

### Cost Savings
- **40-60% reduction** in origin server load
- **20-30% reduction** in bandwidth costs
- **15-25% reduction** in database query load
- **Overall 25-40% cost optimization**

### User Experience
- **Faster page load times** globally
- **Improved mobile performance**
- **Reduced latency** for international users
- **Better reliability** during traffic spikes
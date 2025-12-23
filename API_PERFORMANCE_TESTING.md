# API Performance Testing Guide

## Overview

This document describes the API performance testing implementation for the DirectFanz AWS migration project. The testing ensures compliance with **Requirement 12.1**: "THE Platform SHALL maintain sub-200ms response times for API endpoints."

## Testing Strategy

### Performance Requirements

- **Primary Requirement**: Sub-200ms average response time for all API endpoints
- **Success Criteria**: 95% of requests must meet the response time threshold
- **Critical Endpoints**: Must pass performance requirements for production readiness
- **Load Testing**: Concurrent user simulation to test scalability

### Test Coverage

The API performance test covers the following endpoint categories:

#### Critical Endpoints (Must Pass)
- `GET /api/health` - Health check endpoint
- `GET /api/user/profile` - User profile data
- `GET /api/content/feed` - Content feed (main user experience)
- `GET /api/subscriptions` - User subscriptions
- `GET /api/streams/live` - Live streaming data
- `GET /api/messages/recent` - Recent messages

#### Non-Critical Endpoints (Performance Monitoring)
- `GET /api/content/search` - Content search functionality
- `GET /api/subscriptions/tiers` - Subscription tier information
- `GET /api/campaigns/active` - Active campaigns
- `GET /api/streams/{id}` - Individual stream details
- `GET /api/analytics/dashboard` - Analytics data

## Usage

### Quick Test (Development)
```bash
npm run perf:api:quick
```
- 25 iterations per endpoint
- 5 concurrent users for load testing
- Suitable for development validation

### Full Test (Production Validation)
```bash
npm run perf:api:full
```
- 100 iterations per endpoint
- 20 concurrent users for load testing
- Comprehensive production readiness validation

### Custom Configuration
```bash
# Environment variables for customization
API_BASE_URL=https://api.directfanz.io \
PERF_ITERATIONS=50 \
PERF_CONCURRENT_USERS=10 \
PERF_RESPONSE_THRESHOLD=200 \
npm run perf:api
```

## Test Process

### 1. Sequential Testing
- Each endpoint is tested individually
- Warmup requests to establish baseline
- Statistical analysis of response times
- Threshold compliance validation

### 2. Concurrent Load Testing
- Critical endpoints tested under concurrent load
- Simulates real-world usage patterns
- Measures throughput and response time under load
- Validates auto-scaling behavior

### 3. Results Analysis
- **PASS**: Average response time ≤ 200ms AND 95% threshold compliance
- **FAIL**: Average response time > 200ms OR < 95% threshold compliance
- **ERROR**: Endpoint unavailable or returning errors

## Metrics Collected

### Response Time Statistics
- Average response time
- Minimum/Maximum response times
- Median response time
- 95th percentile response time
- 99th percentile response time

### Reliability Metrics
- Success rate (HTTP 2xx responses)
- Error rate and error types
- Threshold compliance percentage
- Request throughput (requests/second)

### Load Testing Metrics
- Concurrent user performance
- System throughput under load
- Response time degradation under load
- Error rates during peak load

## Integration with AWS Infrastructure

### CloudWatch Integration
The performance test results can be integrated with AWS CloudWatch for monitoring:

```javascript
// Example CloudWatch custom metrics
const cloudwatch = new AWS.CloudWatch();

await cloudwatch.putMetricData({
  Namespace: 'DirectFanz/API/Performance',
  MetricData: [{
    MetricName: 'ResponseTime',
    Value: averageResponseTime,
    Unit: 'Milliseconds',
    Dimensions: [{
      Name: 'Endpoint',
      Value: endpointName
    }]
  }]
}).promise();
```

### Auto-Scaling Validation
The concurrent load testing validates that:
- ECS Fargate auto-scaling responds within 2 minutes
- Application Load Balancer distributes traffic effectively
- Database connection pooling handles concurrent requests
- ElastiCache provides sub-millisecond cache responses

## Continuous Integration

### GitHub Actions Integration
```yaml
name: API Performance Test
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run perf:api:quick
        env:
          API_BASE_URL: ${{ secrets.STAGING_API_URL }}
```

### Performance Regression Detection
- Baseline performance metrics stored in `performance-results/`
- Automated comparison with previous test runs
- Alerts for performance degradation > 10%
- Integration with deployment pipeline

## Troubleshooting

### Common Issues

#### High Response Times
1. **Database Performance**: Check query execution times
2. **Cache Miss Rate**: Verify ElastiCache hit rates
3. **Network Latency**: Test from different regions
4. **Resource Constraints**: Monitor CPU/Memory usage

#### Load Test Failures
1. **Connection Limits**: Increase database connection pool
2. **Rate Limiting**: Adjust WAF and API Gateway limits
3. **Auto-scaling Delays**: Verify CloudWatch alarms
4. **Resource Exhaustion**: Monitor ECS task resources

### Performance Optimization

#### Database Optimization
- Implement query result caching
- Optimize database indexes
- Use read replicas for read-heavy operations
- Connection pooling with PgBouncer

#### Application Optimization
- Implement response caching
- Optimize API payload sizes
- Use CDN for static content
- Implement request batching

#### Infrastructure Optimization
- Configure auto-scaling policies
- Optimize ECS task resource allocation
- Use Application Load Balancer health checks
- Implement circuit breakers

## Results Interpretation

### Success Criteria
- ✅ **PASS**: All critical endpoints meet <200ms requirement
- ✅ **PASS**: 95%+ threshold compliance across all endpoints
- ✅ **PASS**: Concurrent load testing maintains performance
- ✅ **PASS**: Error rate < 1% under normal load

### Failure Analysis
- ⚠️ **FAIL**: Identify specific endpoints exceeding thresholds
- ⚠️ **FAIL**: Analyze response time distribution
- ⚠️ **FAIL**: Check for infrastructure bottlenecks
- ⚠️ **FAIL**: Review auto-scaling configuration

## Reporting

### Test Results Format
Results are saved in JSON format with:
- Test configuration and timestamp
- Per-endpoint performance metrics
- Statistical analysis and compliance rates
- Pass/fail status for each endpoint
- Overall requirement compliance status

### Performance Dashboard
Integration with monitoring dashboards:
- Real-time API response time monitoring
- Historical performance trends
- Alert thresholds and notifications
- Capacity planning metrics

## Next Steps

After successful API performance testing:

1. **Deploy to Production**: Validated performance meets requirements
2. **Enable Monitoring**: Set up CloudWatch alarms and dashboards
3. **Continuous Testing**: Integrate into CI/CD pipeline
4. **Performance Budgets**: Establish ongoing performance targets
5. **Optimization**: Implement identified performance improvements

## Related Documentation

- [AWS Infrastructure Setup](infrastructure/terraform/README.md)
- [Database Performance Optimization](scripts/performance-test-suite.js)
- [Load Testing Guide](scripts/load-test.js)
- [Monitoring and Alerting](COST_MONITORING_SETUP.md)
#!/bin/bash

# Production Deployment Monitoring Script
# This script sets up monitoring, logging, and alerting for production deployment

set -e

echo "🚀 Setting up production monitoring..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check required environment variables
check_env_vars() {
    echo "Checking required environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_SENTRY_DSN"
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "STRIPE_SECRET_KEY"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_status "All required environment variables are set"
}

# Install monitoring dependencies
install_dependencies() {
    echo "Installing monitoring dependencies..."
    
    # Check if package.json needs monitoring dependencies
    if ! grep -q "@sentry/nextjs" package.json; then
        print_warning "Sentry not found in package.json, installing..."
        npm install @sentry/nextjs
    fi
    
    if ! grep -q "@sentry/cli" package.json; then
        print_warning "Sentry CLI not found in package.json, installing..."
        npm install --save-dev @sentry/cli
    fi
    
    print_status "Monitoring dependencies installed"
}

# Create Sentry release
create_sentry_release() {
    if [[ -n "$NEXT_PUBLIC_SENTRY_DSN" ]]; then
        echo "Creating Sentry release..."
        
        # Get version from package.json or use git commit
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD)}")
        
        # Create release
        if command -v sentry-cli &> /dev/null; then
            sentry-cli releases new "$VERSION" || print_warning "Failed to create Sentry release"
            sentry-cli releases set-commits "$VERSION" --auto || print_warning "Failed to set commits for Sentry release"
            print_status "Sentry release created: $VERSION"
        else
            print_warning "Sentry CLI not available, skipping release creation"
        fi
    else
        print_warning "Sentry DSN not configured, skipping release creation"
    fi
}

# Setup health checks
setup_health_checks() {
    echo "Setting up health check monitoring..."
    
    # Create health check configuration
    cat > healthcheck.json << EOF
{
  "name": "Direct Fan Platform",
  "version": "$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")",
  "checks": [
    {
      "name": "api",
      "url": "\${BASE_URL}/api/health",
      "method": "GET",
      "timeout": 10000,
      "expectedStatus": 200,
      "interval": 60000
    },
    {
      "name": "database",
      "description": "Database connectivity check"
    },
    {
      "name": "redis",
      "description": "Redis connectivity check"
    },
    {
      "name": "storage",
      "description": "File storage availability"
    },
    {
      "name": "payments",
      "description": "Payment service connectivity"
    }
  ],
  "alerts": {
    "slack": {
      "webhook": "\${SLACK_WEBHOOK_URL}",
      "channel": "#alerts",
      "username": "Direct Fan Monitor"
    },
    "email": {
      "enabled": false,
      "recipients": []
    }
  }
}
EOF
    
    print_status "Health check configuration created"
}

# Setup log rotation and management
setup_logging() {
    echo "Setting up logging configuration..."
    
    # Create logging configuration
    mkdir -p logs
    
    cat > logs/logrotate.conf << EOF
logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    create 644 nextjs nextjs
    postrotate
        # Restart the application or send signal if needed
        # systemctl reload nextjs
    endscript
}
EOF
    
    # Create log directory structure
    mkdir -p logs/{access,error,performance,security}
    
    print_status "Logging configuration set up"
}

# Generate monitoring documentation
generate_docs() {
    echo "Generating monitoring documentation..."
    
    cat > MONITORING.md << EOF
# Direct Fan Platform - Production Monitoring

## Overview
This document describes the monitoring, logging, and alerting setup for the Direct Fan Platform.

## Health Checks
- **Endpoint**: \`/api/health\`
- **Interval**: Every 60 seconds
- **Services Monitored**:
  - Database connectivity
  - Redis connectivity  
  - Storage availability
  - Payment service (Stripe)
  - Authentication service

## Error Tracking
- **Service**: Sentry
- **Environment**: \`${NODE_ENV:-production}\`
- **Dashboard**: [Sentry Dashboard](https://sentry.io/)

## Logging
- **Format**: Structured JSON logging
- **Levels**: ERROR, WARN, INFO, DEBUG
- **Retention**: 30 days
- **Location**: \`/logs/\` directory

## Alerts
### Critical Alerts (Immediate Response)
- System health failures
- Database connectivity issues
- Payment processing failures
- High error rates (>5%)

### Warning Alerts (Monitor)
- Slow response times (>2s)
- Storage issues
- Authentication problems

## Performance Monitoring
- **Response Times**: Tracked per endpoint
- **Database Queries**: Slow query detection (>1s)
- **Memory Usage**: Node.js heap monitoring
- **CPU Usage**: Process CPU monitoring

## Dashboards
1. **System Health**: Overall platform status
2. **Performance**: Response times and throughput
3. **Errors**: Error rates and types
4. **Business Metrics**: Subscriptions, payments, content

## Runbook
### High Error Rate
1. Check Sentry for error details
2. Review application logs
3. Check database and Redis connectivity
4. Scale resources if needed

### Slow Performance  
1. Check database query performance
2. Review memory and CPU usage
3. Check external service latencies
4. Consider caching improvements

### Database Issues
1. Check database connectivity
2. Review connection pool status
3. Monitor query performance
4. Check disk space and resources

## Emergency Contacts
- **Development Team**: [Team contact info]
- **Infrastructure**: [Infrastructure contact info]
- **On-call**: [On-call rotation info]
EOF
    
    print_status "Monitoring documentation generated"
}

# Validate monitoring setup
validate_setup() {
    echo "Validating monitoring setup..."
    
    # Check if health endpoint is accessible
    if curl -f -s "${BASE_URL:-http://localhost:3000}/api/health" > /dev/null 2>&1; then
        print_status "Health endpoint is accessible"
    else
        print_warning "Health endpoint is not accessible (this is normal if the app isn't running)"
    fi
    
    # Check configuration files
    if [[ -f "sentry.client.config.ts" && -f "sentry.server.config.ts" ]]; then
        print_status "Sentry configuration files present"
    else
        print_error "Missing Sentry configuration files"
        exit 1
    fi
    
    print_status "Monitoring setup validation complete"
}

# Main execution
main() {
    echo "🔍 Direct Fan Platform - Production Monitoring Setup"
    echo "=================================================="
    
    check_env_vars
    install_dependencies
    create_sentry_release
    setup_health_checks
    setup_logging
    generate_docs
    validate_setup
    
    echo ""
    echo "🎉 Production monitoring setup complete!"
    echo ""
    print_status "Next steps:"
    echo "  1. Configure external monitoring services (UptimeRobot, Pingdom, etc.)"
    echo "  2. Set up alert notification channels (Slack, PagerDuty, email)"
    echo "  3. Review MONITORING.md for operational procedures"
    echo "  4. Test alert mechanisms"
    echo "  5. Set up log aggregation service (if needed)"
    echo ""
}

# Run main function
main "$@"
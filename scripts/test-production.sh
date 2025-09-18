#!/bin/bash

# ==============================================
# PRODUCTION DEPLOYMENT TESTING SCRIPT
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
if [ -z "$1" ]; then
    read -p "Enter your production domain (e.g., https://yourdomain.com): " DOMAIN
else
    DOMAIN=$1
fi

# Remove trailing slash
DOMAIN=${DOMAIN%/}

log_info "🧪 Testing Direct Fan Platform Production Deployment"
echo "Domain: $DOMAIN"
echo "=================================================="

# Test 1: Basic connectivity
test_basic_connectivity() {
    log_info "Testing basic connectivity..."
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Homepage accessible (HTTP 200)"
    else
        log_error "Homepage not accessible (HTTP $HTTP_STATUS)"
        return 1
    fi
}

# Test 2: SSL Certificate
test_ssl_certificate() {
    log_info "Testing SSL certificate..."
    
    if curl -s --fail "$DOMAIN" > /dev/null 2>&1; then
        log_success "SSL certificate valid"
    else
        log_error "SSL certificate issue"
        return 1
    fi
}

# Test 3: Security Headers
test_security_headers() {
    log_info "Testing security headers..."
    
    HEADERS=$(curl -s -I "$DOMAIN")
    
    # Check for security headers
    if echo "$HEADERS" | grep -qi "x-content-type-options"; then
        log_success "X-Content-Type-Options header present"
    else
        log_warning "X-Content-Type-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "x-frame-options"; then
        log_success "X-Frame-Options header present"
    else
        log_warning "X-Frame-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "x-xss-protection"; then
        log_success "X-XSS-Protection header present"
    else
        log_warning "X-XSS-Protection header missing"
    fi
}

# Test 4: API Endpoints
test_api_endpoints() {
    log_info "Testing API endpoints..."
    
    # Test health endpoint
    API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/health" || echo "000")
    if [ "$API_HEALTH" = "200" ]; then
        log_success "Health API endpoint working"
    else
        log_warning "Health API endpoint not responding correctly ($API_HEALTH)"
    fi
    
    # Test auth session endpoint (should return 401 for unauthenticated)
    AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/auth/session" || echo "000")
    if [ "$AUTH_STATUS" = "200" ] || [ "$AUTH_STATUS" = "401" ]; then
        log_success "Auth API endpoint responding"
    else
        log_error "Auth API endpoint not working ($AUTH_STATUS)"
    fi
    
    # Test CSRF endpoint
    CSRF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/csrf-token" || echo "000")
    if [ "$CSRF_STATUS" = "200" ]; then
        log_success "CSRF API endpoint working"
    else
        log_warning "CSRF API endpoint not responding correctly ($CSRF_STATUS)"
    fi
}

# Test 5: Database Connection (indirect)
test_database_connection() {
    log_info "Testing database connection (indirect)..."
    
    # Test an endpoint that requires database access
    DB_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/artists" || echo "000")
    if [ "$DB_TEST" = "200" ] || [ "$DB_TEST" = "401" ]; then
        log_success "Database connection appears healthy"
    else
        log_error "Database connection issues detected ($DB_TEST)"
    fi
}

# Test 6: Stripe Integration
test_stripe_integration() {
    log_info "Testing Stripe integration..."
    
    # Test webhook endpoint
    STRIPE_WEBHOOK=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/webhooks/stripe" -X POST || echo "000")
    if [ "$STRIPE_WEBHOOK" = "400" ] || [ "$STRIPE_WEBHOOK" = "401" ]; then
        log_success "Stripe webhook endpoint responding (expects proper signature)"
    else
        log_warning "Stripe webhook endpoint response unexpected ($STRIPE_WEBHOOK)"
    fi
}

# Test 7: Static Assets
test_static_assets() {
    log_info "Testing static assets..."
    
    # Check if favicon loads
    FAVICON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/favicon.ico" || echo "000")
    if [ "$FAVICON_STATUS" = "200" ]; then
        log_success "Static assets loading correctly"
    else
        log_warning "Static assets might have issues ($FAVICON_STATUS)"
    fi
}

# Test 8: Performance Check
test_performance() {
    log_info "Testing performance..."
    
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$DOMAIN")
    RESPONSE_TIME_INT=$(echo "$RESPONSE_TIME * 1000 / 1" | bc 2>/dev/null || echo "0")
    
    if [ "$RESPONSE_TIME_INT" -lt 3000 ]; then
        log_success "Response time good (${RESPONSE_TIME}s)"
    elif [ "$RESPONSE_TIME_INT" -lt 5000 ]; then
        log_warning "Response time acceptable (${RESPONSE_TIME}s)"
    else
        log_warning "Response time slow (${RESPONSE_TIME}s)"
    fi
}

# Test 9: Page Content Check
test_page_content() {
    log_info "Testing page content..."
    
    PAGE_CONTENT=$(curl -s "$DOMAIN")
    
    if echo "$PAGE_CONTENT" | grep -qi "Direct Fan Platform\|Welcome\|Sign"; then
        log_success "Page content loading correctly"
    else
        log_warning "Page content might not be loading properly"
    fi
    
    # Check for JavaScript errors (basic check)
    if echo "$PAGE_CONTENT" | grep -qi "error\|exception" && ! echo "$PAGE_CONTENT" | grep -qi "try\|catch"; then
        log_warning "Possible JavaScript errors detected"
    else
        log_success "No obvious JavaScript errors"
    fi
}

# Run all tests
run_all_tests() {
    echo ""
    log_info "Running all production tests..."
    echo "================================"
    
    FAILED_TESTS=0
    
    # Run tests and track failures
    test_basic_connectivity || ((FAILED_TESTS++))
    echo ""
    
    test_ssl_certificate || ((FAILED_TESTS++))
    echo ""
    
    test_security_headers
    echo ""
    
    test_api_endpoints
    echo ""
    
    test_database_connection || ((FAILED_TESTS++))
    echo ""
    
    test_stripe_integration
    echo ""
    
    test_static_assets
    echo ""
    
    test_performance
    echo ""
    
    test_page_content
    echo ""
    
    # Final report
    echo "================================"
    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "🎉 All critical tests passed! Production deployment looks healthy."
    else
        log_warning "⚠️  $FAILED_TESTS critical test(s) failed. Please review and fix issues."
    fi
    
    echo ""
    log_info "Additional manual testing recommended:"
    echo "• User registration and login flow"
    echo "• Payment processing with test cards"
    echo "• File upload functionality"  
    echo "• Email delivery (welcome, password reset)"
    echo "• Real-time features (messaging, notifications)"
    echo "• Admin dashboard functionality"
    
    echo ""
    log_info "Monitoring setup:"
    echo "• Configure uptime monitoring (UptimeRobot, Pingdom)"
    echo "• Set up error tracking alerts (Sentry)"
    echo "• Monitor performance metrics (Vercel Analytics)"
    echo "• Database monitoring and backups"
}

# Help function
show_help() {
    echo "Usage: $0 [DOMAIN]"
    echo ""
    echo "Test your production deployment of Direct Fan Platform"
    echo ""
    echo "Examples:"
    echo "  $0 https://yourdomain.com"
    echo "  $0 https://your-app.vercel.app"
    echo ""
    echo "If no domain is provided, you'll be prompted to enter one."
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Main execution
if [ -z "$DOMAIN" ]; then
    log_error "Domain is required"
    show_help
    exit 1
fi

run_all_tests
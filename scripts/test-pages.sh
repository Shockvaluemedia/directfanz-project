#!/bin/bash

# DirectFanz Page Testing Script
# Tests all major pages and reports their status

BASE_URL="http://localhost:3000"
RESULTS_FILE="test-results/page-test-$(date +%Y%m%d-%H%M%S).txt"

# Create results directory
mkdir -p test-results

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Initialize counters
TOTAL_TESTS=0
SUCCESSFUL_TESTS=0
FAILED_TESTS=0

echo -e "${BOLD}${BLUE}🚀 DirectFanz Page Testing Started${NC}\n"
echo -e "Testing against: ${BASE_URL}\n"
echo "Testing DirectFanz Pages - $(date)" > "$RESULTS_FILE"
echo "=================================" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Function to test a route
test_route() {
    local category="$1"
    local route="$2"
    local url="${BASE_URL}${route}"
    
    ((TOTAL_TESTS++))
    
    # Make the request and capture response code and time
    local result
    result=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}" "$url" -o /dev/null --max-time 10)
    local curl_exit=$?
    
    if [ $curl_exit -eq 0 ]; then
        IFS='|' read -r http_code time_total size_download <<< "$result"
        
        # Determine status
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            ((SUCCESSFUL_TESTS++))
            local status="${GREEN}✅ $http_code${NC}"
            local status_text="OK"
        elif [ "$http_code" -ge 300 ] && [ "$http_code" -lt 400 ]; then
            ((SUCCESSFUL_TESTS++))  # Redirects are often expected
            local status="${YELLOW}➡️  $http_code${NC}"
            local status_text="REDIRECT"
        else
            ((FAILED_TESTS++))
            local status="${RED}❌ $http_code${NC}"
            local status_text="ERROR"
        fi
        
        # Color code response time
        local time_ms
        time_ms=$(echo "$time_total * 1000 / 1" | bc)
        local time_color
        if [ "$time_ms" -lt 1000 ]; then
            time_color="$GREEN"
        elif [ "$time_ms" -lt 3000 ]; then
            time_color="$YELLOW"
        else
            time_color="$RED"
        fi
        
        printf "%-30s %s ${time_color}%4sms${NC} %s\n" "$route" "$status" "$time_ms" "$status_text"
        echo "$route | $http_code | ${time_ms}ms | $status_text" >> "$RESULTS_FILE"
        
    else
        ((FAILED_TESTS++))
        local status="${RED}❌ FAIL${NC}"
        printf "%-30s %s %s\n" "$route" "$status" "Connection failed"
        echo "$route | FAIL | - | Connection failed" >> "$RESULTS_FILE"
    fi
}

# Define test routes for each category
test_category() {
    local category="$1"
    shift
    local routes=("$@")
    
    echo -e "\n${BOLD}${CYAN}📁 $category${NC}"
    echo "────────────────────────────────────────────────────────────"
    echo "" >> "$RESULTS_FILE"
    echo "$category:" >> "$RESULTS_FILE"
    echo "────────────────────────" >> "$RESULTS_FILE"
    
    for route in "${routes[@]}"; do
        test_route "$category" "$route"
    done
}

# Test all categories
test_category "Core Pages" "/" "/page-simple"

test_category "Authentication" "/auth/signin" "/auth/signup" "/auth-debug" "/test-auth" "/test-auth-simple" "/test-signin" "/simple-signin"

test_category "Dashboard & Profile" "/dashboard" "/profile"

test_category "Creator Studio" "/studio" "/upload" "/upload-simple" "/analytics" "/content"

test_category "Fan Experience" "/discover" "/stream" "/streams" "/player" "/search" "/playlists"

test_category "Communication" "/messages" "/chat"

test_category "Admin & Settings" "/admin" "/settings"

test_category "Feature Pages" "/features" "/features-demo" "/campaigns" "/artist"

test_category "Demo & Test Pages" "/home-demo" "/simple-demo" "/ui-showcase" "/css-test" "/minimal-test" "/test" "/test-simple" "/test-minimal" "/test-js"

test_category "S3 & Upload Tests" "/s3-upload-test"

# Print summary
echo ""
echo -e "${BOLD}${BLUE}📊 Testing Summary${NC}"
echo "============================================================"
SUCCESS_RATE=$(echo "scale=1; $SUCCESSFUL_TESTS * 100 / $TOTAL_TESTS" | bc)
echo -e "Total routes tested: ${BOLD}$TOTAL_TESTS${NC}"
echo -e "${GREEN}✅ Successful: $SUCCESSFUL_TESTS${NC}"
echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"

if (( $(echo "$SUCCESS_RATE >= 90" | bc -l) )); then
    RATE_COLOR="$GREEN"
elif (( $(echo "$SUCCESS_RATE >= 70" | bc -l) )); then
    RATE_COLOR="$YELLOW"  
else
    RATE_COLOR="$RED"
fi

echo -e "${BOLD}Success Rate: ${RATE_COLOR}${SUCCESS_RATE}%${NC}"

# Save summary to file
echo "" >> "$RESULTS_FILE"
echo "SUMMARY:" >> "$RESULTS_FILE"
echo "Total: $TOTAL_TESTS | Successful: $SUCCESSFUL_TESTS | Failed: $FAILED_TESTS | Success Rate: ${SUCCESS_RATE}%" >> "$RESULTS_FILE"

echo -e "\n${CYAN}📄 Results saved to: $RESULTS_FILE${NC}"

# Return exit code based on success rate
if (( $(echo "$SUCCESS_RATE >= 80" | bc -l) )); then
    exit 0
else
    exit 1
fi
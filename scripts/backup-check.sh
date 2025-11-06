#!/bin/bash

# Backup and Deployment Verification Script
# This script ensures your code is backed up to GitHub and properly deployed on Vercel

set -e  # Exit on any error

echo "🔍 Starting backup and deployment verification..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ ${message}${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  ${message}${NC}" ;;
        "error") echo -e "${RED}❌ ${message}${NC}" ;;
        "info") echo -e "${BLUE}ℹ️  ${message}${NC}" ;;
    esac
}

# 1. Check Git Status
echo -e "\n${BLUE}1. Checking Git Status...${NC}"
echo "------------------------"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_status "error" "Not in a git repository!"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_status "info" "Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if git diff-index --quiet HEAD --; then
    print_status "success" "No uncommitted changes"
else
    print_status "warning" "There are uncommitted changes:"
    git --no-pager status --porcelain
    echo
    read -p "Do you want to commit and push these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Adding all changes..."
        git add .
        echo -n "Enter commit message (or press enter for default): "
        read COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="chore: automated backup commit $(date '+%Y-%m-%d %H:%M:%S')"
        fi
        git commit -m "$COMMIT_MSG"
        print_status "success" "Changes committed"
    else
        print_status "warning" "Uncommitted changes remain. Backup incomplete."
    fi
fi

# Check if local is ahead of remote
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "no-remote")
BASE=$(git merge-base @ @{u} 2>/dev/null || echo "no-base")

if [ "$REMOTE" = "no-remote" ]; then
    print_status "warning" "No remote tracking branch found"
elif [ "$LOCAL" = "$REMOTE" ]; then
    print_status "success" "Local branch is up to date with remote"
elif [ "$LOCAL" = "$BASE" ]; then
    print_status "warning" "Local branch is behind remote. Consider pulling."
elif [ "$REMOTE" = "$BASE" ]; then
    print_status "warning" "Local branch is ahead of remote. Pushing..."
    git push origin "$CURRENT_BRANCH"
    print_status "success" "Changes pushed to GitHub"
else
    print_status "error" "Local and remote have diverged!"
fi

# 2. Check GitHub Connection
echo -e "\n${BLUE}2. Checking GitHub Connection...${NC}"
echo "--------------------------------"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$REMOTE_URL" ]; then
    print_status "success" "Remote repository: $REMOTE_URL"
    
    # Test connection to remote
    if git ls-remote origin HEAD > /dev/null 2>&1; then
        print_status "success" "GitHub connection verified"
    else
        print_status "error" "Cannot connect to GitHub remote"
    fi
else
    print_status "error" "No remote repository configured"
fi

# 3. Check Vercel Status
echo -e "\n${BLUE}3. Checking Vercel Deployment...${NC}"
echo "-------------------------------"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_status "error" "Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
fi

# Check if logged into Vercel
if ! vercel whoami > /dev/null 2>&1; then
    print_status "error" "Not logged into Vercel. Run: vercel login"
    exit 1
fi

# Get latest deployment info
echo "Fetching latest deployment..."
LATEST_DEPLOYMENT=$(vercel ls --json 2>/dev/null | jq -r '.[0] // empty')

if [ -n "$LATEST_DEPLOYMENT" ]; then
    DEPLOYMENT_URL=$(echo "$LATEST_DEPLOYMENT" | jq -r '.url // "unknown"')
    DEPLOYMENT_STATE=$(echo "$LATEST_DEPLOYMENT" | jq -r '.state // "unknown"')
    DEPLOYMENT_AGE=$(echo "$LATEST_DEPLOYMENT" | jq -r '.age // "unknown"')
    
    print_status "info" "Latest deployment: $DEPLOYMENT_URL"
    print_status "info" "Status: $DEPLOYMENT_STATE"
    print_status "info" "Age: $DEPLOYMENT_AGE"
    
    case $DEPLOYMENT_STATE in
        "READY")
            print_status "success" "Deployment is ready and live"
            ;;
        "BUILDING")
            print_status "warning" "Deployment is currently building"
            ;;
        "QUEUED")
            print_status "warning" "Deployment is queued"
            ;;
        "ERROR")
            print_status "error" "Deployment failed"
            ;;
        *)
            print_status "warning" "Unknown deployment state: $DEPLOYMENT_STATE"
            ;;
    esac
    
    # Check if deployment is recent (within last hour)
    if command -v jq &> /dev/null && [ "$DEPLOYMENT_AGE" != "unknown" ]; then
        # This is a simplified check - you might want to implement proper age parsing
        if [[ "$DEPLOYMENT_AGE" =~ ^[0-9]+m$ ]]; then
            MINUTES=$(echo "$DEPLOYMENT_AGE" | sed 's/m//')
            if [ "$MINUTES" -lt 60 ]; then
                print_status "success" "Deployment is recent (within last hour)"
            else
                print_status "warning" "Latest deployment is older than 1 hour"
            fi
        fi
    fi
else
    print_status "error" "Could not fetch deployment information"
fi

# 4. Environment Check
echo -e "\n${BLUE}4. Checking Environment Configuration...${NC}"
echo "---------------------------------------"

# Check for important config files
config_files=(".env.local" ".env.production" "vercel.json" "package.json")
for file in "${config_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "success" "$file found"
    else
        print_status "warning" "$file not found"
    fi
done

# Check if this is a Next.js project
if [ -f "package.json" ] && grep -q "next" package.json; then
    print_status "success" "Next.js project detected"
    
    # Check for build script
    if grep -q '"build"' package.json; then
        print_status "success" "Build script found in package.json"
    else
        print_status "warning" "No build script found in package.json"
    fi
fi

# 5. Summary
echo -e "\n${BLUE}5. Summary${NC}"
echo "----------"

echo "Backup Status:"
if git diff-index --quiet HEAD -- && [ "$LOCAL" = "$REMOTE" ]; then
    print_status "success" "✅ All changes are backed up to GitHub"
else
    print_status "warning" "⚠️  Some changes may not be backed up"
fi

echo
echo "Deployment Status:"
if [ -n "$LATEST_DEPLOYMENT" ] && [ "$DEPLOYMENT_STATE" = "READY" ]; then
    print_status "success" "✅ Latest deployment is live on Vercel"
else
    print_status "warning" "⚠️  Check deployment status manually"
fi

echo
echo "Next steps you can take:"
echo "- Run this script regularly (daily/weekly)"
echo "- Set up GitHub Actions for automated testing"
echo "- Configure Vercel webhooks for deployment notifications"
echo "- Consider setting up monitoring for your live site"

echo -e "\n${GREEN}🎉 Backup and deployment check completed!${NC}"
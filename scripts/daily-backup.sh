#!/bin/bash

# Simple Daily Backup Script
# Run this daily to ensure your work is always backed up

set -e

echo "🚀 Daily Backup Check - $(date)"
echo "==============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Found uncommitted changes${NC}"
    
    # Auto-commit with timestamp
    echo "Adding and committing changes..."
    git add .
    git commit -m "chore: daily backup - $(date '+%Y-%m-%d %H:%M')"
    echo -e "${GREEN}✅ Changes committed${NC}"
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi

# Push to GitHub
echo "Pushing to GitHub..."
if git push origin main; then
    echo -e "${GREEN}✅ Successfully pushed to GitHub${NC}"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
fi

# Check latest Vercel deployment
echo "Checking Vercel status..."
if command -v vercel &> /dev/null; then
    LATEST_STATUS=$(vercel ls 2>/dev/null | head -6 | tail -1 | awk '{print $3}')
    if [[ "$LATEST_STATUS" == *"Ready"* ]]; then
        echo -e "${GREEN}✅ Vercel deployment is ready${NC}"
    elif [[ "$LATEST_STATUS" == *"Building"* ]]; then
        echo -e "${YELLOW}⏳ Vercel is building...${NC}"
    else
        echo -e "${YELLOW}⚠️  Check Vercel status manually${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Vercel CLI not found${NC}"
fi

echo -e "\n${GREEN}🎉 Daily backup completed!${NC}"
echo "Your work is safely backed up to GitHub."

# Log the backup
echo "$(date): Daily backup completed successfully" >> scripts/backup.log
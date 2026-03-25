#!/bin/bash

# DirectFanz Sign-In Debug Script
# Run this to diagnose sign-in issues

echo "=================================================="
echo "  DirectFanz Sign-In Debugging"
echo "=================================================="
echo ""

# Get deployment URL
echo "Enter your Vercel deployment URL (e.g., https://directfanz-abc123.vercel.app):"
read DEPLOYMENT_URL

echo ""
echo "1️⃣  Testing database connection..."
echo "=================================================="
curl -s "${DEPLOYMENT_URL}/api/test-db" | jq '.' || curl -s "${DEPLOYMENT_URL}/api/test-db"

echo ""
echo ""
echo "2️⃣  Testing NextAuth API endpoint..."
echo "=================================================="
curl -s "${DEPLOYMENT_URL}/api/auth/providers" | jq '.' || curl -s "${DEPLOYMENT_URL}/api/auth/providers"

echo ""
echo ""
echo "3️⃣  Next Steps Based on Results:"
echo "=================================================="
echo ""
echo "If /api/test-db shows:"
echo "  • 'Table doesn't exist' → Run: npx prisma db push"
echo "  • 'Can't reach database' → Check DATABASE_URL password"
echo "  • 'userCount: 0' → No users exist, need to create test user"
echo "  • 'userCount: 1+' → Users exist! Check Vercel Runtime Logs"
echo ""
echo "4️⃣  Check Vercel Runtime Logs:"
echo "=================================================="
echo "  1. Go to: https://vercel.com/dashboard"
echo "  2. Click: directfanz project"
echo "  3. Click: Deployments → Latest deployment"
echo "  4. Click: Runtime Logs tab"
echo "  5. Try to sign in on your site"
echo "  6. Copy the error message that appears"
echo ""
echo "5️⃣  Share These Results:"
echo "=================================================="
echo "  Share the output above and any errors from Runtime Logs"
echo ""

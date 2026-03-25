#!/bin/bash

# DirectFanz - Setup Vercel Environment Variables
# This script uploads environment variables to your Vercel project

set -e

echo "════════════════════════════════════════════════════════════"
echo "  DirectFanz - Environment Variables Setup"
echo "════════════════════════════════════════════════════════════"
echo ""

PROJECT_NAME="directfanz"

# Check if .env.production.secrets exists
if [ ! -f ".env.production.secrets" ]; then
    echo "❌ .env.production.secrets not found!"
    echo "Please create this file with your production secrets first."
    exit 1
fi

echo "This will upload environment variables from:"
echo "  - .env.production.secrets (generated secrets)"
echo ""
echo "To Vercel project: $PROJECT_NAME"
echo ""
echo "Continue? (y/n)"
read -r CONTINUE

if [ "$CONTINUE" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Setting environment variables..."
echo ""

# Read and upload secrets from .env.production.secrets
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue

    # Remove quotes and whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | tr -d '"' | xargs)

    if [ -n "$value" ] && [ "$value" != "your-"* ]; then
        echo "✓ Setting $key"
        echo "$value" | vercel env add "$key" production --yes 2>/dev/null || echo "  (already exists, skipping)"
    fi
done < .env.production.secrets

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Additional Environment Variables Needed"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "You still need to manually add these via Vercel dashboard:"
echo ""
echo "Go to: https://vercel.com/your-account/directfanz/settings/environment-variables"
echo ""
echo "Required variables:"
echo "  - DATABASE_URL (your PostgreSQL connection string)"
echo "  - NEXTAUTH_URL (https://www.directfanz.io)"
echo "  - STRIPE_SECRET_KEY (your Stripe live key)"
echo "  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "  - STRIPE_WEBHOOK_SECRET"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - AWS_S3_BUCKET_NAME"
echo "  - AWS_REGION (e.g., us-east-1)"
echo "  - SENDGRID_API_KEY"
echo "  - FROM_EMAIL (noreply@directfanz.io)"
echo ""
echo "Optional but recommended:"
echo "  - REDIS_URL (Upstash Redis)"
echo "  - NEXT_PUBLIC_SENTRY_DSN"
echo "  - SENTRY_AUTH_TOKEN"
echo ""
echo "✅ Generated secrets uploaded!"
echo "📝 Add remaining variables in Vercel dashboard"
echo ""

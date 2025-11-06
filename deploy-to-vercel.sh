#!/bin/bash

# Vercel Deployment - Quick Start Script
# Run this in your terminal to deploy DirectFanz to Vercel

echo "════════════════════════════════════════════════════════════"
echo "  DirectFanz - Vercel Production Deployment"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Login to Vercel
echo "Step 1: Logging into Vercel..."
vercel login

# Step 2: Check current deployments
echo ""
echo "Step 2: Checking existing deployments..."
vercel ls

# Step 3: Set environment variables from .env files
echo ""
echo "Step 3: Setting up environment variables..."
echo "Do you want to upload environment variables to Vercel? (y/n)"
read -r UPLOAD_ENV

if [ "$UPLOAD_ENV" = "y" ]; then
    echo "Uploading environment variables from .env.production.secrets..."

    # Upload secrets
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue

        # Remove quotes from value
        value=$(echo "$value" | tr -d '"')

        echo "Setting $key..."
        echo "$value" | vercel env add "$key" production
    done < .env.production.secrets

    echo "✓ Environment variables uploaded!"
fi

# Step 4: Deploy to production
echo ""
echo "Step 4: Deploying to production..."
echo "Ready to deploy? This will:"
echo "  - Build your Next.js application"
echo "  - Deploy to Vercel production"
echo "  - Make it live at your domain"
echo ""
echo "Continue? (y/n)"
read -r DEPLOY

if [ "$DEPLOY" = "y" ]; then
    vercel --prod
    echo ""
    echo "🎉 Deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://vercel.com/dashboard to view your deployment"
    echo "2. Configure your custom domain if needed"
    echo "3. Update NEXTAUTH_URL environment variable with your domain"
    echo "4. Update Stripe webhook URL to point to your production domain"
else
    echo "Deployment cancelled. You can deploy later with: vercel --prod"
fi

echo ""
echo "════════════════════════════════════════════════════════════"

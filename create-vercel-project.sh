#!/bin/bash

# DirectFanz - Create New Vercel Project Script
# This script will create a new Vercel project called "directfanz"

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════"
echo "  DirectFanz - Create New Vercel Project"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

echo "Step 1: Login to Vercel"
echo "This will open your browser for authentication..."
echo ""
vercel login

echo ""
echo "Step 2: Creating new Vercel project 'directfanz'"
echo ""
echo "When prompted:"
echo "  - Set up and deploy? → Yes"
echo "  - Which scope? → Select your account/team"
echo "  - Link to existing project? → No (we're creating new)"
echo "  - What's your project's name? → directfanz"
echo "  - In which directory is your code? → ./"
echo "  - Want to override settings? → No (auto-detected)"
echo ""
echo "Press Enter to continue..."
read

# Deploy to create the project
echo "Creating project..."
vercel --name directfanz

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ Project Created Successfully!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next Steps:"
echo ""
echo "1. Configure your domain (directfanz.io):"
echo "   vercel domains add directfanz.io"
echo "   vercel domains add www.directfanz.io"
echo ""
echo "2. Set environment variables:"
echo "   Run: ./setup-vercel-env.sh"
echo "   Or manually in dashboard: https://vercel.com/dashboard"
echo ""
echo "3. Deploy to production:"
echo "   vercel --prod"
echo ""
echo "Your project dashboard:"
echo "https://vercel.com/your-account/directfanz"
echo ""

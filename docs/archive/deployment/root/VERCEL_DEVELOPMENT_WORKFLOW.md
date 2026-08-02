# DirectFanZ Vercel Development Workflow Guide

## 🎯 Complete Development Workflow for Live Feature Testing

This guide will help you enhance features and see progress live on Vercel with automatic deployments.

## 📋 Current Setup
- **Repository**: https://github.com/Shockvaluemedia/directfanz-project.git
- **Vercel CLI**: v48.1.0 ✅
- **Local Development**: http://localhost:3000
- **Production**: Your Vercel deployment

## 🚀 Step 1: Link Project to Vercel

```bash
# Navigate to your project directory
cd "/Users/demetriusbrooks/DirectFanZ Project"

# Link your local project to Vercel
vercel link

# Follow the prompts:
# - Select your team/account
# - Choose existing project or create new
# - Confirm the project settings
```

## 🌿 Step 2: Set Up Branch-Based Development Workflow

### Create Feature Branch System
```bash
# Create and switch to a new feature branch
git checkout -b feature/new-messaging-ui
git checkout -b feature/enhanced-analytics
git checkout -b feature/payment-improvements

# Work on your feature locally
npm run dev  # Runs on http://localhost:3000

# When ready, commit and push
git add .
git commit -m "feat: add new messaging interface"
git push origin feature/new-messaging-ui
```

### Automatic Preview Deployments
Every push to any branch creates a **preview deployment**:
- **Main branch** → Production deployment
- **Feature branches** → Preview URLs (e.g., `feature-new-messaging-ui-abc123.vercel.app`)

## ⚙️ Step 3: Environment Variables Setup

### Local Environment
Ensure your `.env.local` is properly configured:
```bash
# Check your current environment variables
ls -la .env*

# Copy example if needed
cp .env.example .env.local
```

### Vercel Dashboard Setup
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your DirectFanZ project
3. Go to **Settings** → **Environment Variables**
4. Add all required variables for production:

```bash
# Essential variables to add:
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-project.vercel.app
DATABASE_URL=your-production-database-url
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 🛠️ Step 4: Development Commands

### Local Development
```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build locally (same as Vercel)
npm run build

# Preview production build locally
npm run start
```

### Vercel Commands
```bash
# Deploy current branch to preview URL
vercel

# Deploy to production (main branch)
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs

# Open project in browser
vercel open
```

## 🔄 Step 5: Complete Feature Development Workflow

### 1. Start New Feature
```bash
# Create feature branch
git checkout -b feature/enhanced-search
npm run dev
```

### 2. Develop and Test Locally
```bash
# Make changes to your code
# Test at http://localhost:3000
# Use your comprehensive API endpoints we tested
```

### 3. Test with Preview Deployment
```bash
# Commit changes
git add .
git commit -m "feat: enhance search with filters"

# Push to get preview URL
git push origin feature/enhanced-search

# Vercel automatically creates preview at:
# https://directfanz-project-abc123.vercel.app
```

### 4. Share and Test Live
- **Preview URL** is live immediately
- Share with team/users for testing
- Test all authenticated workflows we verified
- Check mobile responsiveness

### 5. Deploy to Production
```bash
# Merge to main branch
git checkout main
git pull origin main
git merge feature/enhanced-search
git push origin main

# Production automatically updates
```

## 📊 Step 6: Monitoring and Debugging

### Vercel Analytics
```bash
# View deployment analytics
vercel logs --follow

# Check function performance
vercel inspect [deployment-url]
```

### Local Database Connection
If using production database for testing:
```bash
# Update .env.local to use production DB temporarily
# DATABASE_URL=your-production-url

# Or use branch-specific environment variables
```

## 🎨 Step 7: Enhanced Feature Development Examples

### Example: Adding New Messaging Features
```bash
# 1. Create feature branch
git checkout -b feature/video-messages

# 2. Work locally
npm run dev
# Add video message components
# Test with existing authenticated users we created

# 3. Deploy preview
git add .
git commit -m "feat: add video messaging support"
git push origin feature/video-messages

# 4. Test live at preview URL
# - Test with artist@directfanz.com
# - Test with fan@directfanz.com
# - Verify video upload/playback works
```

### Example: Analytics Dashboard Enhancement
```bash
# 1. Create feature branch
git checkout -b feature/real-time-analytics

# 2. Use existing API endpoints we tested
# GET /api/analytics
# GET /api/metrics
# Test locally with authenticated sessions

# 3. Deploy and test live metrics
git push origin feature/real-time-analytics
```

## 🔧 Step 8: Advanced Workflow Features

### Environment-Specific Features
```bash
# Use different features per environment
if (process.env.NODE_ENV === 'development') {
  // Debug features, test data
}

if (process.env.VERCEL_ENV === 'preview') {
  // Preview-specific features
}

if (process.env.VERCEL_ENV === 'production') {
  // Production-only features
}
```

### Preview Deployment with Environment Variables
```bash
# Set preview-specific variables in Vercel dashboard
# Environment: Preview
ENABLE_EXPERIMENTAL_FEATURES=true
DEBUG_MODE=true
```

## 📱 Step 9: Testing on Different Devices

### Mobile Testing
```bash
# Preview URLs work on any device
# Share preview URL: https://directfanz-feature-abc123.vercel.app
# Test on:
# - iOS Safari
# - Android Chrome  
# - Desktop browsers
# - Different screen sizes
```

## 🚨 Step 10: Rollback and Safety

### Quick Rollback
```bash
# If production has issues, rollback via Vercel dashboard
# Or redeploy previous working commit:

git checkout main
git reset --hard [previous-working-commit]
git push --force origin main
```

### Safe Deployment Practice
```bash
# Always test in preview first
# Use feature flags for gradual rollouts
# Monitor Vercel function logs
# Check error rates in Vercel dashboard
```

## ✅ Success Checklist

### For Each New Feature:
- [ ] Create feature branch
- [ ] Develop and test locally (`npm run dev`)
- [ ] Commit and push for preview deployment
- [ ] Test preview URL thoroughly
- [ ] Test authenticated workflows (login, API calls)
- [ ] Test on mobile devices
- [ ] Check Vercel function logs
- [ ] Merge to main for production deployment
- [ ] Monitor production for issues

### Environment Setup:
- [ ] Vercel project linked (`vercel link`)
- [ ] Environment variables configured on Vercel
- [ ] Local development server working
- [ ] Git workflow established
- [ ] Preview deployments working
- [ ] Production deployment working

## 🎯 Pro Tips

1. **Use Preview Comments**: Vercel adds comments to GitHub PRs with preview URLs
2. **Environment Branches**: Create `staging` branch for pre-production testing
3. **Database Branching**: Consider separate databases for preview/production
4. **Function Monitoring**: Watch Vercel function execution times
5. **Edge Caching**: Utilize Vercel's edge network for static assets

## 🚀 Next Steps After Setup

1. **Create your first feature branch**
2. **Make a small change and test the workflow**
3. **Verify preview deployment works**
4. **Test authenticated features live**
5. **Set up monitoring and alerts**

---

**This workflow enables you to:**
- ✅ Develop features locally
- ✅ See changes live instantly on preview URLs
- ✅ Test with real users on any device
- ✅ Deploy safely to production
- ✅ Rollback quickly if needed
- ✅ Monitor performance and errors

Your DirectFanZ platform is ready for rapid, safe feature development! 🔥
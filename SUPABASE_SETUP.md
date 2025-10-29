# Quick Supabase Database Setup for DirectFanZ

## Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up/Sign in
3. Click "New Project"
4. Choose organization and create project
5. Wait for database to be ready (2-3 minutes)

## Step 2: Get Database URL
1. Go to Project Settings → Database
2. Copy the "Connection string" under "Connection pooling"
3. It looks like: `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

## Step 3: Update Environment Variables

### Local (.env):
```bash
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

### Production (Vercel):
```bash
vercel env add DATABASE_URL production
# Paste the same URL when prompted
```

## Step 4: Run Database Setup
```bash
# Push schema to Supabase
npm run db:push

# Create test user
node scripts/create-test-user-production.cjs

# Deploy with new database
vercel --prod
```

## Step 5: Test Sign-In
- **Email:** test@directfanz.com  
- **Password:** TestPassword123!

---

**This ensures both local and production use the same database with the same users!**
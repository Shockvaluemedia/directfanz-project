# 🔧 Fix Sign In / Sign Up Not Working

## ⚠️ Already Using Supabase?

If you were previously connected to Supabase, **see RECONNECT_SUPABASE.md instead!**

That guide will help you reconnect your existing Supabase database in 5 minutes.

---

## 🎯 The Problem

Your sign in and sign up features aren't working because **the database isn't connected**.

When I helped you fix the build error, we used a placeholder `DATABASE_URL`:
```
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
```

This allowed the **build to succeed**, but the app **can't function** without a real database because:
- Sign up needs to **create users** in the database
- Sign in needs to **look up users** in the database
- Sessions need to be **stored and validated**

---

## ✅ Quick Fix (10 minutes)

### Step 1: Create Vercel Postgres Database

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Click on your **directfanz** project
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose plan:
   - **Hobby** (Free) - For testing (500MB storage, 60 hours compute/month)
   - **Pro** ($20/month) - For production (10GB storage, unlimited compute)
7. Click **Create**

**Vercel will automatically add `DATABASE_URL` to your environment variables!** ✅

---

### Step 2: Run Database Migrations

Your database is now connected, but **empty** (no tables). You need to create the database schema.

**Option A: Let Vercel do it** (Easiest)

1. In Vercel dashboard → **Settings** → **Environment Variables**
2. Verify `DATABASE_URL` exists (added automatically from Step 1)
3. Add one more variable to enable automatic migrations:
   ```
   Name: ENABLE_EXPERIMENTAL_COREPACK
   Value: 1
   ```
4. Go to **Deployments** tab
5. Click **⋯** (three dots) on latest deployment
6. Click **Redeploy**

During the redeploy, Vercel will:
- Connect to the database
- Run Prisma migrations
- Create all tables
- Your auth will work! ✅

**Option B: Run migrations manually** (More control)

If you have Vercel CLI access locally:

```bash
# Pull environment variables from Vercel
vercel env pull .env.vercel

# Run Prisma migrations
npx prisma migrate deploy

# Or push schema without migrations
npx prisma db push
```

---

### Step 3: Verify It Works

After redeploying:

1. Visit your deployment URL
2. Try to **sign up** with a test account:
   - Email: test@example.com
   - Password: TestPassword123!
3. You should see **"User created successfully"** ✅
4. Try to **sign in** with those credentials
5. You should be logged in! ✅

---

## 🔍 Troubleshooting

### Issue: "DATABASE_URL not found"

**Solution**: Make sure you created the Vercel Postgres database in Step 1. The `DATABASE_URL` should be automatically added to your environment variables.

To verify:
1. Vercel dashboard → Settings → Environment Variables
2. Look for `DATABASE_URL` (should start with `postgres://` or `postgresql://`)

---

### Issue: "Error: P1001 Can't reach database server"

**Solution**: Your DATABASE_URL might still be the placeholder value.

1. Go to Vercel → Storage tab
2. Click on your Postgres database
3. Click **Connect** → **Environment Variables**
4. Copy the `DATABASE_URL`
5. Go to Settings → Environment Variables
6. Update `DATABASE_URL` with the real value
7. Redeploy

---

### Issue: "Table 'users' doesn't exist"

**Solution**: Database exists but tables haven't been created. Run migrations:

```bash
# From your local machine with Vercel CLI
vercel env pull .env.vercel
npx prisma db push
```

Or add a **postbuild** script (already exists in package.json):
```json
{
  "scripts": {
    "postbuild": "prisma generate && prisma db push --accept-data-loss"
  }
}
```

Then redeploy.

---

### Issue: Still not working after all steps

**Check Vercel logs**:

1. Vercel dashboard → **Deployments** tab
2. Click on your latest deployment
3. Click **Runtime Logs**
4. Look for errors like:
   - `❌ DATABASE_URL is not set!`
   - `Error during authorization`
   - `Prisma connection error`

Send me the error messages and I'll help troubleshoot!

---

## 📋 Required Environment Variables for Auth

After setting up the database, verify you have **all** these variables:

```bash
# Core Authentication (from .env.production.secrets)
NEXTAUTH_SECRET=<REDACTED_ROTATE_NEXTAUTH_SECRET>
ENCRYPTION_KEY=<REDACTED_ROTATE_ENCRYPTION_KEY>
JWT_SECRET=<REDACTED_ROTATE_JWT_SECRET>

# Configuration
NODE_ENV=production
NEXTAUTH_URL=https://your-deployment-url.vercel.app

# Database (from Vercel Postgres - Step 1)
DATABASE_URL=postgres://default:xxxxx@xxx-xxx-xxx.vercel-storage.com:5432/verceldb

# Prisma Connection Pooling (Vercel also provides this)
POSTGRES_PRISMA_URL=postgres://default:xxxxx@xxx-xxx-xxx-pooler.vercel-storage.com:5432/verceldb?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgres://default:xxxxx@xxx-xxx-xxx.vercel-storage.com:5432/verceldb
```

---

## 🎯 Quick Commands Reference

```bash
# Check database connection
npx prisma db pull

# Create/update database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Open database in browser (Prisma Studio)
npx prisma studio

# View database schema
npx prisma db pull && cat prisma/schema.prisma

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

---

## 📚 Related Guides

- **VERCEL_BUILD_FIX.md** - Original build error fix (how we got here)
- **VERCEL_ENV_CHECKLIST.md** - Complete environment variables guide
- **DEPLOYMENT_READY.md** - Master deployment guide

---

## ✅ Summary

**Problem**: Database URL was a placeholder
**Solution**: Create Vercel Postgres database
**Time**: ~10 minutes
**Result**: Sign in/sign up working ✅

Let me know once you've completed Step 1 (creating the database) and I can help with the next steps!

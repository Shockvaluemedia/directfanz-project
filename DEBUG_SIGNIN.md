# 🔍 DEBUG: Sign In Not Working - Complete Diagnostic Guide

## 🎯 Let's Find the Exact Problem

Follow these steps **in order** to identify what's failing:

---

## ✅ STEP 1: Check Vercel Build Status

1. Go to: https://vercel.com/dashboard
2. Click your **directfanz** project
3. Go to **Deployments** tab
4. Look at the latest deployment

**Questions:**
- ✅ **Is it GREEN (Ready)?** → Build succeeded, go to Step 2
- ❌ **Is it RED (Failed)?** → Build failed, check build logs for errors

**If build failed**, look for:
- `STRIPE_SECRET_KEY is not set` → Add Stripe placeholder variables
- `DATABASE_URL is not set` → Add your Supabase DATABASE_URL
- Other missing environment variables

---

## ✅ STEP 2: Check Runtime Logs (THIS IS KEY!)

This will show you the EXACT error when you try to sign in.

### How to View Runtime Logs:

1. Go to: https://vercel.com/dashboard
2. Click **directfanz** project
3. Click **Deployments** tab
4. Click on the **latest GREEN deployment**
5. Click **Runtime Logs** tab (or **Functions** tab)
6. Keep this window open
7. **In another tab**, open your deployed site
8. **Try to sign in** with any credentials
9. **Watch the Runtime Logs** - you'll see errors appear in real-time

### What Errors to Look For:

**Error Pattern 1: Database Connection Failed**
```
❌ DATABASE_URL is not set!
P1001: Can't reach database server
Error: getaddrinfo ENOTFOUND
```
**Problem**: DATABASE_URL is wrong or missing
**Fix**: Check DATABASE_URL in Vercel environment variables

---

**Error Pattern 2: Table Doesn't Exist**
```
Invalid `prisma.users.findUnique()` invocation
Table 'users' doesn't exist
P2021: The table `users` does not exist
```
**Problem**: Database is empty - no tables created
**Fix**: Run Prisma migrations (see Step 3)

---

**Error Pattern 3: No User Found**
```
🔐 AUTHORIZE FUNCTION CALLED
🔍 Looking up user in database...
❌ User not found or no password
```
**Problem**: Database exists but has no users
**Fix**: Create a test user (see Step 4)

---

**Error Pattern 4: Password Mismatch**
```
👤 User found: true Has password: true
🔐 Comparing passwords...
❌ Password validation failed
```
**Problem**: Wrong password, or user's password isn't hashed correctly
**Fix**: Reset user password or create new user

---

**Error Pattern 5: NEXTAUTH_SECRET Issue**
```
[next-auth][error][SIGNIN_ERROR]
JWTSessionError: Read more at https://errors.authjs.dev
```
**Problem**: NEXTAUTH_SECRET missing or wrong
**Fix**: Check NEXTAUTH_SECRET in environment variables

---

## ✅ STEP 3: Verify Database Tables Exist

### Check in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard
2. Select your DirectFanz project (ID: `xcxlvyfbzvnnuueyntot`)
3. Click **Table Editor** (left sidebar)

**Do you see these tables?**
- [ ] users
- [ ] artists
- [ ] subscriptions
- [ ] content
- [ ] sessions
- [ ] posts

**If NO tables exist** → Tables need to be created!

### Create Tables (Run Prisma Migration):

**Option A: From Your Local Machine** (Fastest)

```bash
# 1. Export your Supabase DATABASE_URL
export DATABASE_URL="postgresql://postgres.xcxlvyfbzvnnuueyntot:YOUR_PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

# 2. Generate Prisma client
npx prisma generate

# 3. Push schema to create all tables
npx prisma db push

# 4. Verify it worked
npx prisma studio
```

**Option B: Use SQL in Supabase**

If you can't run locally, I can provide the SQL schema to paste directly into Supabase SQL editor.

---

## ✅ STEP 4: Check if Users Exist

After tables are created, check if there are any users:

### In Supabase Dashboard:

1. Go to: https://supabase.com/dashboard
2. Your DirectFanz project → **Table Editor**
3. Click **users** table
4. **Do you see any rows?**

**If NO users** → You need to create a test user!

### Create Test User:

**Option A: Via Script** (if you have local access)

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres.xcxlvyfbzvnnuueyntot:YOUR_PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

# Run create user script
node scripts/create-user-in-supabase.cjs
```

**Option B: Via Supabase SQL Editor**

1. Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Paste this SQL:

```sql
-- First, check if user exists
SELECT * FROM users WHERE email = 'test@directfanz.io';

-- If not, create test user with bcrypt hashed password
-- Password: TestPassword123!
INSERT INTO users (id, email, password, "displayName", role, "emailVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'test@directfanz.io',
  '$2a$10$YourBcryptHashHere',
  'Test User',
  'FAN',
  NOW(),
  NOW(),
  NOW()
);
```

**Note**: You need to generate a proper bcrypt hash. Let me know if you need help with this.

---

## ✅ STEP 5: Test Database Connection from Vercel

Create a test API route to verify Vercel can connect to Supabase:

### Test Endpoint to Add:

Create: `src/app/api/test-db/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test connection
    const userCount = await prisma.users.count();

    return NextResponse.json({
      success: true,
      message: 'Database connected!',
      userCount: userCount,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    }, { status: 500 });
  }
}
```

Then visit: `https://your-deployment.vercel.app/api/test-db`

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Database connected!",
  "userCount": 1,
  "databaseUrl": "SET"
}
```

**If you see an error**, it will tell you exactly what's wrong!

---

## ✅ STEP 6: Verify Environment Variables in Vercel

1. Vercel Dashboard → **directfanz** → **Settings** → **Environment Variables**

**Check these are SET for Production:**

- [ ] `DATABASE_URL` = `postgresql://postgres.xcxlvyfbzvnnuueyntot:PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres`
- [ ] `NEXTAUTH_SECRET` = `o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=`
- [ ] `NEXTAUTH_URL` = Your Vercel deployment URL
- [ ] `NODE_ENV` = `production`
- [ ] `ENCRYPTION_KEY` = `126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668`
- [ ] `JWT_SECRET` = `DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=`

**After adding/changing any variable** → You MUST redeploy!

---

## ✅ STEP 7: Test Sign In Flow Step-by-Step

1. **Open your deployed site**: `https://your-deployment.vercel.app`
2. **Open browser DevTools**: Press F12 → Console tab
3. **Go to sign in page**: `/auth/signin` or click Sign In
4. **Try to sign in** with:
   - Email: `test@directfanz.io`
   - Password: `TestPassword123!`

### Watch for errors in:

**Browser Console:**
- Network errors (check Network tab)
- JavaScript errors
- Failed POST requests to `/api/auth/signin`

**Vercel Runtime Logs:**
- Database connection errors
- User not found errors
- Password validation errors

---

## 📊 Debugging Decision Tree

```
Sign In Not Working
    │
    ├─ Build Failed?
    │   └─ Check build logs → Add missing env vars
    │
    ├─ Build Succeeded but Runtime Error?
    │   ├─ DATABASE_URL not set → Add to Vercel env vars
    │   ├─ Can't reach database → Check DATABASE_URL password
    │   ├─ Table doesn't exist → Run prisma db push
    │   ├─ User not found → Create test user
    │   └─ Password mismatch → Check password hash
    │
    └─ No Error but Can't Sign In?
        └─ Check NEXTAUTH_SECRET and NEXTAUTH_URL
```

---

## 🆘 What to Tell Me

After following these steps, tell me:

1. **Build status**: ✅ Green/Ready or ❌ Red/Failed?
2. **Runtime logs error**: What exact error appears when you try to sign in?
3. **Tables exist?**: Do you see `users` table in Supabase?
4. **User count**: How many users are in the database?
5. **Test endpoint**: What does `/api/test-db` return?

With this info, I can give you the exact fix! 🎯

---

## 🔧 Quick Fixes for Common Issues

### "Table 'users' doesn't exist"
```bash
export DATABASE_URL="your-supabase-url"
npx prisma db push
```

### "User not found"
```bash
# Create test user
node scripts/create-user-in-supabase.cjs
```

### "Can't reach database server"
```
→ DATABASE_URL password is wrong
→ Get correct URL from Supabase dashboard
```

### "NEXTAUTH_SECRET is not set"
```
→ Add NEXTAUTH_SECRET to Vercel env vars
→ Redeploy
```

---

Let me know what you find in the Runtime Logs and we'll fix it! 🚀

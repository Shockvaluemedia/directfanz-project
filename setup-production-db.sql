-- DirectFanz Production Database Schema Setup
-- PostgreSQL Version

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'FAN',
    "displayName" TEXT NOT NULL,
    bio TEXT,
    avatar TEXT,
    "socialLinks" JSONB,
    "notificationPreferences" JSONB,
    "emailVerified" TIMESTAMP,
    image TEXT,
    "lastSeenAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create accounts table for NextAuth
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create sessions table for NextAuth
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" TEXT NOT NULL,
    expires TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create verificationtokens table for NextAuth
CREATE TABLE IF NOT EXISTS verificationtokens (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TIMESTAMP NOT NULL
);

-- Create artists table
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT UNIQUE NOT NULL,
    "stripeAccountId" TEXT UNIQUE,
    "isStripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "totalEarnings" DECIMAL NOT NULL DEFAULT 0,
    "totalSubscribers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create content table
CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "artistId" TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    duration INTEGER,
    format TEXT NOT NULL,
    tags TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("artistId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_idx" ON accounts(provider, "providerAccountId");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON sessions("userId");
CREATE INDEX IF NOT EXISTS "verificationtokens_identifier_token_idx" ON verificationtokens(identifier, token);
CREATE INDEX IF NOT EXISTS "artists_userId_idx" ON artists("userId");
CREATE INDEX IF NOT EXISTS "content_artistId_idx" ON content("artistId");

-- Create basic admin user (optional, for testing)
-- You should change the email and add proper authentication
INSERT INTO users (id, email, role, "displayName", "createdAt", "updatedAt") 
VALUES ('admin-user-id', 'admin@directfanz.com', 'ADMIN', 'Admin User', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'DirectFanz database schema created successfully!' as status;
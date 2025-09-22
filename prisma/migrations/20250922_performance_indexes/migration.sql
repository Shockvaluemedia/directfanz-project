-- Performance optimization indexes
-- This migration adds indexes for frequently queried columns to improve performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_role_createdAt_idx" ON "users"("role", "createdAt");

-- Payment failures table indexes (actual table name)
CREATE INDEX IF NOT EXISTS "payment_failures_createdAt_idx" ON "payment_failures"("createdAt");

-- Content table indexes  
CREATE INDEX IF NOT EXISTS "content_artistId_idx" ON "content"("artistId");
CREATE INDEX IF NOT EXISTS "content_createdAt_idx" ON "content"("createdAt");
CREATE INDEX IF NOT EXISTS "content_artistId_createdAt_idx" ON "content"("artistId", "createdAt");

-- Subscriptions table indexes
CREATE INDEX IF NOT EXISTS "subscriptions_artistId_idx" ON "subscriptions"("artistId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_artistId_status_idx" ON "subscriptions"("artistId", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_createdAt_idx" ON "subscriptions"("createdAt");

-- Messages table indexes
CREATE INDEX IF NOT EXISTS "messages_recipientId_idx" ON "messages"("recipientId");
CREATE INDEX IF NOT EXISTS "messages_recipientId_readAt_idx" ON "messages"("recipientId", "readAt");
CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "messages"("createdAt");

-- Comments table indexes
CREATE INDEX IF NOT EXISTS "comments_createdAt_idx" ON "comments"("createdAt");
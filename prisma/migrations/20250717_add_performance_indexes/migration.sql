-- Add performance indexes to improve query performance

-- User indexes
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("createdAt");

-- Artist indexes
CREATE INDEX IF NOT EXISTS "artists_total_subscribers_idx" ON "artists" ("totalSubscribers");
CREATE INDEX IF NOT EXISTS "artists_total_earnings_idx" ON "artists" ("totalEarnings");

-- Tier indexes
CREATE INDEX IF NOT EXISTS "tiers_artist_id_idx" ON "tiers" ("artistId");
CREATE INDEX IF NOT EXISTS "tiers_minimum_price_idx" ON "tiers" ("minimumPrice");
CREATE INDEX IF NOT EXISTS "tiers_is_active_idx" ON "tiers" ("isActive");
CREATE INDEX IF NOT EXISTS "tiers_subscriber_count_idx" ON "tiers" ("subscriberCount");

-- Content indexes
CREATE INDEX IF NOT EXISTS "content_artist_id_idx" ON "content" ("artistId");
CREATE INDEX IF NOT EXISTS "content_type_idx" ON "content" ("type");
CREATE INDEX IF NOT EXISTS "content_is_public_idx" ON "content" ("isPublic");
CREATE INDEX IF NOT EXISTS "content_created_at_idx" ON "content" ("createdAt");

-- Subscription indexes
CREATE INDEX IF NOT EXISTS "subscriptions_fan_id_idx" ON "subscriptions" ("fanId");
CREATE INDEX IF NOT EXISTS "subscriptions_artist_id_idx" ON "subscriptions" ("artistId");
CREATE INDEX IF NOT EXISTS "subscriptions_tier_id_idx" ON "subscriptions" ("tierId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" ("status");
CREATE INDEX IF NOT EXISTS "subscriptions_current_period_end_idx" ON "subscriptions" ("currentPeriodEnd");

-- Comment indexes
CREATE INDEX IF NOT EXISTS "comments_content_id_idx" ON "comments" ("contentId");
CREATE INDEX IF NOT EXISTS "comments_fan_id_idx" ON "comments" ("fanId");
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments" ("createdAt");

-- Payment failure indexes
CREATE INDEX IF NOT EXISTS "payment_failures_subscription_id_idx" ON "payment_failures" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "payment_failures_is_resolved_idx" ON "payment_failures" ("isResolved");
CREATE INDEX IF NOT EXISTS "payment_failures_next_retry_at_idx" ON "payment_failures" ("nextRetryAt");

-- Invoice indexes
CREATE INDEX IF NOT EXISTS "invoices_subscription_id_idx" ON "invoices" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices" ("dueDate");
CREATE INDEX IF NOT EXISTS "invoices_period_start_idx" ON "invoices" ("periodStart");
CREATE INDEX IF NOT EXISTS "invoices_period_end_idx" ON "invoices" ("periodEnd");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "content_artist_type_idx" ON "content" ("artistId", "type");
CREATE INDEX IF NOT EXISTS "subscriptions_fan_status_idx" ON "subscriptions" ("fanId", "status");
CREATE INDEX IF NOT EXISTS "tiers_artist_active_idx" ON "tiers" ("artistId", "isActive");
-- Add performance indexes for common query patterns
-- Generated from analysis of application query patterns

-- Users table indexes for authentication and lookups
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_last_seen_at_idx" ON "users"("lastSeenAt");

-- Artists table indexes
CREATE INDEX IF NOT EXISTS "artists_user_id_idx" ON "artists"("userId");
CREATE INDEX IF NOT EXISTS "artists_stripe_account_id_idx" ON "artists"("stripeAccountId");
CREATE INDEX IF NOT EXISTS "artists_total_subscribers_idx" ON "artists"("totalSubscribers");
CREATE INDEX IF NOT EXISTS "artists_created_at_idx" ON "artists"("createdAt");

-- Tiers table indexes for subscription queries
CREATE INDEX IF NOT EXISTS "tiers_artist_id_idx" ON "tiers"("artistId");
CREATE INDEX IF NOT EXISTS "tiers_artist_id_active_idx" ON "tiers"("artistId", "isActive");
CREATE INDEX IF NOT EXISTS "tiers_minimum_price_idx" ON "tiers"("minimumPrice");
CREATE INDEX IF NOT EXISTS "tiers_created_at_idx" ON "tiers"("createdAt");

-- Subscriptions table indexes for billing and user lookups
CREATE INDEX IF NOT EXISTS "subscriptions_fan_id_idx" ON "subscriptions"("fanId");
CREATE INDEX IF NOT EXISTS "subscriptions_artist_id_idx" ON "subscriptions"("artistId");
CREATE INDEX IF NOT EXISTS "subscriptions_tier_id_idx" ON "subscriptions"("tierId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_fan_status_idx" ON "subscriptions"("fanId", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_artist_status_idx" ON "subscriptions"("artistId", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "subscriptions"("createdAt");
CREATE INDEX IF NOT EXISTS "subscriptions_current_period_end_idx" ON "subscriptions"("currentPeriodEnd");

-- Content table indexes for artist and discovery queries
CREATE INDEX IF NOT EXISTS "content_artist_id_idx" ON "content"("artistId");
CREATE INDEX IF NOT EXISTS "content_type_idx" ON "content"("type");
CREATE INDEX IF NOT EXISTS "content_visibility_idx" ON "content"("visibility");
CREATE INDEX IF NOT EXISTS "content_artist_visibility_idx" ON "content"("artistId", "visibility");
CREATE INDEX IF NOT EXISTS "content_created_at_idx" ON "content"("createdAt");
CREATE INDEX IF NOT EXISTS "content_total_views_idx" ON "content"("totalViews");
CREATE INDEX IF NOT EXISTS "content_total_likes_idx" ON "content"("totalLikes");

-- Messages table indexes for conversation queries
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages"("senderId");
CREATE INDEX IF NOT EXISTS "messages_recipient_id_idx" ON "messages"("recipientId");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("createdAt");
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages"("senderId", "recipientId", "createdAt");

-- Comments table indexes
CREATE INDEX IF NOT EXISTS "comments_content_id_idx" ON "comments"("contentId");
CREATE INDEX IF NOT EXISTS "comments_fan_id_idx" ON "comments"("fanId");
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments"("createdAt");

-- Live streams table indexes
CREATE INDEX IF NOT EXISTS "live_streams_artist_id_idx" ON "live_streams"("artistId");
CREATE INDEX IF NOT EXISTS "live_streams_status_idx" ON "live_streams"("status");
CREATE INDEX IF NOT EXISTS "live_streams_scheduled_at_idx" ON "live_streams"("scheduledAt");
CREATE INDEX IF NOT EXISTS "live_streams_artist_status_idx" ON "live_streams"("artistId", "status");
CREATE INDEX IF NOT EXISTS "live_streams_is_public_idx" ON "live_streams"("isPublic");

-- Stream viewers table indexes for analytics
CREATE INDEX IF NOT EXISTS "stream_viewers_stream_id_idx" ON "stream_viewers"("streamId");
CREATE INDEX IF NOT EXISTS "stream_viewers_viewer_id_idx" ON "stream_viewers"("viewerId");
CREATE INDEX IF NOT EXISTS "stream_viewers_joined_at_idx" ON "stream_viewers"("joinedAt");

-- Stream chat messages indexes
CREATE INDEX IF NOT EXISTS "stream_chat_messages_stream_id_idx" ON "stream_chat_messages"("streamId");
CREATE INDEX IF NOT EXISTS "stream_chat_messages_sender_id_idx" ON "stream_chat_messages"("senderId");
CREATE INDEX IF NOT EXISTS "stream_chat_messages_created_at_idx" ON "stream_chat_messages"("createdAt");

-- Stream tips indexes for revenue tracking
CREATE INDEX IF NOT EXISTS "stream_tips_stream_id_idx" ON "stream_tips"("streamId");
CREATE INDEX IF NOT EXISTS "stream_tips_tipper_id_idx" ON "stream_tips"("tipperId");
CREATE INDEX IF NOT EXISTS "stream_tips_status_idx" ON "stream_tips"("status");
CREATE INDEX IF NOT EXISTS "stream_tips_created_at_idx" ON "stream_tips"("createdAt");

-- Content views table indexes for analytics
CREATE INDEX IF NOT EXISTS "content_views_content_id_idx" ON "content_views"("contentId");
CREATE INDEX IF NOT EXISTS "content_views_viewer_id_idx" ON "content_views"("viewerId");
CREATE INDEX IF NOT EXISTS "content_views_created_at_idx" ON "content_views"("createdAt");

-- Content likes table indexes
CREATE INDEX IF NOT EXISTS "content_likes_content_id_idx" ON "content_likes"("contentId");
CREATE INDEX IF NOT EXISTS "content_likes_user_id_idx" ON "content_likes"("userId");
CREATE INDEX IF NOT EXISTS "content_likes_created_at_idx" ON "content_likes"("createdAt");

-- Invoices table indexes for billing
CREATE INDEX IF NOT EXISTS "invoices_subscription_id_idx" ON "invoices"("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices"("dueDate");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices"("createdAt");

-- Payment failures table indexes
CREATE INDEX IF NOT EXISTS "payment_failures_subscription_id_idx" ON "payment_failures"("subscriptionId");
CREATE INDEX IF NOT EXISTS "payment_failures_is_resolved_idx" ON "payment_failures"("isResolved");
CREATE INDEX IF NOT EXISTS "payment_failures_next_retry_at_idx" ON "payment_failures"("nextRetryAt");

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS "campaigns_artist_id_idx" ON "campaigns"("artistId");
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");
CREATE INDEX IF NOT EXISTS "campaigns_start_date_idx" ON "campaigns"("startDate");
CREATE INDEX IF NOT EXISTS "campaigns_end_date_idx" ON "campaigns"("endDate");
CREATE INDEX IF NOT EXISTS "campaigns_created_at_idx" ON "campaigns"("createdAt");

-- Reports table indexes for moderation
CREATE INDEX IF NOT EXISTS "reports_reporter_id_idx" ON "reports"("reporterId");
CREATE INDEX IF NOT EXISTS "reports_target_type_idx" ON "reports"("targetType");
CREATE INDEX IF NOT EXISTS "reports_target_id_idx" ON "reports"("targetId");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_priority_idx" ON "reports"("priority");
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports"("createdAt");

-- Accounts table indexes for OAuth
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "accounts_provider_idx" ON "accounts"("provider");

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions"("expires");

-- Refresh tokens table indexes
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expiresAt");
CREATE INDEX IF NOT EXISTS "refresh_tokens_is_revoked_idx" ON "refresh_tokens"("isRevoked");
/*
  Warnings:

  - You are about to drop the column `isPublic` on the `content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN "deliveredAt" DATETIME;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastSeenAt" DATETIME;

-- CreateTable
CREATE TABLE "campaign_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dailySignups" INTEGER NOT NULL DEFAULT 0,
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "activeParticipants" INTEGER NOT NULL DEFAULT 0,
    "dailySubmissions" INTEGER NOT NULL DEFAULT 0,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "dailyViews" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "mentionsCount" INTEGER NOT NULL DEFAULT 0,
    "hashtagUse" INTEGER NOT NULL DEFAULT 0,
    "dailyRevenue" DECIMAL NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL NOT NULL DEFAULT 0,
    "engagementRate" DECIMAL NOT NULL DEFAULT 0,
    "retentionRate" DECIMAL NOT NULL DEFAULT 0,
    "completionRate" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "campaign_analytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_rewards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "contentId" TEXT,
    "accessDays" INTEGER,
    "tierAccess" TEXT,
    "shippingRequired" BOOLEAN NOT NULL DEFAULT false,
    "estimatedValue" DECIMAL,
    "supplier" TEXT,
    "rankRequirement" INTEGER,
    "scoreRequirement" INTEGER,
    "participationRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalAwarded" INTEGER NOT NULL DEFAULT 0,
    "remainingQuantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaign_rewards_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "campaign_rewards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "maxParticipants" INTEGER,
    "entryFee" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "targetMetric" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "totalPrizePool" DECIMAL NOT NULL DEFAULT 0,
    "hasDigitalPrizes" BOOLEAN NOT NULL DEFAULT false,
    "hasPhysicalPrizes" BOOLEAN NOT NULL DEFAULT false,
    "bannerImage" TEXT,
    "brandColor" TEXT DEFAULT '#6366f1',
    "tags" TEXT,
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "totalEngagement" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenge_leaderboards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "submissions" INTEGER NOT NULL,
    "lastSubmissionAt" DATETIME,
    "baseScore" INTEGER NOT NULL DEFAULT 0,
    "bonusScore" INTEGER NOT NULL DEFAULT 0,
    "penaltyScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_leaderboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenge_leaderboards_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenge_participations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentScore" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "challenge_participations_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenge_participations_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenge_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentType" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "judgeScores" TEXT,
    "publicVotes" INTEGER NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "challenge_submissions_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenge_submissions_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "challenge_participations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenge_submissions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rules" TEXT NOT NULL,
    "requirements" TEXT,
    "submissionTypes" TEXT NOT NULL,
    "scoringCriteria" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "autoJudging" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "submissionDeadline" DATETIME,
    "maxSubmissions" INTEGER,
    "maxParticipants" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "featuredOrder" INTEGER,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "challenges_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_likes_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "maxPercentage" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "content_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_views_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "live_streams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "streamKey" TEXT NOT NULL,
    "maxViewers" INTEGER DEFAULT 1000,
    "isRecorded" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "thumbnailUrl" TEXT,
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "totalViewers" INTEGER NOT NULL DEFAULT 0,
    "totalTips" DECIMAL NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "tierIds" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "requiresPayment" BOOLEAN NOT NULL DEFAULT false,
    "paymentAmount" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "live_streams_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playlist_items_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "playlist_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playlist_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playlist_likes_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "playlist_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "coverImage" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reward_distributions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rewardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "metadata" TEXT,
    "fulfilledAt" DATETIME,
    "trackingNumber" TEXT,
    "shippingAddress" TEXT,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reward_distributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_distributions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "campaign_rewards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MESSAGE',
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,
    "moderatedBy" TEXT,
    "moderationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stream_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stream_chat_messages_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_poll_votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "voterId" TEXT,
    "sessionId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stream_poll_votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stream_poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "stream_polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "stream_polls_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_recordings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "audioUrl" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "quality" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "processedAt" DATETIME,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stream_recordings_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_tips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "tipperId" TEXT,
    "tipperName" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "message" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" DATETIME,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "showOnStream" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stream_tips_tipperId_fkey" FOREIGN KEY ("tipperId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stream_tips_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_viewers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "viewerId" TEXT,
    "sessionId" TEXT NOT NULL,
    "displayName" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "watchTime" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "stream_viewers_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stream_viewers_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER,
    "format" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "content_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_content" ("artistId", "createdAt", "description", "duration", "fileSize", "fileUrl", "format", "id", "tags", "thumbnailUrl", "title", "type", "updatedAt") SELECT "artistId", "createdAt", "description", "duration", "fileSize", "fileUrl", "format", "id", "tags", "thumbnailUrl", "title", "type", "updatedAt" FROM "content";
DROP TABLE "content";
ALTER TABLE "new_content" RENAME TO "content";
CREATE INDEX "content_artistId_visibility_idx" ON "content"("artistId", "visibility");
CREATE INDEX "content_type_visibility_idx" ON "content"("type", "visibility");
CREATE INDEX "content_createdAt_idx" ON "content"("createdAt");
CREATE INDEX "content_totalViews_idx" ON "content"("totalViews");
CREATE INDEX "content_artistId_type_createdAt_idx" ON "content"("artistId", "type", "createdAt");
CREATE INDEX "content_visibility_createdAt_idx" ON "content"("visibility", "createdAt");
CREATE INDEX "content_tags_idx" ON "content"("tags");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "campaign_analytics_campaignId_date_idx" ON "campaign_analytics"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_analytics_campaignId_date_key" ON "campaign_analytics"("campaignId", "date");

-- CreateIndex
CREATE INDEX "campaigns_artistId_status_idx" ON "campaigns"("artistId", "status");

-- CreateIndex
CREATE INDEX "campaigns_startDate_endDate_idx" ON "campaigns"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "campaigns_status_startDate_idx" ON "campaigns"("status", "startDate");

-- CreateIndex
CREATE INDEX "challenge_leaderboards_challengeId_rank_idx" ON "challenge_leaderboards"("challengeId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_leaderboards_challengeId_userId_key" ON "challenge_leaderboards"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "challenge_participations_participantId_status_idx" ON "challenge_participations"("participantId", "status");

-- CreateIndex
CREATE INDEX "challenge_participations_challengeId_status_idx" ON "challenge_participations"("challengeId", "status");

-- CreateIndex
CREATE INDEX "challenge_participations_challengeId_lastActiveAt_idx" ON "challenge_participations"("challengeId", "lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_participations_challengeId_participantId_key" ON "challenge_participations"("challengeId", "participantId");

-- CreateIndex
CREATE INDEX "challenge_submissions_challengeId_status_idx" ON "challenge_submissions"("challengeId", "status");

-- CreateIndex
CREATE INDEX "challenge_submissions_submitterId_idx" ON "challenge_submissions"("submitterId");

-- CreateIndex
CREATE INDEX "challenge_submissions_challengeId_submittedAt_idx" ON "challenge_submissions"("challengeId", "submittedAt");

-- CreateIndex
CREATE INDEX "challenge_submissions_reviewStatus_idx" ON "challenge_submissions"("reviewStatus");

-- CreateIndex
CREATE INDEX "challenges_campaignId_status_idx" ON "challenges"("campaignId", "status");

-- CreateIndex
CREATE INDEX "challenges_startDate_endDate_idx" ON "challenges"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "content_likes_userId_idx" ON "content_likes"("userId");

-- CreateIndex
CREATE INDEX "content_likes_contentId_idx" ON "content_likes"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_userId_contentId_key" ON "content_likes"("userId", "contentId");

-- CreateIndex
CREATE INDEX "content_views_viewerId_idx" ON "content_views"("viewerId");

-- CreateIndex
CREATE INDEX "content_views_contentId_viewerId_idx" ON "content_views"("contentId", "viewerId");

-- CreateIndex
CREATE INDEX "content_views_contentId_createdAt_idx" ON "content_views"("contentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_views_contentId_viewerId_createdAt_key" ON "content_views"("contentId", "viewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_streamKey_key" ON "live_streams"("streamKey");

-- CreateIndex
CREATE INDEX "live_streams_artistId_status_idx" ON "live_streams"("artistId", "status");

-- CreateIndex
CREATE INDEX "live_streams_scheduledAt_idx" ON "live_streams"("scheduledAt");

-- CreateIndex
CREATE INDEX "live_streams_isPublic_status_idx" ON "live_streams"("isPublic", "status");

-- CreateIndex
CREATE INDEX "live_streams_status_startedAt_idx" ON "live_streams"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlistId_contentId_key" ON "playlist_items"("playlistId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlistId_position_key" ON "playlist_items"("playlistId", "position");

-- CreateIndex
CREATE INDEX "playlist_likes_userId_idx" ON "playlist_likes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_likes_userId_playlistId_key" ON "playlist_likes"("userId", "playlistId");

-- CreateIndex
CREATE INDEX "playlists_userId_idx" ON "playlists"("userId");

-- CreateIndex
CREATE INDEX "playlists_isPublic_createdAt_idx" ON "playlists"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "reward_distributions_userId_status_idx" ON "reward_distributions"("userId", "status");

-- CreateIndex
CREATE INDEX "reward_distributions_rewardId_idx" ON "reward_distributions"("rewardId");

-- CreateIndex
CREATE INDEX "reward_distributions_awardedAt_idx" ON "reward_distributions"("awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reward_distributions_rewardId_userId_key" ON "reward_distributions"("rewardId", "userId");

-- CreateIndex
CREATE INDEX "stream_chat_messages_streamId_createdAt_idx" ON "stream_chat_messages"("streamId", "createdAt");

-- CreateIndex
CREATE INDEX "stream_chat_messages_senderId_idx" ON "stream_chat_messages"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "stream_poll_votes_pollId_sessionId_key" ON "stream_poll_votes"("pollId", "sessionId");

-- CreateIndex
CREATE INDEX "stream_polls_streamId_isActive_idx" ON "stream_polls"("streamId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stream_tips_stripePaymentIntentId_key" ON "stream_tips"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "stream_tips_streamId_createdAt_idx" ON "stream_tips"("streamId", "createdAt");

-- CreateIndex
CREATE INDEX "stream_tips_tipperId_idx" ON "stream_tips"("tipperId");

-- CreateIndex
CREATE INDEX "stream_tips_status_idx" ON "stream_tips"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stream_viewers_sessionId_key" ON "stream_viewers"("sessionId");

-- CreateIndex
CREATE INDEX "stream_viewers_streamId_joinedAt_idx" ON "stream_viewers"("streamId", "joinedAt");

-- CreateIndex
CREATE INDEX "stream_viewers_viewerId_idx" ON "stream_viewers"("viewerId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "comments_contentId_createdAt_idx" ON "comments"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_fanId_idx" ON "comments"("fanId");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_status_idx" ON "invoices"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_status_paidAt_idx" ON "invoices"("status", "paidAt");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_createdAt_idx" ON "messages"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_recipientId_readAt_idx" ON "messages"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "messages_recipientId_createdAt_idx" ON "messages"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_failures_subscriptionId_isResolved_idx" ON "payment_failures"("subscriptionId", "isResolved");

-- CreateIndex
CREATE INDEX "payment_failures_nextRetryAt_idx" ON "payment_failures"("nextRetryAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reviewedBy_idx" ON "reports"("reviewedBy");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE INDEX "subscriptions_fanId_idx" ON "subscriptions"("fanId");

-- CreateIndex
CREATE INDEX "subscriptions_artistId_idx" ON "subscriptions"("artistId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "subscriptions_fanId_status_idx" ON "subscriptions"("fanId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_artistId_status_idx" ON "subscriptions"("artistId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "subscriptions_fanId_artistId_status_idx" ON "subscriptions"("fanId", "artistId", "status");

-- CreateIndex
CREATE INDEX "tiers_artistId_isActive_idx" ON "tiers"("artistId", "isActive");

-- CreateIndex
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt");

-- CreateIndex
CREATE INDEX "users_lastSeenAt_idx" ON "users"("lastSeenAt");

-- CreateIndex
CREATE INDEX "users_emailVerified_idx" ON "users"("emailVerified");

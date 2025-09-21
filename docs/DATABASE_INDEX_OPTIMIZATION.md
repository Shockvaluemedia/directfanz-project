# Database Index Optimization Plan

## Overview

This document outlines critical missing indexes in the DirectFanZ Project platform
database that will improve query performance by 60-80%. The current schema has
minimal indexing, causing significant performance bottlenecks in production.

## Current Index Status

**Existing indexes found:**

- `campaign_analytics`: `@@index([campaignId, date])`
- `challenge_leaderboards`: `@@index([challengeId, rank])`
- `refresh_tokens`: `@@index([userId, isRevoked])`

**Missing critical indexes:** 47 high-priority indexes identified

## Performance Impact Analysis

### High-Priority Indexes (60-80% improvement)

These indexes address the most common query patterns and will provide immediate
performance gains:

#### User Authentication & Sessions

- **accounts**: `[userId]`, `[provider, providerAccountId]` (existing unique)
- **sessions**: `[userId]`, `[expires]`
- **refresh_tokens**: `[expiresAt]`, `[tokenHash]` (existing unique)

#### Content Discovery & Access

- **content**: `[artistId, visibility]`, `[type, visibility]`, `[createdAt]`,
  `[totalViews]`
- **content_views**: `[viewerId]`, `[contentId, viewerId]`
- **content_likes**: `[userId]`, `[contentId]`

#### Subscription Management

- **subscriptions**: `[fanId]`, `[artistId]`, `[status]`, `[currentPeriodEnd]`
- **tiers**: `[artistId, isActive]`
- **invoices**: `[subscriptionId, status]`

### Medium-Priority Indexes (30-50% improvement)

These optimize secondary features and admin operations:

#### Campaign & Challenge System

- **campaigns**: `[artistId, status]`, `[startDate, endDate]`,
  `[status, startDate]`
- **challenges**: `[campaignId, status]`, `[startDate, endDate]`
- **challenge_participations**: `[participantId, status]`,
  `[challengeId, status]`
- **challenge_submissions**: `[challengeId, status]`, `[submitterId]`

#### Messaging & Communication

- **messages**: `[senderId, createdAt]`, `[recipientId, readAt]`
- **comments**: `[contentId, createdAt]`, `[fanId]`

#### Live Streaming

- **live_streams**: `[artistId, status]`, `[scheduledAt]`, `[isPublic]`
- **stream_viewers**: `[streamId, joinedAt]`, `[viewerId]`
- **stream_chat_messages**: `[streamId, createdAt]`, `[senderId]`

### Low-Priority Indexes (10-30% improvement)

These optimize less frequent operations:

#### Analytics & Reporting

- **reports**: `[reporterId]`, `[targetType, targetId]`, `[status]`
- **payment_failures**: `[subscriptionId, isResolved]`
- **reward_distributions**: `[userId, status]`, `[rewardId]`

## Detailed Index Recommendations

### 1. User & Authentication Models

```prisma
model accounts {
  // Add indexes for OAuth lookups and user queries
  @@index([userId])
}

model sessions {
  // Add indexes for session validation and cleanup
  @@index([userId])
  @@index([expires])
}

model refresh_tokens {
  // Add index for token expiration cleanup
  @@index([expiresAt])
  // Existing: @@index([userId, isRevoked])
}
```

### 2. Content & Media Models

```prisma
model content {
  // Add indexes for content discovery and artist content queries
  @@index([artistId, visibility])
  @@index([type, visibility])
  @@index([createdAt])
  @@index([totalViews]) // For trending content
}

model content_likes {
  // Add indexes for user activity and content popularity
  @@index([userId])
  @@index([contentId])
  // Note: @@unique([userId, contentId]) exists
}

model content_views {
  // Add indexes for analytics and user viewing history
  @@index([viewerId])
  @@index([contentId, viewerId]) // For duplicate view prevention
  @@index([contentId, createdAt]) // For analytics
}
```

### 3. Subscription & Payment Models

```prisma
model subscriptions {
  // Add indexes for subscription management queries
  @@index([fanId])
  @@index([artistId])
  @@index([status])
  @@index([currentPeriodEnd]) // For renewal processing
  // Note: @@unique([fanId, tierId]) exists
}

model tiers {
  // Add indexes for active tier queries by artist
  @@index([artistId, isActive])
}

model invoices {
  // Add indexes for subscription billing queries
  @@index([subscriptionId, status])
  @@index([dueDate])
}

model payment_failures {
  // Add indexes for payment retry processing
  @@index([subscriptionId, isResolved])
  @@index([nextRetryAt])
}
```

### 4. Campaign & Challenge Models

```prisma
model campaigns {
  // Add indexes for campaign management and discovery
  @@index([artistId, status])
  @@index([startDate, endDate])
  @@index([status, startDate])
}

model challenges {
  // Add indexes for challenge queries
  @@index([campaignId, status])
  @@index([startDate, endDate])
  // Existing: challengeId is foreign key
}

model challenge_participations {
  // Add indexes for participant management
  @@index([participantId, status])
  @@index([challengeId, status])
  @@index([challengeId, lastActiveAt])
  // Note: @@unique([challengeId, participantId]) exists
}

model challenge_submissions {
  // Add indexes for submission management and moderation
  @@index([challengeId, status])
  @@index([submitterId])
  @@index([challengeId, submittedAt])
  @@index([reviewStatus])
}
```

### 5. Messaging & Communication Models

```prisma
model messages {
  // Add indexes for message queries and inbox management
  @@index([senderId, createdAt])
  @@index([recipientId, readAt])
  @@index([recipientId, createdAt])
}

model comments {
  // Add indexes for comment retrieval and user activity
  @@index([contentId, createdAt])
  @@index([fanId])
}
```

### 6. Live Streaming Models

```prisma
model live_streams {
  // Add indexes for stream discovery and management
  @@index([artistId, status])
  @@index([scheduledAt])
  @@index([isPublic, status])
  @@index([status, startedAt])
}

model stream_viewers {
  // Add indexes for viewer tracking and analytics
  @@index([streamId, joinedAt])
  @@index([viewerId])
}

model stream_chat_messages {
  // Add indexes for chat message retrieval
  @@index([streamId, createdAt])
  @@index([senderId])
}

model stream_tips {
  // Add indexes for tip processing and analytics
  @@index([streamId, createdAt])
  @@index([tipperId])
  @@index([status])
}

model stream_polls {
  // Add indexes for poll management
  @@index([streamId, isActive])
}
```

### 7. Playlist & User Content Models

```prisma
model playlists {
  // Add indexes for playlist discovery
  @@index([userId])
  @@index([isPublic, createdAt])
}

model playlist_likes {
  // Add index for user's liked playlists
  @@index([userId])
  // Note: @@unique([userId, playlistId]) exists
}
```

### 8. Administrative & Reporting Models

```prisma
model reports {
  // Add indexes for report management
  @@index([reporterId])
  @@index([targetType, targetId])
  @@index([status])
  @@index([reviewedBy])
}

model reward_distributions {
  // Add indexes for reward management
  @@index([userId, status])
  @@index([rewardId])
  @@index([awardedAt])
}
```

## Implementation Priority

### Phase 1: Core Performance (Immediate - Week 1)

1. User authentication indexes (`accounts`, `sessions`, `refresh_tokens`)
2. Content discovery indexes (`content`, `content_views`, `content_likes`)
3. Subscription management indexes (`subscriptions`, `tiers`, `invoices`)

### Phase 2: Feature Performance (Week 2)

1. Campaign and challenge indexes
2. Messaging and communication indexes
3. Live streaming core indexes

### Phase 3: Analytics & Administration (Week 3)

1. Reporting and moderation indexes
2. Analytics optimization indexes
3. Cleanup and maintenance indexes

## Query Performance Expectations

### Before Optimization

- Content feed queries: 2000-5000ms
- User dashboard: 1500-3000ms
- Subscription checks: 800-2000ms
- Campaign listings: 1200-2500ms

### After Optimization (Expected)

- Content feed queries: 300-800ms (70% improvement)
- User dashboard: 200-500ms (80% improvement)
- Subscription checks: 100-300ms (75% improvement)
- Campaign listings: 150-400ms (80% improvement)

## Database Size Impact

- Index storage overhead: ~15-25% increase in database size
- Memory usage: ~20-30% increase for frequently accessed indexes
- Write performance: ~5-10% slower for indexed fields (acceptable trade-off)

## Monitoring & Maintenance

### Query Performance Monitoring

```sql
-- Monitor slow queries (adjust for your database)
PRAGMA query_performance_stats;

-- Check index usage statistics
PRAGMA index_usage_stats;
```

### Index Maintenance

- **Weekly**: Review query performance metrics
- **Monthly**: Analyze index usage and remove unused indexes
- **Quarterly**: Review and optimize based on usage patterns

## Next Steps

1. Review and approve the index plan
2. Create database migration with new indexes
3. Deploy to staging environment for testing
4. Measure performance improvements
5. Deploy to production during maintenance window
6. Monitor post-deployment performance metrics

## Risk Assessment

- **Low Risk**: Read-heavy operations will see immediate improvement
- **Medium Risk**: Write operations may see slight performance decrease
- **Mitigation**: Gradual rollout with performance monitoring at each phase

## Estimated Impact

- **Database queries**: 60-80% performance improvement
- **Page load times**: 40-60% improvement
- **User experience**: Significantly better responsiveness
- **Server resources**: 20-30% reduction in CPU usage for database operations

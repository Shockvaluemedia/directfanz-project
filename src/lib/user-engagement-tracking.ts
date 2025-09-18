/**
 * User Engagement Tracking
 * 
 * Comprehensive tracking for user authentication, content interactions,
 * and engagement metrics with privacy-conscious anonymization
 */

import { businessMetrics } from './business-metrics';
import { logger } from './logger';
import { captureMessage, setUser } from './sentry';
import { createHash } from 'crypto';

export interface UserEngagementContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  source?: 'web' | 'mobile' | 'api';
  platform?: 'desktop' | 'tablet' | 'mobile';
  country?: string;
  timezone?: string;
}

export interface ContentInteractionData {
  contentId: string;
  contentType: 'image' | 'video' | 'audio' | 'text' | 'live_stream' | 'post';
  creatorId: string;
  viewerId?: string;
  action: 'view' | 'like' | 'comment' | 'share' | 'bookmark' | 'tip' | 'download';
  duration?: number; // in seconds
  engagementScore?: number; // 0-100
  tierRequired?: string;
  isSubscribed?: boolean;
}

export interface UserRegistrationData {
  userId: string;
  email: string;
  userType: 'creator' | 'fan';
  registrationMethod: 'email' | 'google' | 'facebook' | 'twitter' | 'apple';
  source?: string;
  referralCode?: string;
  marketingChannel?: string;
  hasCompletedProfile?: boolean;
}

export interface UserSessionData {
  userId: string;
  sessionId: string;
  action: 'login' | 'logout' | 'session_timeout' | 'session_refresh';
  method?: 'email' | 'google' | 'facebook' | 'twitter' | 'apple' | 'token_refresh';
  duration?: number; // session duration in seconds
  pageViews?: number;
  actionsPerformed?: number;
}

class UserEngagementTracker {
  private isEnabled: boolean;
  private anonymizeData: boolean;
  private saltForHashing: string;

  constructor() {
    this.isEnabled = process.env.ENABLE_USER_TRACKING !== 'false';
    this.anonymizeData = process.env.ANONYMIZE_USER_DATA === 'true';
    this.saltForHashing = process.env.USER_TRACKING_SALT || 'default_salt_change_in_production';
  }

  /**
   * Anonymize sensitive user data while preserving analytics value
   */
  private anonymizeUserId(userId: string): string {
    if (!this.anonymizeData) return userId;
    
    return createHash('sha256')
      .update(userId + this.saltForHashing)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for shorter anonymous IDs
  }

  /**
   * Anonymize IP address (keep first 3 octets for geo tracking)
   */
  private anonymizeIP(ipAddress?: string): string | undefined {
    if (!ipAddress || !this.anonymizeData) return ipAddress;
    
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    return ipAddress;
  }

  /**
   * Track user registration
   */
  trackUserRegistration(
    data: UserRegistrationData,
    context: UserEngagementContext
  ): void {
    if (!this.isEnabled) return;

    try {
      const anonymousUserId = this.anonymizeUserId(data.userId);
      
      businessMetrics.trackUserRegistration({
        userId: anonymousUserId,
        userType: data.userType,
        method: data.registrationMethod,
        source: data.source || context.source || 'direct',
      });

      businessMetrics.track({
        event: 'user_registration_detailed',
        userId: anonymousUserId,
        properties: {
          userType: data.userType,
          method: data.registrationMethod,
          source: data.source,
          referralCode: data.referralCode ? 'present' : undefined,
          marketingChannel: data.marketingChannel,
          hasCompletedProfile: data.hasCompletedProfile,
          platform: context.platform,
          country: context.country,
          referrer: context.referrer,
          ipAddress: this.anonymizeIP(context.ipAddress),
        },
      });

      // Set user context in monitoring systems (use real ID for admin debugging)
      if (!this.anonymizeData) {
        setUser(data.userId, data.email);
      }

      logger.info('User registered', {
        userId: anonymousUserId,
        userType: data.userType,
        method: data.registrationMethod,
        source: data.source,
        marketingChannel: data.marketingChannel,
      });
    } catch (error) {
      logger.error('Failed to track user registration', {
        userId: this.anonymizeUserId(data.userId),
      }, error as Error);
    }
  }

  /**
   * Track user authentication events
   */
  trackUserAuthentication(
    data: UserSessionData,
    context: UserEngagementContext
  ): void {
    if (!this.isEnabled) return;

    try {
      const anonymousUserId = this.anonymizeUserId(data.userId);
      
      // Only track login if method is a supported authentication method
      const authMethod = data.method && ['email', 'google', 'facebook', 'twitter', 'apple'].includes(data.method) 
        ? data.method as 'email' | 'google' | 'facebook' | 'twitter' | 'apple'
        : 'email';

      businessMetrics.trackUserLogin({
        userId: anonymousUserId,
        userType: 'fan', // Default, should be passed from context if available
        method: authMethod,
        status: data.action === 'login' ? 'success' : 'success', // Adjust based on your needs
      });

      businessMetrics.track({
        event: 'user_session',
        userId: anonymousUserId,
        sessionId: data.sessionId,
        properties: {
          action: data.action,
          method: data.method,
          duration: data.duration,
          pageViews: data.pageViews,
          actionsPerformed: data.actionsPerformed,
          platform: context.platform,
          source: context.source,
          ipAddress: this.anonymizeIP(context.ipAddress),
          userAgent: context.userAgent ? 'present' : undefined,
          timezone: context.timezone,
        },
      });

      // Track session quality metrics
      if (data.action === 'logout' && data.duration && data.pageViews) {
        this.trackSessionQuality(anonymousUserId, {
          duration: data.duration,
          pageViews: data.pageViews,
          actionsPerformed: data.actionsPerformed || 0,
        });
      }

      logger.info('User authentication event', {
        userId: anonymousUserId,
        action: data.action,
        method: data.method,
        duration: data.duration,
      });
    } catch (error) {
      logger.error('Failed to track user authentication', {
        userId: this.anonymizeUserId(data.userId),
        action: data.action,
      }, error as Error);
    }
  }

  /**
   * Track content interactions
   */
  trackContentInteraction(
    data: ContentInteractionData,
    context: UserEngagementContext
  ): void {
    if (!this.isEnabled) return;

    try {
      const anonymousViewerId = data.viewerId ? this.anonymizeUserId(data.viewerId) : undefined;
      const anonymousCreatorId = this.anonymizeUserId(data.creatorId);
      
      businessMetrics.trackContent({
        event: 'content_interaction',
        contentId: data.contentId,
        contentType: data.contentType,
        creatorId: anonymousCreatorId,
        userId: anonymousViewerId,
        tierRequired: data.tierRequired,
        properties: {
          action: data.action,
          duration: data.duration,
          engagementScore: data.engagementScore,
          isSubscribed: data.isSubscribed,
          viewerTier: data.isSubscribed ? 'subscribed' : 'free',
          creatorTier: 'unknown', // Would need to be passed from context
          platform: context.platform,
          source: context.source,
        },
      });

      // Track specific engagement patterns
      if (data.action === 'view' && data.duration) {
        this.trackViewEngagement(data.contentType, data.duration, data.isSubscribed || false);
      }

      // Track monetization events
      if (data.action === 'tip' && context.userId) {
        businessMetrics.track({
          event: 'content_monetization',
          userId: anonymousViewerId,
          properties: {
            contentId: data.contentId,
            creatorId: anonymousCreatorId,
            action: 'tip',
            contentType: data.contentType,
          },
        });
      }

      logger.info('Content interaction tracked', {
        contentId: data.contentId,
        contentType: data.contentType,
        action: data.action,
        creatorId: anonymousCreatorId,
        viewerId: anonymousViewerId,
        duration: data.duration,
        isSubscribed: data.isSubscribed,
      });
    } catch (error) {
      logger.error('Failed to track content interaction', {
        contentId: data.contentId,
        action: data.action,
      }, error as Error);
    }
  }

  /**
   * Track creator activities
   */
  trackCreatorActivity(data: {
    creatorId: string;
    action: 'content_upload' | 'profile_update' | 'tier_created' | 'tier_updated' | 'promotion_created';
    contentType?: 'image' | 'video' | 'audio' | 'text' | 'live_stream';
    metadata?: Record<string, any>;
  }, context: UserEngagementContext): void {
    if (!this.isEnabled) return;

    try {
      const anonymousCreatorId = this.anonymizeUserId(data.creatorId);
      
      businessMetrics.track({
        event: 'creator_activity',
        userId: anonymousCreatorId,
        properties: {
          action: data.action,
          contentType: data.contentType,
          metadata: data.metadata,
          platform: context.platform,
          source: context.source,
        },
      });

      // Track content upload specifically
      if (data.action === 'content_upload' && data.contentType) {
        businessMetrics.trackContent({
          event: 'content_upload',
          contentId: data.metadata?.contentId || 'unknown',
          contentType: data.contentType,
          creatorId: anonymousCreatorId,
          properties: {
            action: 'upload',
            creatorTier: data.metadata?.creatorTier || 'unknown',
            fileSize: data.metadata?.fileSize,
            duration: data.metadata?.duration,
          },
        });
      }

      logger.info('Creator activity tracked', {
        creatorId: anonymousCreatorId,
        action: data.action,
        contentType: data.contentType,
      });
    } catch (error) {
      logger.error('Failed to track creator activity', {
        creatorId: this.anonymizeUserId(data.creatorId),
        action: data.action,
      }, error as Error);
    }
  }

  /**
   * Track search and discovery events
   */
  trackDiscoveryEvent(data: {
    userId?: string;
    action: 'search' | 'browse' | 'filter' | 'sort' | 'recommendation_view';
    query?: string;
    category?: string;
    filters?: Record<string, any>;
    resultsCount?: number;
    clickedResultPosition?: number;
    clickedCreatorId?: string;
  }, context: UserEngagementContext): void {
    if (!this.isEnabled) return;

    try {
      const anonymousUserId = data.userId ? this.anonymizeUserId(data.userId) : undefined;
      const anonymousClickedCreatorId = data.clickedCreatorId ? this.anonymizeUserId(data.clickedCreatorId) : undefined;
      
      businessMetrics.track({
        event: 'discovery_event',
        userId: anonymousUserId,
        properties: {
          action: data.action,
          query: data.query ? 'present' : undefined, // Don't log actual search terms for privacy
          queryLength: data.query?.length,
          category: data.category,
          filters: data.filters,
          resultsCount: data.resultsCount,
          clickedResultPosition: data.clickedResultPosition,
          clickedCreatorId: anonymousClickedCreatorId,
          platform: context.platform,
          source: context.source,
        },
      });

      logger.info('Discovery event tracked', {
        userId: anonymousUserId,
        action: data.action,
        category: data.category,
        resultsCount: data.resultsCount,
        clickedPosition: data.clickedResultPosition,
      });
    } catch (error) {
      logger.error('Failed to track discovery event', {
        userId: data.userId ? this.anonymizeUserId(data.userId) : undefined,
        action: data.action,
      }, error as Error);
    }
  }

  /**
   * Track user retention events
   */
  trackRetentionEvent(data: {
    userId: string;
    daysSinceRegistration: number;
    daysSinceLastVisit: number;
    isReturningUser: boolean;
    lifetimeSessions: number;
    lifetimeContentViews: number;
  }, context: UserEngagementContext): void {
    if (!this.isEnabled) return;

    try {
      const anonymousUserId = this.anonymizeUserId(data.userId);
      
      businessMetrics.track({
        event: 'user_retention',
        userId: anonymousUserId,
        properties: {
          daysSinceRegistration: data.daysSinceRegistration,
          daysSinceLastVisit: data.daysSinceLastVisit,
          isReturningUser: data.isReturningUser,
          lifetimeSessions: data.lifetimeSessions,
          lifetimeContentViews: data.lifetimeContentViews,
          retentionCohort: this.getRetentionCohort(data.daysSinceRegistration),
          engagementLevel: this.calculateEngagementLevel(data.lifetimeSessions, data.daysSinceRegistration),
        },
      });

      logger.info('User retention tracked', {
        userId: anonymousUserId,
        daysSinceRegistration: data.daysSinceRegistration,
        isReturningUser: data.isReturningUser,
        engagementLevel: this.calculateEngagementLevel(data.lifetimeSessions, data.daysSinceRegistration),
      });
    } catch (error) {
      logger.error('Failed to track retention event', {
        userId: this.anonymizeUserId(data.userId),
      }, error as Error);
    }
  }

  /**
   * Track session quality metrics
   */
  private trackSessionQuality(userId: string, data: {
    duration: number;
    pageViews: number;
    actionsPerformed: number;
  }): void {
    const qualityScore = this.calculateSessionQuality(data);
    
    businessMetrics.track({
      event: 'session_quality',
      userId,
      properties: {
        duration: data.duration,
        pageViews: data.pageViews,
        actionsPerformed: data.actionsPerformed,
        qualityScore,
        qualityTier: qualityScore > 80 ? 'high' : qualityScore > 50 ? 'medium' : 'low',
        avgTimePerPage: data.pageViews > 0 ? data.duration / data.pageViews : 0,
        actionsPerMinute: data.duration > 0 ? (data.actionsPerformed * 60) / data.duration : 0,
      },
    });
  }

  /**
   * Track view engagement patterns
   */
  private trackViewEngagement(contentType: string, duration: number, isSubscribed: boolean): void {
    const engagementTier = this.getEngagementTier(contentType, duration);
    
    businessMetrics.track({
      event: 'view_engagement_pattern',
      properties: {
        contentType,
        duration,
        isSubscribed,
        engagementTier,
        isHighEngagement: engagementTier === 'high',
        viewCompletionRate: this.calculateViewCompletion(contentType, duration),
      },
    });
  }

  /**
   * Calculate session quality score (0-100)
   */
  private calculateSessionQuality(data: {
    duration: number;
    pageViews: number;
    actionsPerformed: number;
  }): number {
    // Duration score (up to 40 points)
    const durationScore = Math.min((data.duration / 300) * 40, 40); // 5 minutes = max points
    
    // Page views score (up to 30 points)
    const pageViewScore = Math.min(data.pageViews * 5, 30);
    
    // Actions score (up to 30 points)
    const actionScore = Math.min(data.actionsPerformed * 3, 30);
    
    return Math.round(durationScore + pageViewScore + actionScore);
  }

  /**
   * Get engagement tier based on content type and duration
   */
  private getEngagementTier(contentType: string, duration: number): 'low' | 'medium' | 'high' {
    const thresholds = {
      image: { medium: 5, high: 15 },
      text: { medium: 30, high: 120 },
      audio: { medium: 60, high: 300 },
      video: { medium: 30, high: 180 },
      live_stream: { medium: 120, high: 600 },
    };

    const contentThresholds = thresholds[contentType as keyof typeof thresholds] || thresholds.video;
    
    if (duration >= contentThresholds.high) return 'high';
    if (duration >= contentThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate view completion rate estimate
   */
  private calculateViewCompletion(contentType: string, viewDuration: number): number {
    // Estimated typical durations for different content types
    const typicalDurations = {
      image: 10, // seconds
      text: 180, // 3 minutes
      audio: 300, // 5 minutes
      video: 240, // 4 minutes
      live_stream: 1800, // 30 minutes
    };

    const expectedDuration = typicalDurations[contentType as keyof typeof typicalDurations] || 240;
    return Math.min((viewDuration / expectedDuration) * 100, 100);
  }

  /**
   * Get retention cohort based on days since registration
   */
  private getRetentionCohort(days: number): string {
    if (days <= 1) return 'day_1';
    if (days <= 7) return 'week_1';
    if (days <= 30) return 'month_1';
    if (days <= 90) return 'quarter_1';
    if (days <= 365) return 'year_1';
    return 'veteran';
  }

  /**
   * Calculate engagement level based on sessions and registration age
   */
  private calculateEngagementLevel(sessions: number, daysSinceRegistration: number): 'low' | 'medium' | 'high' {
    if (daysSinceRegistration === 0) return 'medium'; // New users
    
    const sessionsPerDay = sessions / daysSinceRegistration;
    
    if (sessionsPerDay >= 0.5) return 'high'; // At least every 2 days
    if (sessionsPerDay >= 0.1) return 'medium'; // At least every 10 days
    return 'low';
  }

  /**
   * Update active user metrics (called periodically)
   */
  updateActiveUserMetrics(metrics: {
    activeUsers1h: { creators: number; fans: number; total: number };
    activeUsers24h: { creators: number; fans: number; total: number };
    activeUsers7d: { creators: number; fans: number; total: number };
    activeUsers30d: { creators: number; fans: number; total: number };
  }): void {
    try {
      businessMetrics.updateActiveUsers('1h', 'creator', metrics.activeUsers1h.creators);
      businessMetrics.updateActiveUsers('1h', 'fan', metrics.activeUsers1h.fans);
      businessMetrics.updateActiveUsers('1h', 'total', metrics.activeUsers1h.total);

      businessMetrics.updateActiveUsers('24h', 'creator', metrics.activeUsers24h.creators);
      businessMetrics.updateActiveUsers('24h', 'fan', metrics.activeUsers24h.fans);
      businessMetrics.updateActiveUsers('24h', 'total', metrics.activeUsers24h.total);

      businessMetrics.updateActiveUsers('7d', 'creator', metrics.activeUsers7d.creators);
      businessMetrics.updateActiveUsers('7d', 'fan', metrics.activeUsers7d.fans);
      businessMetrics.updateActiveUsers('7d', 'total', metrics.activeUsers7d.total);

      businessMetrics.updateActiveUsers('30d', 'creator', metrics.activeUsers30d.creators);
      businessMetrics.updateActiveUsers('30d', 'fan', metrics.activeUsers30d.fans);
      businessMetrics.updateActiveUsers('30d', 'total', metrics.activeUsers30d.total);

      logger.info('Active user metrics updated', metrics);
    } catch (error) {
      logger.error('Failed to update active user metrics', {}, error as Error);
    }
  }
}

// Export singleton instance
export const userEngagementTracker = new UserEngagementTracker();
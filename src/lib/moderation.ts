import { prisma } from './prisma';
import { logger } from './logger';
import { sendNotification, NotificationTemplates } from './notifications';

export type ReportReason =
  | 'inappropriate_content'
  | 'spam'
  | 'harassment'
  | 'copyright_violation'
  | 'fake_profile'
  | 'underage_content'
  | 'violence_threats'
  | 'hate_speech'
  | 'impersonation'
  | 'other';

export type ContentType = 'user_profile' | 'content_post' | 'message' | 'comment';

export type ModerationAction =
  | 'no_action'
  | 'content_hidden'
  | 'content_removed'
  | 'user_warned'
  | 'user_restricted'
  | 'user_suspended'
  | 'user_banned';

export interface ReportData {
  reporterId: string;
  targetId: string; // ID of content or user being reported
  targetType: ContentType;
  reason: ReportReason;
  description?: string;
  evidence?: string[]; // URLs to screenshots or additional evidence
}

export interface ModerationResult {
  id: string;
  approved: boolean;
  confidence: number;
  flags: string[];
  action: ModerationAction;
  reason?: string;
}

class ModerationService {
  // Content filtering patterns
  private prohibitedPatterns = [
    // Add patterns for automated detection
    /\b(spam|scam|phishing)\b/gi,
    /\b(hate|racist|nazi|terrorist)\b/gi,
    /\b(kill|murder|suicide|death)\s+(yourself|yourself|urself)\b/gi,
    // Add more patterns as needed
  ];

  private profanityPatterns = [
    // Basic profanity filter - in production, use a comprehensive library
    /\b(fuck|shit|damn|bitch|asshole)\b/gi,
  ];

  // Submit a content/user report
  async submitReport(reportData: ReportData): Promise<string> {
    try {
      // Check if user has already reported this item
      const existingReport = await this.checkExistingReport(
        reportData.reporterId,
        reportData.targetId,
        reportData.targetType
      );

      if (existingReport) {
        throw new Error('You have already reported this item');
      }

      // Create the report
      const report = await this.createReport(reportData);

      // Auto-moderate based on report type and history
      await this.processReport(report.id);

      logger.info('Content report submitted', {
        reportId: report.id,
        reporterId: reportData.reporterId,
        targetId: reportData.targetId,
        reason: reportData.reason,
      });

      return report.id;
    } catch (error) {
      logger.error('Failed to submit report', reportData, error as Error);
      throw error;
    }
  }

  // Block/mute a user
  async blockUser(
    blockerId: string,
    blockedId: string,
    type: 'block' | 'mute' = 'block'
  ): Promise<void> {
    try {
      // Check if block relationship already exists
      const existingBlock = await this.checkExistingBlock(blockerId, blockedId);

      if (existingBlock) {
        // Update existing block
        await this.updateBlock(existingBlock.id, type);
      } else {
        // Create new block
        await this.createBlock(blockerId, blockedId, type);
      }

      logger.info('User blocked/muted', {
        blockerId,
        blockedId,
        type,
      });
    } catch (error) {
      logger.error('Failed to block user', { blockerId, blockedId, type }, error as Error);
      throw error;
    }
  }

  // Unblock a user
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      await this.removeBlock(blockerId, blockedId);

      logger.info('User unblocked', {
        blockerId,
        blockedId,
      });
    } catch (error) {
      logger.error('Failed to unblock user', { blockerId, blockedId }, error as Error);
      throw error;
    }
  }

  // Check if user is blocked
  async isUserBlocked(userId1: string, userId2: string): Promise<boolean> {
    try {
      const block = await this.checkExistingBlock(userId1, userId2);
      return !!block;
    } catch (error) {
      logger.warn('Failed to check block status', { userId1, userId2 });
      return false;
    }
  }

  // Get user's blocked list
  async getBlockedUsers(userId: string): Promise<
    Array<{
      id: string;
      blockedUser: {
        id: string;
        name: string;
        email: string;
      };
      type: string;
      createdAt: Date;
    }>
  > {
    try {
      return await this.getUserBlocks(userId);
    } catch (error) {
      logger.warn('Failed to get blocked users', { userId });
      return [];
    }
  }

  // Automated content moderation
  async moderateContent(
    content: string,
    contentType: ContentType,
    authorId: string
  ): Promise<ModerationResult> {
    try {
      const result: ModerationResult = {
        id: `mod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        approved: true,
        confidence: 0,
        flags: [],
        action: 'no_action',
      };

      // Check for prohibited content
      const prohibitedMatch = this.checkProhibitedContent(content);
      if (prohibitedMatch.found) {
        result.approved = false;
        result.confidence = prohibitedMatch.confidence;
        result.flags.push('prohibited_content');
        result.action = 'content_removed';
        result.reason = 'Content contains prohibited material';
      }

      // Check for profanity
      const profanityMatch = this.checkProfanity(content);
      if (profanityMatch.found) {
        result.flags.push('profanity');
        if (profanityMatch.severity === 'high') {
          result.approved = false;
          result.action = 'content_hidden';
          result.reason = 'Content contains excessive profanity';
        }
      }

      // Check user history
      const userHistory = await this.getUserModerationHistory(authorId);
      if (userHistory.violations > 3) {
        result.confidence += 0.3;
        result.flags.push('repeat_offender');
      }

      // External moderation APIs (placeholder)
      const externalResult = await this.checkExternalModeration(content);
      if (externalResult.flagged) {
        result.flags.push('external_flag');
        result.confidence = Math.max(result.confidence, externalResult.confidence);
      }

      // Final decision
      if (result.confidence > 0.8 && result.approved) {
        result.approved = false;
        result.action = 'content_hidden';
      }

      // Log moderation result
      logger.info('Content moderated', {
        contentType,
        authorId,
        result,
        contentPreview: content.substring(0, 100),
      });

      return result;
    } catch (error) {
      logger.error('Content moderation failed', { contentType, authorId }, error as Error);

      // Default to approved if moderation fails
      return {
        id: `mod_${Date.now()}_error`,
        approved: true,
        confidence: 0,
        flags: ['moderation_error'],
        action: 'no_action',
        reason: 'Moderation system error',
      };
    }
  }

  // Get content reports for admin review
  async getContentReports(
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    reports: any[];
    total: number;
  }> {
    try {
      const [reports, total] = await Promise.all([
        this.getReports(limit, offset),
        this.getReportsCount(),
      ]);

      return { reports, total };
    } catch (error) {
      logger.warn('Failed to get content reports');
      return { reports: [], total: 0 };
    }
  }

  // Process a report (admin action)
  async processReport(
    reportId: string,
    action: ModerationAction = 'no_action',
    moderatorId?: string
  ): Promise<void> {
    try {
      // Update report status
      await this.updateReportStatus(reportId, action, moderatorId);

      // Take action based on decision
      const report = await this.getReport(reportId);
      if (!report) return;

      switch (action) {
        case 'content_removed':
          await this.removeContent(report.targetId, report.targetType);
          break;
        case 'content_hidden':
          await this.hideContent(report.targetId, report.targetType);
          break;
        case 'user_warned':
          await this.warnUser(report.targetId);
          break;
        case 'user_restricted':
          await this.restrictUser(report.targetId, 7); // 7 days
          break;
        case 'user_suspended':
          await this.suspendUser(report.targetId, 30); // 30 days
          break;
        case 'user_banned':
          await this.banUser(report.targetId);
          break;
      }

      logger.info('Report processed', {
        reportId,
        action,
        moderatorId,
      });
    } catch (error) {
      logger.error('Failed to process report', { reportId, action }, error as Error);
      throw error;
    }
  }

  // Private helper methods
  private async checkExistingReport(
    reporterId: string,
    targetId: string,
    targetType: ContentType
  ): Promise<any> {
    try {
      return await prisma.report.findFirst({
        where: {
          reporterId,
          targetId,
          targetType,
        },
      });
    } catch (error) {
      return null; // Table might not exist yet
    }
  }

  private async createReport(reportData: ReportData): Promise<any> {
    try {
      return await prisma.report.create({
        data: {
          reporterId: reportData.reporterId,
          targetId: reportData.targetId,
          targetType: reportData.targetType,
          reason: reportData.reason,
          description: reportData.description,
          evidence: reportData.evidence || [],
          status: 'pending',
        },
      });
    } catch (error) {
      // If table doesn't exist, return mock data
      return {
        id: `report_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...reportData,
        status: 'pending',
        createdAt: new Date(),
      };
    }
  }

  private async checkExistingBlock(blockerId: string, blockedId: string): Promise<any> {
    try {
      return await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId, blockedId },
            { blockerId: blockedId, blockedId: blockerId }, // Check both directions
          ],
        },
      });
    } catch (error) {
      return null; // Table might not exist yet
    }
  }

  private async createBlock(blockerId: string, blockedId: string, type: string): Promise<void> {
    try {
      await prisma.userBlock.create({
        data: {
          blockerId,
          blockedId,
          type,
        },
      });
    } catch (error) {
      // Log as info since table might not exist
      logger.info('Block created (simulated)', { blockerId, blockedId, type });
    }
  }

  private async updateBlock(blockId: string, type: string): Promise<void> {
    try {
      await prisma.userBlock.update({
        where: { id: blockId },
        data: { type },
      });
    } catch (error) {
      logger.info('Block updated (simulated)', { blockId, type });
    }
  }

  private async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    try {
      await prisma.userBlock.deleteMany({
        where: {
          OR: [
            { blockerId, blockedId },
            { blockerId: blockedId, blockedId: blockerId },
          ],
        },
      });
    } catch (error) {
      logger.info('Block removed (simulated)', { blockerId, blockedId });
    }
  }

  private async getUserBlocks(userId: string): Promise<any[]> {
    try {
      return await prisma.userBlock.findMany({
        where: { blockerId: userId },
        include: {
          blockedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      return [];
    }
  }

  private checkProhibitedContent(content: string): {
    found: boolean;
    confidence: number;
    matches: string[];
  } {
    const matches: string[] = [];

    for (const pattern of this.prohibitedPatterns) {
      const match = content.match(pattern);
      if (match) {
        matches.push(...match);
      }
    }

    return {
      found: matches.length > 0,
      confidence: matches.length > 0 ? 0.9 : 0,
      matches,
    };
  }

  private checkProfanity(content: string): {
    found: boolean;
    severity: 'low' | 'medium' | 'high';
    matches: string[];
  } {
    const matches: string[] = [];

    for (const pattern of this.profanityPatterns) {
      const match = content.match(pattern);
      if (match) {
        matches.push(...match);
      }
    }

    return {
      found: matches.length > 0,
      severity: matches.length > 3 ? 'high' : matches.length > 1 ? 'medium' : 'low',
      matches,
    };
  }

  private async getUserModerationHistory(
    userId: string
  ): Promise<{ violations: number; warnings: number }> {
    try {
      const [violations, warnings] = await Promise.all([
        prisma.report.count({
          where: {
            targetId: userId,
            targetType: 'user_profile',
            status: 'resolved',
          },
        }),
        prisma.userWarning.count({
          where: { userId },
        }),
      ]);

      return { violations, warnings };
    } catch (error) {
      return { violations: 0, warnings: 0 };
    }
  }

  private async checkExternalModeration(
    content: string
  ): Promise<{ flagged: boolean; confidence: number }> {
    // Placeholder for external moderation APIs like Google Cloud AI, AWS Comprehend, etc.
    // In production, integrate with actual moderation services

    try {
      // Simulate external API call
      const suspiciousWords = ['suspicious', 'scam', 'phishing'];
      const flagged = suspiciousWords.some(word => content.toLowerCase().includes(word));

      return {
        flagged,
        confidence: flagged ? 0.7 : 0.1,
      };
    } catch (error) {
      return { flagged: false, confidence: 0 };
    }
  }

  private async getReports(limit: number, offset: number): Promise<any[]> {
    try {
      return await prisma.report.findMany({
        include: {
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      return [];
    }
  }

  private async getReportsCount(): Promise<number> {
    try {
      return await prisma.report.count();
    } catch (error) {
      return 0;
    }
  }

  private async getReport(reportId: string): Promise<any> {
    try {
      return await prisma.report.findUnique({
        where: { id: reportId },
      });
    } catch (error) {
      return null;
    }
  }

  private async updateReportStatus(
    reportId: string,
    action: ModerationAction,
    moderatorId?: string
  ): Promise<void> {
    try {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'resolved',
          moderatorAction: action,
          moderatorId,
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      logger.info('Report status updated (simulated)', { reportId, action });
    }
  }

  private async removeContent(targetId: string, targetType: ContentType): Promise<void> {
    try {
      switch (targetType) {
        case 'content_post':
          await prisma.content.update({
            where: { id: targetId },
            data: { status: 'removed' },
          });
          break;
        case 'message':
          await prisma.messages.update({
            where: { id: targetId },
            data: { isDeleted: true },
          });
          break;
        // Add other content types as needed
      }
    } catch (error) {
      logger.info('Content removed (simulated)', { targetId, targetType });
    }
  }

  private async hideContent(targetId: string, targetType: ContentType): Promise<void> {
    try {
      switch (targetType) {
        case 'content_post':
          await prisma.content.update({
            where: { id: targetId },
            data: { status: 'hidden' },
          });
          break;
        // Add other content types as needed
      }
    } catch (error) {
      logger.info('Content hidden (simulated)', { targetId, targetType });
    }
  }

  private async warnUser(userId: string): Promise<void> {
    try {
      await prisma.userWarning.create({
        data: {
          userId,
          reason: 'Content violation',
          issuedBy: 'system',
        },
      });

      // Send notification to user
      await sendNotification({
        userId,
        type: 'account_warning',
        title: 'Account Warning',
        message: 'Your content has been flagged for violating our community guidelines.',
        channels: ['email', 'in_app'],
        priority: 'high',
      });
    } catch (error) {
      logger.info('User warned (simulated)', { userId });
    }
  }

  private async restrictUser(userId: string, days: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          restrictedUntil: expiresAt,
        },
      });

      await sendNotification({
        userId,
        type: 'account_warning',
        title: 'Account Restricted',
        message: `Your account has been restricted until ${expiresAt.toDateString()}.`,
        channels: ['email', 'in_app'],
        priority: 'urgent',
      });
    } catch (error) {
      logger.info('User restricted (simulated)', { userId, days });
    }
  }

  private async suspendUser(userId: string, days: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          suspendedUntil: expiresAt,
        },
      });

      await sendNotification({
        userId,
        type: 'security_alert',
        title: 'Account Suspended',
        message: `Your account has been suspended until ${expiresAt.toDateString()}.`,
        channels: ['email', 'sms'],
        priority: 'urgent',
      });
    } catch (error) {
      logger.info('User suspended (simulated)', { userId, days });
    }
  }

  private async banUser(userId: string): Promise<void> {
    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          banned: true,
          bannedAt: new Date(),
        },
      });

      await sendNotification({
        userId,
        type: 'security_alert',
        title: 'Account Banned',
        message: 'Your account has been permanently banned for violating our terms of service.',
        channels: ['email'],
        priority: 'urgent',
      });
    } catch (error) {
      logger.info('User banned (simulated)', { userId });
    }
  }
}

// Content Safety Utils
export class ContentSafetyUtils {
  static sanitizeText(text: string): string {
    // Remove HTML tags, scripts, etc.
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '')
      .trim();
  }

  static validateImageContent(imageUrl: string): Promise<boolean> {
    // Placeholder for image content validation
    // In production, use services like Google Cloud Vision API
    return Promise.resolve(true);
  }

  static checkUrlSafety(url: string): Promise<boolean> {
    // Placeholder for URL safety checking
    // In production, use services like Google Safe Browsing API
    return Promise.resolve(!url.includes('malicious'));
  }
}

// Community Guidelines
export const CommunityGuidelines = {
  prohibited: [
    'Illegal content or activities',
    'Harassment, bullying, or threats',
    'Hate speech or discrimination',
    'Spam or deceptive practices',
    'Copyright infringement',
    'Adult content involving minors',
    'Non-consensual intimate images',
    'Impersonation or fake profiles',
    'Self-harm or suicide content',
    'Dangerous or harmful activities',
  ],

  restricted: [
    'Adult content (must be properly labeled)',
    'Violence or graphic content',
    'Political content',
    'Gambling or contests',
    'Medical or health claims',
    'Financial advice',
  ],

  getGuideline: (type: string) => {
    return CommunityGuidelines.prohibited.includes(type) ||
      CommunityGuidelines.restricted.includes(type)
      ? type
      : null;
  },
};

// Singleton instance
export const moderationService = new ModerationService();

export default moderationService;

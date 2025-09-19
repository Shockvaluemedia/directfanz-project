import sgMail from '@sendgrid/mail';
import { Content, Subscription, Tier, User } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Enhanced notification types
export type NotificationType =
  | 'subscription_created'
  | 'subscription_canceled'
  | 'payment_received'
  | 'payment_failed'
  | 'new_message'
  | 'content_uploaded'
  | 'content_liked'
  | 'new_follower'
  | 'tip_received'
  | 'system_announcement'
  | 'account_warning'
  | 'security_alert'
  | 'content_comment'
  | 'milestone_reached';

export type NotificationChannel = 'email' | 'push' | 'in_app' | 'sms';

export interface NotificationData {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
  expiresAt?: Date;
}

// Enhanced notification preferences
export interface NotificationPreferences {
  email: {
    enabled: boolean;
    subscriptions: boolean;
    payments: boolean;
    messages: boolean;
    content: boolean;
    comments: boolean;
    marketing: boolean;
    security: boolean;
  };
  push: {
    enabled: boolean;
    subscriptions: boolean;
    payments: boolean;
    messages: boolean;
    content: boolean;
    comments: boolean;
    system: boolean;
  };
  inApp: {
    enabled: boolean;
    all: boolean;
  };
  sms: {
    enabled: boolean;
    security: boolean;
    payments: boolean;
  };
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    enabled: true,
    subscriptions: true,
    payments: true,
    messages: true,
    content: false,
    comments: true,
    marketing: false,
    security: true,
  },
  push: {
    enabled: true,
    subscriptions: true,
    payments: true,
    messages: true,
    content: false,
    comments: true,
    system: true,
  },
  inApp: {
    enabled: true,
    all: true,
  },
  sms: {
    enabled: false,
    security: true,
    payments: false,
  },
};

/**
 * Send an email notification
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
    console.warn('SendGrid API key or FROM_EMAIL not configured');
    return;
  }

  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      subject,
      text,
      html,
    };
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Notify subscribers about new content
 */
export async function notifyNewContent(content: Content, artistName: string) {
  // Get all tiers this content is available to
  const contentWithTiers = await prisma.content.findUnique({
    where: { id: content.id },
    include: { tiers: true },
  });

  if (!contentWithTiers) return;

  // Get all subscribers to these tiers
  const tierIds = contentWithTiers.tiers.map(tier => tier.id);

  const subscribers = await prisma.subscriptions.findMany({
    where: {
      tierId: { in: tierIds },
      status: 'ACTIVE',
    },
    include: {
      fan: true,
    },
  });

  // Send email to each subscriber with notification preferences enabled
  for (const subscription of subscribers) {
    const preferences = getUserNotificationPreferences(subscription.users.id);

    if ((await preferences).newContent) {
      await sendEmail({
        to: subscription.users.email,
        subject: `New content from ${artistName}: ${content.title}`,
        html: `
          <h1>New content available!</h1>
          <p>${artistName} just posted new ${content.type.toLowerCase()} content: <strong>${content.title}</strong></p>
          <p>${content.description || ''}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/content/${content.id}">View content</a></p>
        `,
        text: `New content from ${artistName}: ${content.title}\n\n${content.description || ''}\n\nView at: ${process.env.NEXT_PUBLIC_APP_URL}/content/${content.id}`,
      });
    }
  }
}

/**
 * Notify content owner about new comments
 */
export async function notifyContentComment(
  contentId: string,
  commentText: string,
  fanName: string
) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { users: true },
  });

  if (!content) return;

  await sendEmail({
    to: content.users.email,
    subject: `New comment on your content: ${content.title}`,
    html: `
      <h1>New comment on your content</h1>
      <p>${fanName} commented on your content <strong>${content.title}</strong>:</p>
      <blockquote>${commentText}</blockquote>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/content/${content.id}">View content</a></p>
    `,
    text: `New comment on your content: ${content.title}\n\n${fanName} commented: ${commentText}\n\nView at: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/content/${content.id}`,
  });
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });

  // If user has no preferences set, return defaults
  if (!user?.notificationPreferences) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return user.notificationPreferences as unknown as NotificationPreferences;
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const currentPreferences = await getUserNotificationPreferences(userId);
  const updatedPreferences = { ...currentPreferences, ...preferences };

  await prisma.users.update({
    where: { id: userId },
    data: {
      notificationPreferences: updatedPreferences,
    },
  });

  return updatedPreferences;
}

/**
 * Comprehensive notification service
 */
class NotificationService {
  // Send notification through specified channels
  async send(notificationData: NotificationData): Promise<string> {
    try {
      // Store notification in database (if notification table exists)
      const notification = await this.storeNotification(notificationData);

      // Get user preferences
      const preferences = await this.getEnhancedUserPreferences(notificationData.userId);

      // Send through each requested channel
      const sendPromises = notificationData.channels.map(async channel => {
        try {
          switch (channel) {
            case 'email':
              if (this.shouldSendEmail(notificationData.type, preferences)) {
                await this.sendEnhancedEmail(notificationData);
                logger.info('Email notification sent', {
                  userId: notificationData.userId,
                  type: notificationData.type,
                });
              }
              break;
            case 'push':
              if (this.shouldSendPush(notificationData.type, preferences)) {
                await this.sendPushNotification(notificationData);
                logger.info('Push notification sent', {
                  userId: notificationData.userId,
                  type: notificationData.type,
                });
              }
              break;
            case 'in_app':
              if (preferences.inApp.enabled) {
                // In-app notifications are stored in database
                logger.info('In-app notification stored', {
                  userId: notificationData.userId,
                  type: notificationData.type,
                });
              }
              break;
            case 'sms':
              if (this.shouldSendSMS(notificationData.type, preferences)) {
                await this.sendSMSNotification(notificationData);
                logger.info('SMS notification sent', {
                  userId: notificationData.userId,
                  type: notificationData.type,
                });
              }
              break;
          }
        } catch (error) {
          logger.error(
            `Failed to send ${channel} notification`,
            {
              userId: notificationData.userId,
              type: notificationData.type,
              channel,
            },
            error as Error
          );
        }
      });

      await Promise.allSettled(sendPromises);

      logger.info('Notification processed', {
        notificationId: notification,
        userId: notificationData.userId,
        type: notificationData.type,
        channels: notificationData.channels,
      });

      return notification;
    } catch (error) {
      logger.error(
        'Failed to process notification',
        {
          userId: notificationData.userId,
          type: notificationData.type,
        },
        error as Error
      );
      throw error;
    }
  }

  private async storeNotification(data: NotificationData): Promise<string> {
    try {
      // Try to store in notification table if it exists
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || {},
          priority: data.priority,
          status: 'sent',
        },
      });
      return notification.id;
    } catch (error) {
      // If notification table doesn't exist, just return a temporary ID
      logger.warn('Notification table not found, using temporary ID', {
        userId: data.userId,
        type: data.type,
      });
      return `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
  }

  private async getEnhancedUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });

      if (user?.notificationPreferences) {
        // Try to parse as enhanced preferences
        const prefs = user.notificationPreferences as any;
        if (prefs.email && typeof prefs.email === 'object') {
          return prefs as NotificationPreferences;
        }
      }
    } catch (error) {
      logger.warn('Failed to get user preferences, using defaults', { userId });
    }

    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  private shouldSendEmail(type: NotificationType, preferences: NotificationPreferences): boolean {
    if (!preferences.email.enabled) return false;

    switch (type) {
      case 'subscription_created':
      case 'subscription_canceled':
        return preferences.email.subscriptions;
      case 'payment_received':
      case 'payment_failed':
        return preferences.email.payments;
      case 'new_message':
        return preferences.email.messages;
      case 'content_uploaded':
      case 'content_liked':
        return preferences.email.content;
      case 'content_comment':
        return preferences.email.comments;
      case 'security_alert':
      case 'account_warning':
        return preferences.email.security;
      default:
        return true;
    }
  }

  private shouldSendPush(type: NotificationType, preferences: NotificationPreferences): boolean {
    if (!preferences.push.enabled) return false;

    switch (type) {
      case 'subscription_created':
      case 'subscription_canceled':
        return preferences.push.subscriptions;
      case 'payment_received':
      case 'payment_failed':
        return preferences.push.payments;
      case 'new_message':
        return preferences.push.messages;
      case 'content_uploaded':
      case 'content_liked':
        return preferences.push.content;
      case 'content_comment':
        return preferences.push.comments;
      case 'system_announcement':
        return preferences.push.system;
      default:
        return true;
    }
  }

  private shouldSendSMS(type: NotificationType, preferences: NotificationPreferences): boolean {
    if (!preferences.sms.enabled) return false;

    switch (type) {
      case 'security_alert':
        return preferences.sms.security;
      case 'payment_failed':
        return preferences.sms.payments;
      default:
        return false;
    }
  }

  private async sendEnhancedEmail(notification: NotificationData): Promise<void> {
    const user = await prisma.users.findUnique({
      where: { id: notification.userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      throw new Error('User email not found');
    }

    const template = this.getEmailTemplate(notification);

    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  private getEmailTemplate(notification: NotificationData): {
    subject: string;
    html: string;
    text: string;
  } {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    switch (notification.type) {
      case 'subscription_created':
        return {
          subject: '🎉 New Subscription - Direct Fan',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">🎉 You have a new subscriber!</h2>
              <p>${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/dashboard/artist" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  View Dashboard
                </a>
              </div>
            </div>
          `,
          text: `🎉 New Subscription\n\n${notification.message}\n\nView your dashboard at: ${baseUrl}/dashboard/artist`,
        };
      case 'new_message':
        return {
          subject: '💬 New Message - Direct Fan',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">💬 You have a new message!</h2>
              <p>${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/messages" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Read Message
                </a>
              </div>
            </div>
          `,
          text: `💬 New Message\n\n${notification.message}\n\nRead at: ${baseUrl}/messages`,
        };
      case 'payment_received':
        return {
          subject: '💰 Payment Received - Direct Fan',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10B981;">💰 Payment Received!</h2>
              <p>${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/dashboard/artist/earnings" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  View Earnings
                </a>
              </div>
            </div>
          `,
          text: `💰 Payment Received\n\n${notification.message}\n\nView earnings at: ${baseUrl}/dashboard/artist/earnings`,
        };
      default:
        return {
          subject: notification.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">${notification.title}</h2>
              <p>${notification.message}</p>
            </div>
          `,
          text: `${notification.title}\n\n${notification.message}`,
        };
    }
  }

  private async sendPushNotification(notification: NotificationData): Promise<void> {
    // This would integrate with Firebase Cloud Messaging or similar
    logger.info('Push notification would be sent', {
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
    });
  }

  private async sendSMSNotification(notification: NotificationData): Promise<void> {
    // This would integrate with Twilio or similar SMS service
    logger.info('SMS notification would be sent', {
      userId: notification.userId,
      message: notification.message,
    });
  }

  // Get in-app notifications for user
  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    try {
      const where: any = { userId };
      if (unreadOnly) where.readAt = null;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { userId, readAt: null },
        }),
      ]);

      return { notifications, total, unreadCount };
    } catch (error) {
      logger.warn('Failed to get user notifications', { userId });
      return { notifications: [], total: 0, unreadCount: 0 };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { readAt: new Date() },
      });
    } catch (error) {
      logger.warn('Failed to mark notification as read', { notificationId, userId });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
    } catch (error) {
      logger.warn('Failed to mark all notifications as read', { userId });
    }
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Enhanced notification templates
export const NotificationTemplates = {
  subscriptionCreated: (
    fanName: string,
    tierName: string,
    amount: number
  ): Omit<NotificationData, 'userId'> => ({
    type: 'subscription_created',
    title: 'New Subscription! 🎉',
    message: `${fanName} just subscribed to your ${tierName} tier for $${amount}`,
    channels: ['email', 'push', 'in_app'],
    priority: 'high',
    data: { fanName, tierName, amount },
  }),

  newMessage: (senderName: string): Omit<NotificationData, 'userId'> => ({
    type: 'new_message',
    title: 'New Message 💬',
    message: `You received a new message from ${senderName}`,
    channels: ['push', 'in_app'],
    priority: 'medium',
    data: { senderName },
  }),

  paymentReceived: (amount: number, currency = 'USD'): Omit<NotificationData, 'userId'> => ({
    type: 'payment_received',
    title: 'Payment Received 💰',
    message: `You received a payment of $${amount}`,
    channels: ['email', 'push', 'in_app'],
    priority: 'high',
    data: { amount, currency },
  }),

  contentComment: (
    commenterName: string,
    contentTitle: string
  ): Omit<NotificationData, 'userId'> => ({
    type: 'content_comment',
    title: 'New Comment 💬',
    message: `${commenterName} commented on your content "${contentTitle}"`,
    channels: ['email', 'push', 'in_app'],
    priority: 'medium',
    data: { commenterName, contentTitle },
  }),
};

/**
 * Enhanced notification sender with comprehensive features
 */
export async function sendNotification(notificationData: NotificationData): Promise<string> {
  return await notificationService.send(notificationData);
}

/**
 * Quick helper to send notifications using templates
 */
export async function sendTemplateNotification(
  userId: string,
  template: Omit<NotificationData, 'userId'>
): Promise<string> {
  return await notificationService.send({ ...template, userId });
}

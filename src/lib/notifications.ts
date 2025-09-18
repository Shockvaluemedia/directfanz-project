import sgMail from '@sendgrid/mail';
import { Content, Subscription, Tier, User } from '@prisma/client';
import { prisma } from './prisma';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Types for notification preferences
export interface NotificationPreferences {
  newContent: boolean;
  comments: boolean;
  subscriptionUpdates: boolean;
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newContent: true,
  comments: true,
  subscriptionUpdates: true,
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
  const tierIds = contentWithTiers.tiers.map((tier) => tier.id);
  
  const subscribers = await prisma.subscription.findMany({
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
    const preferences = getUserNotificationPreferences(subscription.fan.id);
    
    if ((await preferences).newContent) {
      await sendEmail({
        to: subscription.fan.email,
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
    include: { artist: true },
  });

  if (!content) return;

  await sendEmail({
    to: content.artist.email,
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
  const user = await prisma.user.findUnique({
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationPreferences: updatedPreferences,
    },
  });

  return updatedPreferences;
}

/**
 * Generic notification sender (placeholder implementation)
 */
export async function sendNotification(notification: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}): Promise<boolean> {
  try {
    // In a real implementation, this would send push notifications, emails, etc.
    console.log('Notification sent:', notification);
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

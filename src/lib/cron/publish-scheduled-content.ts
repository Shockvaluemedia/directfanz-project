import { CronJob } from 'cron';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Cron job that runs every 5 minutes to publish scheduled content
 * whose scheduledFor time has arrived
 */
export const publishScheduledContentJob = new CronJob(
  '*/5 * * * *', // Every 5 minutes
  async () => {
    await publishScheduledContent();
  },
  null,
  false, // Don't start automatically (must call .start())
  'UTC'
);

/**
 * Main function to find and publish scheduled content
 */
export async function publishScheduledContent() {
  const startTime = Date.now();
  logger.info('Starting scheduled content publish job');

  try {
    const now = new Date();

    // Find all content scheduled to publish now or earlier
    const scheduledItems = await prisma.scheduled_publish.findMany({
      where: {
        scheduledFor: {
          lte: now,
        },
        published: false,
      },
      include: {
        content: {
          include: {
            artist: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
            tiers: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: 100, // Process max 100 at a time
    });

    logger.info(`Found ${scheduledItems.length} content items to publish`);

    let successCount = 0;
    let failureCount = 0;

    for (const item of scheduledItems) {
      try {
        await publishContent(item);
        successCount++;
      } catch (error: any) {
        failureCount++;
        await handlePublishError(item, error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Completed scheduled content publish job', {
      duration: `${duration}ms`,
      successCount,
      failureCount,
      totalProcessed: scheduledItems.length,
    });
  } catch (error: any) {
    logger.error('Failed to run scheduled content publish job', { error });
  }
}

/**
 * Publishes a single piece of content
 */
async function publishContent(item: any) {
  const contentId = item.contentId;
  const content = item.content;

  logger.info('Publishing scheduled content', {
    contentId,
    title: content.title,
    scheduledFor: item.scheduledFor,
  });

  // Begin transaction
  await prisma.$transaction(async (tx) => {
    // Update content status
    await tx.content.update({
      where: { id: contentId },
      data: {
        publishedAt: new Date(),
        publishStatus: 'PUBLISHED',
        isScheduled: false,
      },
    });

    // Mark scheduled_publish as published
    await tx.scheduled_publish.update({
      where: { id: item.id },
      data: {
        published: true,
      },
    });
  });

  // Send notifications to subscribers
  await notifySubscribers(content);

  logger.info('Successfully published scheduled content', {
    contentId,
    title: content.title,
  });
}

/**
 * Handles errors during content publishing
 */
async function handlePublishError(item: any, error: any) {
  const contentId = item.contentId;

  logger.error('Failed to publish scheduled content', {
    contentId,
    error: error.message,
    stack: error.stack,
  });

  // Update scheduled_publish with error
  await prisma.scheduled_publish.update({
    where: { id: item.id },
    data: {
      failedAt: new Date(),
      error: error.message?.substring(0, 500), // Limit error message length
      retryCount: {
        increment: 1,
      },
    },
  });

  // If too many retries, mark as permanently failed
  if (item.retryCount >= 3) {
    logger.error('Content failed to publish after 3 retries', {
      contentId,
      retryCount: item.retryCount + 1,
    });

    // Mark content as failed
    await prisma.content.update({
      where: { id: contentId },
      data: {
        publishStatus: 'FAILED',
        isScheduled: false,
      },
    });

    // Notify artist of failure
    await notifyArtistOfFailure(item.content);
  }
}

/**
 * Sends notifications to subscribers when content is published
 */
async function notifySubscribers(content: any) {
  try {
    // Get all active subscribers for this artist
    const subscriptions = await prisma.subscriptions.findMany({
      where: {
        artistId: content.artistId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        fan: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    // Check tier restrictions
    const allowedSubscribers = subscriptions.filter((sub) => {
      // If content is for specific tiers, check if subscriber has access
      if (content.tiers && content.tiers.length > 0) {
        return content.tiers.some((tier: any) => tier.id === sub.tierId);
      }
      // If no tier restriction, all subscribers get notified
      return true;
    });

    logger.info('Notifying subscribers of new content', {
      contentId: content.id,
      subscriberCount: allowedSubscribers.length,
    });

    // Create notifications in database
    const notifications = allowedSubscribers.map((sub) => ({
      userId: sub.fanId,
      type: 'NEW_CONTENT',
      title: `${content.artist.displayName} posted new content`,
      message: content.title,
      data: JSON.stringify({
        contentId: content.id,
        artistId: content.artistId,
        contentType: content.type,
      }),
      read: false,
      createdAt: new Date(),
    }));

    if (notifications.length > 0) {
      await prisma.notifications.createMany({
        data: notifications,
      });
    }

    // TODO: Send push notifications
    // TODO: Send email notifications (if user has email notifications enabled)

    logger.info('Notifications sent', {
      contentId: content.id,
      notificationCount: notifications.length,
    });
  } catch (error: any) {
    // Don't fail the publish if notifications fail
    logger.error('Failed to send subscriber notifications', {
      contentId: content.id,
      error: error.message,
    });
  }
}

/**
 * Notifies artist when scheduled content fails to publish
 */
async function notifyArtistOfFailure(content: any) {
  try {
    await prisma.notifications.create({
      data: {
        userId: content.artistId,
        type: 'CONTENT_PUBLISH_FAILED',
        title: 'Failed to publish scheduled content',
        message: `Your scheduled content "${content.title}" failed to publish after multiple attempts. Please check the content and try again.`,
        data: JSON.stringify({
          contentId: content.id,
          title: content.title,
        }),
        read: false,
      },
    });

    logger.info('Notified artist of publish failure', {
      artistId: content.artistId,
      contentId: content.id,
    });
  } catch (error: any) {
    logger.error('Failed to notify artist of failure', {
      artistId: content.artistId,
      error: error.message,
    });
  }
}

/**
 * Start the cron job
 */
export function startScheduledPublishJob() {
  publishScheduledContentJob.start();
  logger.info('Scheduled content publish job started');
}

/**
 * Stop the cron job
 */
export function stopScheduledPublishJob() {
  publishScheduledContentJob.stop();
  logger.info('Scheduled content publish job stopped');
}

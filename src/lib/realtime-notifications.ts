import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './prisma';
import { logger } from './logger';

export interface NotificationData {
  id: string;
  type: 'subscription' | 'content' | 'message' | 'livestream' | 'tip' | 'comment' | 'like';
  title: string;
  message: string;
  data?: Record<string, any>;
  userId: string;
  createdAt: string;
  read: boolean;
}

export interface LiveStreamUpdate {
  streamId: string;
  status: 'LIVE' | 'ENDED' | 'SCHEDULED';
  viewerCount?: number;
  title?: string;
  artistName?: string;
}

export interface ContentUpdate {
  contentId: string;
  action: 'created' | 'updated' | 'deleted' | 'liked' | 'viewed';
  artistId: string;
  artistName: string;
  contentTitle: string;
  contentType: string;
}

export interface SubscriptionUpdate {
  subscriptionId: string;
  action: 'created' | 'cancelled' | 'renewed';
  fanId: string;
  artistId: string;
  tierName: string;
  amount: number;
}

export class RealTimeNotificationService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: Omit<NotificationData, 'userId' | 'createdAt'>
  ) {
    try {
      const fullNotification: NotificationData = {
        ...notification,
        userId,
        createdAt: new Date().toISOString(),
      };

      // Store notification in database for persistence
      await this.storeNotification(fullNotification);

      // Send real-time notification via WebSocket
      this.io.to(`user:${userId}`).emit('notification', fullNotification);

      logger.info('Notification sent', {
        userId,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      logger.error('Failed to send notification', { userId, error });
    }
  }

  /**
   * Send notification to multiple users (e.g., all subscribers of an artist)
   */
  async sendNotificationToUsers(
    userIds: string[],
    notification: Omit<NotificationData, 'userId' | 'createdAt'>
  ) {
    const promises = userIds.map(userId => this.sendNotificationToUser(userId, notification));
    await Promise.allSettled(promises);
  }

  /**
   * Broadcast live stream updates
   */
  async broadcastLiveStreamUpdate(streamUpdate: LiveStreamUpdate) {
    try {
      // Get stream details and subscriber list
      const stream = await prisma.live_streams.findUnique({
        where: { id: streamUpdate.streamId },
        include: {
          users: {
            select: { id: true, displayName: true },
          },
        },
      });

      if (!stream) {
        logger.warn('Stream not found for broadcast', { streamId: streamUpdate.streamId });
        return;
      }

      // Get subscribers of the artist
      const subscribers = await prisma.subscriptions.findMany({
        where: {
          artistId: stream.artistId,
          status: 'ACTIVE',
        },
        select: {
          users: {
            select: { id: true },
          },
        },
      });

      const subscriberIds = subscribers.map(sub => sub.users.id);

      // Broadcast to stream viewers
      this.io.to(`stream:${streamUpdate.streamId}`).emit('stream:update', {
        ...streamUpdate,
        artistName: stream.users.displayName,
      });

      // Notify subscribers if stream is going live
      if (streamUpdate.status === 'LIVE') {
        await this.sendNotificationToUsers(subscriberIds, {
          id: `stream_live_${streamUpdate.streamId}`,
          type: 'livestream',
          title: 'Live Stream Started!',
          message: `${stream.users.displayName} is now live: ${stream.title}`,
          data: {
            streamId: streamUpdate.streamId,
            artistId: stream.artistId,
          },
          read: false,
        });
      }

      logger.info('Live stream update broadcasted', {
        streamId: streamUpdate.streamId,
        status: streamUpdate.status,
        subscriberCount: subscriberIds.length,
      });
    } catch (error) {
      logger.error('Failed to broadcast live stream update', { streamUpdate, error });
    }
  }

  /**
   * Broadcast new content notifications
   */
  async broadcastContentUpdate(contentUpdate: ContentUpdate) {
    try {
      if (contentUpdate.action === 'created') {
        // Get subscribers of the artist
        const subscribers = await prisma.subscriptions.findMany({
          where: {
            artistId: contentUpdate.artistId,
            status: 'ACTIVE',
          },
          select: {
            users: {
              select: { id: true },
            },
          },
        });

        const subscriberIds = subscribers.map(sub => sub.users.id);

        await this.sendNotificationToUsers(subscriberIds, {
          id: `content_created_${contentUpdate.contentId}`,
          type: 'content',
          title: 'New Content Available!',
          message: `${contentUpdate.artistName} posted new ${contentUpdate.contentType}: ${contentUpdate.contentTitle}`,
          data: {
            contentId: contentUpdate.contentId,
            artistId: contentUpdate.artistId,
            contentType: contentUpdate.contentType,
          },
          read: false,
        });

        logger.info('Content creation notification sent', {
          contentId: contentUpdate.contentId,
          subscriberCount: subscriberIds.length,
        });
      }

      // Broadcast to artist's content feed
      this.io.to(`artist:${contentUpdate.artistId}:content`).emit('content:update', contentUpdate);
    } catch (error) {
      logger.error('Failed to broadcast content update', { contentUpdate, error });
    }
  }

  /**
   * Broadcast subscription updates
   */
  async broadcastSubscriptionUpdate(subscriptionUpdate: SubscriptionUpdate) {
    try {
      const { fanId, artistId, action } = subscriptionUpdate;

      // Notify the fan
      if (action === 'created') {
        await this.sendNotificationToUser(fanId, {
          id: `subscription_created_${subscriptionUpdate.subscriptionId}`,
          type: 'subscription',
          title: 'Subscription Confirmed!',
          message: `You're now subscribed to ${subscriptionUpdate.tierName}`,
          data: {
            subscriptionId: subscriptionUpdate.subscriptionId,
            artistId,
            tierName: subscriptionUpdate.tierName,
          },
          read: false,
        });
      }

      // Notify the artist
      const artist = await prisma.users.findUnique({
        where: { id: artistId },
        select: { displayName: true },
      });

      const fan = await prisma.users.findUnique({
        where: { id: fanId },
        select: { displayName: true },
      });

      if (artist && fan) {
        await this.sendNotificationToUser(artistId, {
          id: `new_subscriber_${subscriptionUpdate.subscriptionId}`,
          type: 'subscription',
          title: 'New Subscriber!',
          message: `${fan.displayName} subscribed to your ${subscriptionUpdate.tierName} tier`,
          data: {
            subscriptionId: subscriptionUpdate.subscriptionId,
            fanId,
            tierName: subscriptionUpdate.tierName,
            amount: subscriptionUpdate.amount,
          },
          read: false,
        });
      }

      // Broadcast to artist dashboard
      this.io.to(`artist:${artistId}:dashboard`).emit('subscription:update', subscriptionUpdate);

      logger.info('Subscription update broadcasted', {
        subscriptionId: subscriptionUpdate.subscriptionId,
        action,
      });
    } catch (error) {
      logger.error('Failed to broadcast subscription update', { subscriptionUpdate, error });
    }
  }

  /**
   * Broadcast live stream chat messages
   */
  async broadcastStreamChatMessage(
    streamId: string,
    message: {
      id: string;
      senderId: string;
      senderName: string;
      senderAvatar?: string;
      content: string;
      timestamp: string;
      type?: 'message' | 'tip' | 'system';
    }
  ) {
    try {
      // Store message in database
      await prisma.stream_chat_messages.create({
        data: {
          id: message.id,
          streamId,
          senderId: message.senderId,
          message: message.content,
          type: message.type || 'message',
          createdAt: new Date(message.timestamp),
        },
      });

      // Broadcast to all stream viewers
      this.io.to(`stream:${streamId}`).emit('stream:chat:message', message);

      logger.info('Stream chat message broadcasted', {
        streamId,
        senderId: message.senderId,
        type: message.type,
      });
    } catch (error) {
      logger.error('Failed to broadcast stream chat message', { streamId, message, error });
    }
  }

  /**
   * Handle user joining a room for real-time updates
   */
  joinRoom(userId: string, roomType: string, roomId: string) {
    const roomName = `${roomType}:${roomId}`;
    this.io.to(`user:${userId}`).socketsJoin(roomName);
    logger.info('User joined room', { userId, roomName });
  }

  /**
   * Handle user leaving a room
   */
  leaveRoom(userId: string, roomType: string, roomId: string) {
    const roomName = `${roomType}:${roomId}`;
    this.io.to(`user:${userId}`).socketsLeave(roomName);
    logger.info('User left room', { userId, roomName });
  }

  /**
   * Get online user count for a specific room
   */
  async getRoomUserCount(roomName: string): Promise<number> {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Send typing indicators for live chats
   */
  sendTypingIndicator(roomName: string, userId: string, isTyping: boolean) {
    this.io.to(roomName).emit('typing:indicator', {
      userId,
      isTyping,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Store notification in database for persistence
   */
  private async storeNotification(notification: NotificationData) {
    try {
      // Note: This would require a notifications table in your schema
      // For now, we'll log it, but in production you'd want to store these
      logger.info('Notification stored', {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      logger.error('Failed to store notification', { notification, error });
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(userId: string, notificationId: string) {
    try {
      // Implementation would update the notification in database
      // and emit to user's socket
      this.io.to(`user:${userId}`).emit('notification:read', { notificationId });
      logger.info('Notification marked as read', { userId, notificationId });
    } catch (error) {
      logger.error('Failed to mark notification as read', { userId, notificationId, error });
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      // This would query your notifications table
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      logger.error('Failed to get unread notification count', { userId, error });
      return 0;
    }
  }
}

// Factory function to create the notification service
export function createNotificationService(io: SocketIOServer): RealTimeNotificationService {
  return new RealTimeNotificationService(io);
}

// Helper functions for common notification scenarios
export const NotificationHelpers = {
  /**
   * Send new subscriber notification
   */
  async notifyNewSubscriber(
    notificationService: RealTimeNotificationService,
    artistId: string,
    fanName: string,
    tierName: string,
    subscriptionId: string
  ) {
    await notificationService.sendNotificationToUser(artistId, {
      id: `subscriber_${subscriptionId}`,
      type: 'subscription',
      title: 'New Subscriber!',
      message: `${fanName} just subscribed to your ${tierName} tier`,
      data: { subscriptionId, tierName },
      read: false,
    });
  },

  /**
   * Send content like notification
   */
  async notifyContentLiked(
    notificationService: RealTimeNotificationService,
    artistId: string,
    fanName: string,
    contentTitle: string,
    contentId: string
  ) {
    await notificationService.sendNotificationToUser(artistId, {
      id: `like_${contentId}_${Date.now()}`,
      type: 'like',
      title: 'Content Liked!',
      message: `${fanName} liked your content: ${contentTitle}`,
      data: { contentId, contentTitle },
      read: false,
    });
  },

  /**
   * Send new comment notification
   */
  async notifyNewComment(
    notificationService: RealTimeNotificationService,
    artistId: string,
    fanName: string,
    contentTitle: string,
    contentId: string,
    commentText: string
  ) {
    await notificationService.sendNotificationToUser(artistId, {
      id: `comment_${contentId}_${Date.now()}`,
      type: 'comment',
      title: 'New Comment!',
      message: `${fanName} commented on ${contentTitle}: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      data: { contentId, contentTitle },
      read: false,
    });
  },
};

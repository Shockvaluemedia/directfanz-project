import { NextRequest } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { sendNotification } from '@/lib/notifications';
import { apiSuccess, apiError } from '@/lib/api-response';
// WebSocket instance - optional, only available when running with custom server
const webSocketInstance: {
  emitToConversation: (...args: unknown[]) => void;
  isUserOnline: (userId: string) => boolean;
} | null = null;

const sendMessageSchema = z.object({
  recipientId: z.string().cuid(),
  content: z.string().min(1).max(1000),
  type: z.enum(['text', 'image', 'audio']).default('text'),
  attachmentUrl: z.string().url().optional(),
});

const getMessagesSchema = z.object({
  conversationWith: z.string().cuid(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  before: z.string().optional(), // Message ID for pagination
});

export async function POST(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const body = await request.json();
      const validatedData = sendMessageSchema.parse(body);

      const { recipientId, content, type, attachmentUrl } = validatedData;

      // Check if recipient exists and has appropriate role
      const recipient = await prisma.users.findUnique({
        where: { id: recipientId },
        select: { id: true, displayName: true, role: true, notificationPreferences: true },
      });

      if (!recipient) {
        return apiError('NOT_FOUND', 'Recipient not found');
      }

      // Business logic: Only allow fan-to-artist messaging for now
      // Artists can reply, but fans can only message artists they subscribe to
      if (req.user.role === 'FAN') {
        const hasActiveSubscription = await prisma.subscriptions.findFirst({
          where: {
            fanId: req.user.id,
            artistId: recipientId,
            status: 'ACTIVE',
          },
        });

        if (!hasActiveSubscription && recipient.role === 'ARTIST') {
          return apiError('FORBIDDEN', 'You must be subscribed to message this artist');
        }
      }

      // Create the message in the database
      const message = await prisma.messages.create({
        data: {
          id: crypto.randomUUID(),
          senderId: req.user.id,
          recipientId,
          content,
          type: type.toUpperCase(),
          attachmentUrl,
          updatedAt: new Date(),
        },
        include: {
          users_messages_senderIdTousers: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      // Emit WebSocket event for real-time delivery
      webSocketInstance?.emitToConversation(req.user.id, recipientId, 'message:new', {
        ...message,
        sender: message.users_messages_senderIdTousers,
      });

      // Emit delivery confirmation if recipient is online
      if (webSocketInstance?.isUserOnline(recipientId)) {
        webSocketInstance?.emitToConversation(req.user.id, recipientId, 'message:delivered', {
          messageId: message.id,
          deliveredAt: new Date().toISOString(),
        });
      }

      // Send notification to recipient
      if (recipient.notificationPreferences) {
        const prefs = recipient.notificationPreferences as any;
        if (prefs.messages !== false) {
          await sendNotification({
            userId: recipientId,
            type: 'new_message',
            title: 'New message',
            message: `You have a new message from ${req.user.name || req.user.email}`,
            data: {
              senderId: req.user.id,
              messageId: message.id,
            },
            channels: ['in_app'],
            priority: 'medium',
          });
        }
      }

      logger.info('Message sent', {
        senderId: req.user.id,
        recipientId,
        messageType: type,
      });

      return apiSuccess({ message: 'Message sent successfully',
        data: {
          id: message.id,
          senderId: message.senderId,
          recipientId: message.recipientId,
          content: message.content,
          type: message.type,
          attachmentUrl: message.attachmentUrl,
          createdAt: message.createdAt,
          readAt: message.readAt,
          sender: message.users_messages_senderIdTousers,
        } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Invalid message data', error.errors);
      }

      logger.error('Send message error', { userId: req.user?.id }, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to send message');
    }
  });
}

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);

      const params = getMessagesSchema.parse({
        conversationWith: searchParams.get('conversationWith') || '',
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
        before: searchParams.get('before') || undefined,
      });

      // Verify the other user exists
      const otherUser = await prisma.users.findUnique({
        where: { id: params.conversationWith },
        select: { id: true, displayName: true, avatar: true, role: true },
      });

      if (!otherUser) {
        return apiError('NOT_FOUND', 'User not found');
      }

      // Get messages from database
      const whereClause: any = {
        OR: [
          { senderId: req.user.id, recipientId: params.conversationWith },
          { senderId: params.conversationWith, recipientId: req.user.id },
        ],
      };

      // Add cursor-based pagination if 'before' is provided
      if (params.before) {
        // If before is provided, find messages created before that message
        const beforeMessage = await prisma.messages.findUnique({
          where: { id: params.before },
          select: { createdAt: true },
        });

        if (beforeMessage) {
          whereClause.createdAt = {
            lt: beforeMessage.createdAt,
          };
        }
      }

      const messages = await prisma.messages.findMany({
        where: whereClause,
        include: {
          users_messages_senderIdTousers: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      });

      // Mark unread messages from the other user as read
      const readAt = new Date();
      const updatedMessages = await prisma.messages.updateMany({
        where: {
          senderId: params.conversationWith,
          recipientId: req.user.id,
          readAt: null,
        },
        data: {
          readAt,
        },
      });

      // Emit WebSocket events for read messages
      if (updatedMessages.count > 0) {
        // Get the updated message IDs to emit specific read events
        const readMessages = await prisma.messages.findMany({
          where: {
            senderId: params.conversationWith,
            recipientId: req.user.id,
            readAt,
          },
          select: { id: true },
        });

        // Emit read events for each message
        readMessages.forEach(msg => {
          webSocketInstance?.emitToConversation(
            req.user.id,
            params.conversationWith,
            'message:read',
            {
              messageId: msg.id,
              readAt: readAt.toISOString(),
              readBy: req.user.id,
            }
          );
        });
      }

      // Get unread count
      const unreadCount = await prisma.messages.count({
        where: {
          senderId: params.conversationWith,
          recipientId: req.user.id,
          readAt: null,
        },
      });

      return apiSuccess({
          messages: messages.reverse(), // Most recent first
          conversation: {
            id: `${req.user.id}_${params.conversationWith}`,
            participants: [
              {
                id: req.user.id,
                displayName: req.user.name || req.user.email,
                avatar: null, // Avatar not available in auth token
              },
              otherUser,
            ],
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
            unreadCount,
          },
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasMore: messages.length === params.limit, // If we got exactly limit, there might be more
          } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Invalid parameters', error.errors);
      }

      logger.error('Get messages error', { userId: req.user?.id }, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to retrieve messages');
    }
  });
}

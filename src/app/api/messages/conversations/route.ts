import { NextRequest } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      // Get all unique conversation participants for this user
      const conversations = (await prisma.$queryRaw`
        SELECT DISTINCT
          CASE 
            WHEN m.senderId = ${req.user.id} THEN m.recipientId
            ELSE m.senderId
          END as participantId,
          MAX(m.createdAt) as lastMessageTime
        FROM messages m
        WHERE m.senderId = ${req.user.id} OR m.recipientId = ${req.user.id}
        GROUP BY participantId
        ORDER BY lastMessageTime DESC
      `) as Array<{ participantId: string; lastMessageTime: Date }>;

      if (conversations.length === 0) {
        return apiSuccess({ conversations: [] });
      }

      const participantIds = conversations.map(c => c.participantId);

      // Batch-fetch all participants in a single query
      const participants = await prisma.users.findMany({
        where: { id: { in: participantIds } },
        select: {
          id: true,
          displayName: true,
          avatar: true,
          role: true,
        },
      });
      const participantMap = new Map(participants.map(p => [p.id, p]));

      // Batch-fetch unread counts using groupBy
      const unreadCounts = await prisma.messages.groupBy({
        by: ['senderId'],
        where: {
          senderId: { in: participantIds },
          recipientId: req.user.id,
          readAt: null,
        },
        _count: { id: true },
      });
      const unreadMap = new Map(unreadCounts.map(u => [u.senderId, u._count.id]));

      // Fetch last messages for all conversations in fewer queries
      // We use the raw query result ordering (already sorted by lastMessageTime DESC)
      const lastMessages = await Promise.all(
        participantIds.map(pid =>
          prisma.messages.findFirst({
            where: {
              OR: [
                { senderId: req.user.id, recipientId: pid },
                { senderId: pid, recipientId: req.user.id },
              ],
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
            },
          })
        )
      );
      const lastMessageMap = new Map(
        participantIds.map((pid, i) => [pid, lastMessages[i]])
      );

      // Assemble conversation details without additional queries
      const conversationDetails = conversations
        .map(conv => {
          const participant = participantMap.get(conv.participantId);
          if (!participant) return null;

          const lastMessage = lastMessageMap.get(conv.participantId);

          return {
            id: `${req.user.id}_${conv.participantId}`,
            participants: [
              {
                id: req.user.id,
                displayName: req.user.name || req.user.email,
                avatar: null,
                role: req.user.role,
              },
              participant,
            ],
            lastMessage: lastMessage
              ? {
                  id: lastMessage.id,
                  content: lastMessage.content,
                  senderId: lastMessage.senderId,
                  createdAt: lastMessage.createdAt.toISOString(),
                }
              : null,
            unreadCount: unreadMap.get(conv.participantId) || 0,
          };
        });

      // Filter out null conversations (already sorted by lastMessageTime from raw query)
      const validConversations = conversationDetails
        .filter((conv): conv is NonNullable<typeof conv> => conv !== null);

      logger.info('Conversations fetched', {
        userId: req.user.id,
        conversationCount: validConversations.length,
      });

      return apiSuccess({
          conversations: validConversations,
        });
    } catch (error) {
      logger.error('Get conversations error', { userId: req.user?.id }, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to fetch conversations');
    }
  });
}

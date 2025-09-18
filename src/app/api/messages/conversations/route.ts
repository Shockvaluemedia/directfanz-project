import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      // Get all unique conversation participants for this user
      const conversations = await prisma.$queryRaw`
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
      ` as Array<{ participantId: string; lastMessageTime: Date }>;

      if (conversations.length === 0) {
        return NextResponse.json({
          success: true,
          data: { conversations: [] }
        });
      }

      // Get participant details and last message for each conversation
      const conversationDetails = await Promise.all(
        conversations.map(async (conv) => {
          // Get participant info
          const participant = await prisma.user.findUnique({
            where: { id: conv.participantId },
            select: {
              id: true,
              displayName: true,
              avatar: true,
              role: true
            }
          });

          if (!participant) return null;

          // Get the last message in this conversation
          const lastMessage = await prisma.message.findFirst({
            where: {
              OR: [
                { senderId: req.user.id, recipientId: conv.participantId },
                { senderId: conv.participantId, recipientId: req.user.id }
              ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true
                }
              }
            }
          });

          // Count unread messages from this participant
          const unreadCount = await prisma.message.count({
            where: {
              senderId: conv.participantId,
              recipientId: req.user.id,
              readAt: null
            }
          });

          return {
            id: `${req.user.id}_${conv.participantId}`,
            participants: [
              {
                id: req.user.id,
                displayName: req.user.name || req.user.email,
                avatar: null,
                role: req.user.role
              },
              participant
            ],
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt.toISOString()
            } : null,
            unreadCount
          };
        })
      );

      // Filter out null conversations and sort by last message time
      const validConversations = conversationDetails
        .filter((conv): conv is NonNullable<typeof conv> => conv !== null)
        .sort((a, b) => {
          const aTime = a.lastMessage?.createdAt || '1970-01-01';
          const bTime = b.lastMessage?.createdAt || '1970-01-01';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      logger.info('Conversations fetched', {
        userId: req.user.id,
        conversationCount: validConversations.length
      });

      return NextResponse.json({
        success: true,
        data: {
          conversations: validConversations
        }
      });

    } catch (error) {
      logger.error('Get conversations error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }
  });
}
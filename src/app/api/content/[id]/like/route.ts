import { NextRequest } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Check if content exists and is accessible
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          tiers: true,
          users: true,
        },
      });

      if (!content) {
        return apiError('NOT_FOUND', 'Content not found');
      }

      // Check access rights
      let hasAccess = false;

      if (content.visibility === 'PUBLIC') {
        hasAccess = true;
      } else if (content.visibility === 'PRIVATE') {
        hasAccess = req.user.id === content.artistId;
      } else if (content.visibility === 'TIER_LOCKED') {
        // Check if user has active subscription to any required tier
        const userSubscriptions = await prisma.subscriptions.findMany({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
            currentPeriodEnd: {
              gt: new Date(),
            },
            tierId: {
              in: content.tiers.map(tier => tier.id),
            },
          },
        });
        hasAccess = userSubscriptions.length > 0;
      }

      if (!hasAccess) {
        return apiError('FORBIDDEN', 'Access denied');
      }

      // Check if user has already liked this content
      const existingLike = await prisma.content_likes.findUnique({
        where: {
          userId_contentId: {
            userId: req.user.id,
            contentId: contentId,
          },
        },
      });

      if (existingLike) {
        return apiError('CONFLICT', 'Already liked');
      }

      // Create like
      await prisma.content_likes.create({
        data: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          contentId: contentId,
        } as any,
      });

      // Update content like count
      const updatedContent = await prisma.content.update({
        where: { id: contentId },
        data: {
          totalLikes: {
            increment: 1,
          },
        },
        select: {
          totalLikes: true,
        },
      });

      return apiSuccess({
        liked: true,
        totalLikes: updatedContent.totalLikes,
      });
    } catch (error) {
      logger.error('Error liking content', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to like content');
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Check if like exists
      const existingLike = await prisma.content_likes.findUnique({
        where: {
          userId_contentId: {
            userId: req.user.id,
            contentId: contentId,
          },
        },
      });

      if (!existingLike) {
        return apiError('NOT_FOUND', 'Like not found');
      }

      // Remove like
      await prisma.content_likes.delete({
        where: {
          userId_contentId: {
            userId: req.user.id,
            contentId: contentId,
          },
        },
      });

      // Update content like count
      const updatedContent = await prisma.content.update({
        where: { id: contentId },
        data: {
          totalLikes: {
            decrement: 1,
          },
        },
        select: {
          totalLikes: true,
        },
      });

      return apiSuccess({
        liked: false,
        totalLikes: updatedContent.totalLikes,
      });
    } catch (error) {
      logger.error('Error unliking content', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to unlike content');
    }
  });
}

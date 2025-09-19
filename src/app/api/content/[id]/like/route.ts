import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Check if content exists and is accessible
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          tiers: true,
          artist: true,
        },
      });

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
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
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
        return NextResponse.json({ error: 'Already liked' }, { status: 409 });
      }

      // Create like
      await prisma.content_likes.create({
        data: {
          userId: req.user.id,
          contentId: contentId,
        },
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

      return NextResponse.json({
        liked: true,
        totalLikes: updatedContent.totalLikes,
      });
    } catch (error) {
      console.error('Error liking content:', error);
      return NextResponse.json({ error: 'Failed to like content' }, { status: 500 });
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
        return NextResponse.json({ error: 'Like not found' }, { status: 404 });
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

      return NextResponse.json({
        liked: false,
        totalLikes: updatedContent.totalLikes,
      });
    } catch (error) {
      console.error('Error unliking content:', error);
      return NextResponse.json({ error: 'Failed to unlike content' }, { status: 500 });
    }
  });
}

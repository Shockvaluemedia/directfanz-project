import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { FileUploader } from '@/lib/upload';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).optional(),
  tierIds: z.array(z.string().cuid()).optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/content/[id] - Get single content item
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Fetch content with access check
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          artist: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          tiers: {
            select: {
              id: true,
              name: true,
              minimumPrice: true,
            },
          },
          comments: {
            include: {
              fan: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10, // Latest 10 comments
          },
        },
      });

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      // Check access permissions
      let hasAccess = false;

      if (req.user.role === 'ARTIST' && content.artistId === req.user.id) {
        // Artist owns the content
        hasAccess = true;
      } else if (content.visibility === 'PUBLIC') {
        // Public content
        hasAccess = true;
      } else if (req.user.role === 'FAN') {
        // Check if fan has subscription to any of the content's tiers
        const subscriptions = await prisma.subscriptions.findMany({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
            tierId: { in: content.tiers.map(t => t.id) },
          },
        });

        hasAccess = subscriptions.length > 0;
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied. Subscribe to access this content.' },
          { status: 403 }
        );
      }

      // Log content view for analytics
      if (req.user.role === 'FAN') {
        // We'll implement view tracking later in analytics
        logger.info('Content viewed', {
          contentId,
          viewerId: req.user.id,
          artistId: content.artistId,
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          ...content,
          tags: JSON.parse(content.tags),
        },
      });
    } catch (error) {
      logger.error(
        'Content fetch error',
        { userId: req.user?.id, contentId: params.id },
        error as Error
      );
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }
  });
}

// PUT /api/content/[id] - Update content
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Check if content exists and user owns it
      const existingContent = await prisma.content.findUnique({
        where: { id: contentId },
        select: {
          id: true,
          artistId: true,
        },
      });

      if (!existingContent) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      if (existingContent.artistId !== req.user.id) {
        return NextResponse.json(
          { error: 'You can only update your own content' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const validatedData = updateSchema.parse(body);

      // Validate tier ownership if specified
      if (validatedData.tierIds && validatedData.tierIds.length > 0) {
        const userTiers = await prisma.tiers.findMany({
          where: {
            id: { in: validatedData.tierIds },
            artistId: req.user.id,
            isActive: true,
          },
          select: { id: true },
        });

        if (userTiers.length !== validatedData.tierIds.length) {
          return NextResponse.json(
            { error: 'One or more specified tiers do not exist or are not owned by you' },
            { status: 400 }
          );
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (validatedData.title !== undefined) {
        updateData.title = validatedData.title;
      }

      if (validatedData.description !== undefined) {
        updateData.description = validatedData.description;
      }

      if (validatedData.visibility !== undefined) {
        updateData.visibility = validatedData.visibility;
      }

      if (validatedData.tags !== undefined) {
        updateData.tags = JSON.stringify(validatedData.tags);
      }

      // Handle tier associations
      if (validatedData.tierIds !== undefined) {
        // First disconnect all existing tiers
        await prisma.content.update({
          where: { id: contentId },
          data: {
            tiers: {
              set: [], // Clear all existing connections
            },
          },
        });

        // Then connect new tiers
        updateData.tiers = {
          connect: validatedData.tierIds.map(id => ({ id })),
        };
      }

      // Update content
      const updatedContent = await prisma.content.update({
        where: { id: contentId },
        data: updateData,
        include: {
          artist: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          tiers: {
            select: {
              id: true,
              name: true,
              minimumPrice: true,
            },
          },
        },
      });

      logger.info('Content updated', {
        contentId,
        userId: req.user.id,
        changes: Object.keys(updateData),
      });

      return NextResponse.json({
        success: true,
        message: 'Content updated successfully',
        data: {
          ...updatedContent,
          tags: JSON.parse(updatedContent.tags),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid update data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error(
        'Content update error',
        { userId: req.user?.id, contentId: params.id },
        error as Error
      );
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }
  });
}

// DELETE /api/content/[id] - Delete content
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApi(request, async req => {
    try {
      const contentId = params.id;

      // Check if content exists and user owns it
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        select: {
          id: true,
          artistId: true,
          fileUrl: true,
          thumbnailUrl: true,
        },
      });

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      if (content.artistId !== req.user.id) {
        return NextResponse.json(
          { error: 'You can only delete your own content' },
          { status: 403 }
        );
      }

      // Delete from database first (this will cascade delete comments, etc.)
      await prisma.content.delete({
        where: { id: contentId },
      });

      // Extract S3 keys from URLs for cleanup
      try {
        const fileKey = content.fileUrl.split('/').pop();
        if (fileKey && content.fileUrl.includes('amazonaws.com')) {
          await FileUploader.deleteFromS3(fileKey);
        }

        if (content.thumbnailUrl) {
          const thumbnailKey = content.thumbnailUrl.split('/').pop();
          if (thumbnailKey && content.thumbnailUrl.includes('amazonaws.com')) {
            await FileUploader.deleteFromS3(thumbnailKey);
          }
        }
      } catch (storageError) {
        // Log error but don't fail the request - database deletion succeeded
        logger.error('Failed to delete files from storage', {
          contentId,
          error: storageError,
        });
      }

      logger.info('Content deleted', {
        contentId,
        userId: req.user.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Content deleted successfully',
      });
    } catch (error) {
      logger.error(
        'Content deletion error',
        { userId: req.user?.id, contentId: params.id },
        error as Error
      );
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }
  });
}

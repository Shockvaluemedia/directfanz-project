import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile, extractKeyFromUrl } from '@/lib/s3';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const updateContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tierIds: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  thumbnailUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return apiError('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Artist authentication required' });
    }

    const content = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
      include: {
        tiers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!content) {
      return apiError('NOT_FOUND', { code: 'NOT_FOUND', message: 'Content not found' });
    }

    return apiSuccess(content);
  } catch (error) {
    logger.error('Content fetch error', {}, error as Error);
    return apiError('INTERNAL_ERROR', { code: 'INTERNAL_ERROR', message: 'Failed to fetch content' });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return apiError('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Artist authentication required' });
    }

    const body = await request.json();
    const validatedData = updateContentSchema.parse(body);

    // Check if content exists and belongs to artist
    const existingContent = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
    });

    if (!existingContent) {
      return apiError('NOT_FOUND', { code: 'NOT_FOUND', message: 'Content not found' });
    }

    // Verify that specified tiers belong to the artist
    if (validatedData.tierIds && validatedData.tierIds.length > 0) {
      const tierCount = await prisma.tiers.count({
        where: {
          id: { in: validatedData.tierIds },
          artistId: session.user.id,
        },
      });

      if (tierCount !== validatedData.tierIds.length) {
        return apiError('BAD_REQUEST', {
              code: 'INVALID_TIERS',
              message: 'One or more tiers do not belong to this artist',
            },);
      }
    }

    // Update content
    const updateData: any = {};

    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.thumbnailUrl !== undefined)
      updateData.thumbnailUrl = validatedData.thumbnailUrl;

    // Handle tier updates
    if (validatedData.tierIds !== undefined) {
      updateData.tiers = {
        set: validatedData.tierIds.map(id => ({ id })),
      };
    }

    const updatedContent = await prisma.content.update({
      where: { id: params.id },
      data: updateData,
      include: {
        tiers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return apiSuccess(updatedContent);
  } catch (error) {
    logger.error('Content update error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data', { errors: error.errors },
          });
    }

    return apiError('INTERNAL_ERROR', { code: 'INTERNAL_ERROR', message: 'Failed to update content' });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return apiError('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Artist authentication required' });
    }

    // Check if content exists and belongs to artist
    const existingContent = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
    });

    if (!existingContent) {
      return apiError('NOT_FOUND', { code: 'NOT_FOUND', message: 'Content not found' });
    }

    // Delete file from S3
    try {
      const fileKey = extractKeyFromUrl(existingContent.fileUrl);
      await deleteFile(fileKey);

      // Delete thumbnail if exists
      if (existingContent.thumbnailUrl) {
        const thumbnailKey = extractKeyFromUrl(existingContent.thumbnailUrl);
        await deleteFile(thumbnailKey);
      }
    } catch (s3Error) {
      logger.error('S3 deletion error', {}, s3Error as Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete content from database
    await prisma.content.delete({
      where: { id: params.id },
    });

    return apiSuccess({ message: 'Content deleted successfully' });
  } catch (error) {
    logger.error('Content deletion error', {}, error as Error);
    return apiError('INTERNAL_ERROR', { code: 'INTERNAL_ERROR', message: 'Failed to delete content' });
  }
}

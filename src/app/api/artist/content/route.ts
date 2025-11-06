import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUPPORTED_FILE_TYPES } from '@/lib/s3';
import { notifyNewContent } from '@/lib/notifications';
import { z } from 'zod';
import crypto from 'crypto';
import {
  withArtistApiHandler,
  ApiRequestContext,
  validateApiRequest
} from '@/lib/api-error-handler';
import { AppError, ErrorCode } from '@/lib/errors';

const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  fileUrl: z.string().url('Invalid file URL'),
  fileSize: z.number().positive('File size must be positive'),
  format: z.string().min(1, 'Format is required'),
  duration: z.number().optional(),
  tags: z.array(z.string()).default([]),
  tierIds: z.array(z.string()).default([]),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).default('PRIVATE'),
  thumbnailUrl: z.string().url().optional(),
});

export const POST = withArtistApiHandler(
  async (context: ApiRequestContext, userId: string, request: NextRequest) => {
    const body = await request.json();
    const validatedData = validateApiRequest(createContentSchema, body, context);

    // Determine content type from format
    const contentType = Object.entries(SUPPORTED_FILE_TYPES).find(
      ([mimeType, info]) => info.extension === validatedData.format.toLowerCase()
    )?.[1]?.category;

    if (!contentType) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Unsupported file format',
        400,
        { format: validatedData.format },
        context.requestId,
        userId
      );
    }

    // Verify that specified tiers belong to the artist
    if (validatedData.tierIds.length > 0) {
      const tierCount = await prisma.tiers.count({
        where: {
          id: { in: validatedData.tierIds },
          artistId: userId,
        },
      });

      if (tierCount !== validatedData.tierIds.length) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'One or more tiers do not belong to this artist',
          400,
          { providedTiers: validatedData.tierIds, validTiers: tierCount },
          context.requestId,
          userId
        );
      }
    }

    // Create content record
    const content = await prisma.content.create({
      data: {
        id: crypto.randomUUID(),
        title: validatedData.title,
        description: validatedData.description,
        type: contentType,
        fileUrl: validatedData.fileUrl,
        thumbnailUrl: validatedData.thumbnailUrl,
        fileSize: validatedData.fileSize,
        duration: validatedData.duration,
        format: validatedData.format,
        tags: JSON.stringify(validatedData.tags),
        visibility: validatedData.visibility,
        users: { connect: { id: userId } },
        tiers: {
          connect: validatedData.tierIds.map(id => ({ id })),
        },
        updatedAt: new Date(),
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

    // Get artist name for notification
    const artist = await prisma.users.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    // Send notifications to subscribers (async, don't await)
    if (validatedData.tierIds.length > 0) {
      notifyNewContent(content, artist?.displayName || 'Artist').catch(error =>
        console.error('Failed to send content notifications:', error)
      );
    }

    return content;
  }
);

export const GET = withArtistApiHandler(
  async (context: ApiRequestContext, userId: string, request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      artistId: userId,
    };

    if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get content with pagination
    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          tiers: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return {
      content,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
);

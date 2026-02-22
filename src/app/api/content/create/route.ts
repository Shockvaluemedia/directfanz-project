import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createErrorResponse, UnauthorizedError, ValidationError } from '@/lib/api-error-handler';
import { AppError, ErrorCode, isAppError } from '@/lib/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  fileUrl: z.string().url('Invalid file URL'),
  thumbnailUrl: z.string().url().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'SUBSCRIBERS_ONLY']).default('PUBLIC'),
  fileSize: z.number().positive('File size must be positive'),
  duration: z.number().positive().optional(),
  format: z.string().min(1, 'Format is required'),
  tags: z.string().default(''),
  category: z.string().optional(),
  isPremium: z.boolean().default(false),
  price: z.number().min(0).optional(),
  scheduledFor: z.string().datetime().optional(),
  allowComments: z.boolean().default(true),
  allowDownloads: z.boolean().default(false),
  isExclusive: z.boolean().default(false),
  matureContent: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      throw new UnauthorizedError('Artist authentication required');
    }

    const body = await request.json();
    const validatedData = createContentSchema.parse(body);

    const contentType = determineContentType(validatedData.format, validatedData.type);
    const contentId = nanoid();

    const tags = validatedData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .join(',');

    const content = await prisma.content.create({
      data: {
        id: contentId,
        artistId: session.user.id,
        title: validatedData.title,
        description: validatedData.description || null,
        type: contentType,
        fileUrl: validatedData.fileUrl,
        thumbnailUrl: validatedData.thumbnailUrl || null,
        visibility: validatedData.visibility,
        fileSize: validatedData.fileSize,
        duration: validatedData.duration || null,
        format: validatedData.format,
        tags: tags,
        createdAt: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('Content created successfully', {
      contentId: content.id,
      artistId: session.user.id,
      title: content.title,
      type: content.type,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: content.id,
        title: content.title,
        type: content.type,
        fileUrl: content.fileUrl,
        thumbnailUrl: content.thumbnailUrl,
        visibility: content.visibility,
        createdAt: content.createdAt,
      },
    });

  } catch (error) {
    const context = {
      requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
      method: request.method,
      url: request.url,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      startTime: Date.now(),
    };

    if (error instanceof z.ZodError) {
      const appError = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid content data',
        400,
        { errors: error.errors },
        context.requestId
      );
      return createErrorResponse(appError, context);
    }

    if (isAppError(error)) {
      return createErrorResponse(error, context);
    }

    const appError = new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500,
      undefined,
      context.requestId
    );
    return createErrorResponse(appError, context);
  }
}

function determineContentType(format: string, providedType?: string): string {
  if (providedType && ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(providedType)) {
    return providedType;
  }

  const imageFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'];
  const videoFormats = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv'];
  const audioFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'mpeg'];

  const formatLower = format.toLowerCase();

  if (imageFormats.some(f => formatLower.includes(f))) return 'IMAGE';
  if (videoFormats.some(f => formatLower.includes(f))) return 'VIDEO';
  if (audioFormats.some(f => formatLower.includes(f))) return 'AUDIO';

  return 'DOCUMENT';
}

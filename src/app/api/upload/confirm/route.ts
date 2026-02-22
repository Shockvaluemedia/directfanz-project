import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createErrorResponse,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api-error-handler';
import { AppError, ErrorCode, isAppError } from '@/lib/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { head } from '@vercel/blob';
import crypto from 'crypto';

const confirmUploadSchema = z.object({
  key: z.string().min(1, 'File key is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      throw new UnauthorizedError('Artist authentication required');
    }

    const body = await request.json();
    const validatedData = confirmUploadSchema.parse(body);

    try {
      // Verify the file exists in Vercel Blob
      const blobInfo = await head(validatedData.key);

      logger.info('Upload confirmed', {
        artistId: session.user.id,
        key: validatedData.key,
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: blobInfo.size,
      });

      return NextResponse.json({
        success: true,
        data: {
          key: validatedData.key,
          fileName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileSize: blobInfo.size,
          uploadedAt: blobInfo.uploadedAt.toISOString(),
          fileUrl: blobInfo.url,
        },
      });
    } catch (blobError: any) {
      if (blobError?.name === 'BlobNotFoundError') {
        throw new NotFoundError('File not found in storage');
      }

      logger.error(
        'Blob error during upload confirmation',
        {
          artistId: session.user.id,
          key: validatedData.key,
        },
        blobError
      );

      throw new Error('Failed to verify file upload');
    }
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
        'Invalid request data',
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

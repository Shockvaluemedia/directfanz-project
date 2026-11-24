import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createErrorResponse,
  UnauthorizedError,
} from '@/lib/api-error-handler';
import { AppError, ErrorCode, isAppError } from '@/lib/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { confirmDirectUpload, StorageNotConfiguredError, UploadRejectedError } from '@/lib/storage/uploads';
import crypto from 'crypto';

const confirmUploadSchema = z.object({
  key: z.string().min(1, 'File key is required').max(1024),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  // Present when the file went up in parts: the ETag S3 returned for each.
  multipart: z
    .object({
      uploadId: z.string().min(1).max(1024),
      parts: z
        .array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(256) }))
        .min(1)
        .max(10000),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Any signed-in user may confirm their own upload; content (paid media)
    // keys are additionally limited to artists inside confirmDirectUpload.
    if (!session?.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const body = await request.json();
    const validatedData = confirmUploadSchema.parse(body);

    try {
      // Completes a multipart upload if needed, then checks the object exists,
      // sits in this artist's own prefix and is within the size limit.
      const confirmed = await confirmDirectUpload({
        userId: session.user.id,
        key: validatedData.key,
        fileType: validatedData.fileType,
        isArtist: session.user.role === 'ARTIST',
        multipart: validatedData.multipart,
      });

      logger.info('Upload confirmed', {
        artistId: session.user.id,
        key: confirmed.key,
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: confirmed.fileSize,
      });

      return NextResponse.json({
        success: true,
        data: {
          key: confirmed.key,
          fileName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileSize: confirmed.fileSize,
          uploadedAt: confirmed.uploadedAt.toISOString(),
          // A storage reference, not a link: save it on the content row and
          // play it back through /api/content/[id]/stream.
          fileUrl: confirmed.fileUrl,
        },
      });
    } catch (storageError) {
      if (storageError instanceof UploadRejectedError) {
        const code =
          storageError.status === 404 ? 'NOT_FOUND' : storageError.status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR';
        return NextResponse.json(
          { success: false, error: { code, message: storageError.message } },
          { status: storageError.status }
        );
      }
      if (storageError instanceof StorageNotConfiguredError) {
        return NextResponse.json(
          { success: false, error: { code: 'STORAGE_NOT_CONFIGURED', message: 'Storage is not configured' } },
          { status: 503 }
        );
      }

      logger.error(
        'Storage error during upload confirmation',
        {
          artistId: session.user.id,
          key: validatedData.key,
        },
        storageError as Error
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

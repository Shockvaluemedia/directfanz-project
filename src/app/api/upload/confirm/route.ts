// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createErrorResponse,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api-error-handler';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { head } from '@vercel/blob';

const confirmUploadSchema = z.object({
  key: z.string().min(1, 'File key is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      throw UnauthorizedError('Artist authentication required');
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
        throw NotFoundError('File not found in storage');
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
    const requestId = request.headers.get('x-request-id');

    if (error instanceof z.ZodError) {
      return createErrorResponse(
        ValidationError('Invalid request data', { errors: error.errors }),
        requestId || undefined
      );
    }

    return createErrorResponse(error, requestId || undefined);
  }
}

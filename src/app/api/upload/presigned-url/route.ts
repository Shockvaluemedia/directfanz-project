import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { createErrorResponse, UnauthorizedError, ValidationError } from '@/lib/api-error-handler';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const presignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      throw new UnauthorizedError('Artist authentication required');
    }

    const body = await request.json();
    const validatedData = presignedUrlSchema.parse(body);

    // Additional validation using the S3 utility
    const validationErrors = validateFileUpload(
      validatedData.fileName,
      validatedData.fileType,
      validatedData.fileSize
    );

    if (validationErrors.length > 0) {
      throw new ValidationError('File validation failed', { errors: validationErrors });
    }

    // Generate presigned URL
    const uploadInfo = await generatePresignedUrl({
      fileName: validatedData.fileName,
      fileType: validatedData.fileType,
      fileSize: validatedData.fileSize,
      artistId: session.user.id,
    });

    // Log the upload request
    logger.info('Presigned URL generated', {
      artistId: session.user.id,
      fileName: validatedData.fileName,
      fileType: validatedData.fileType,
      fileSize: validatedData.fileSize,
      key: uploadInfo.key,
    });

    return NextResponse.json({
      success: true,
      data: uploadInfo,
    });
  } catch (error) {
    const requestId = request.headers.get('x-request-id');

    if (error instanceof z.ZodError) {
      return createErrorResponse(
        new ValidationError('Invalid request data', { errors: error.errors }),
        requestId || undefined
      );
    }

    return createErrorResponse(error, requestId || undefined);
  }
}

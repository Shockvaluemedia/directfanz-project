import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { UnauthorizedError, ValidationError } from '@/lib/api-error-handler';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const presignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;

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
      throw new ValidationError('File validation failed');
    }

    // Check if we're using local storage for development
    const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
    
    let uploadInfo: any;
    if (useLocalStorage) {
      // For local development, create a mock response
      const mockFileUrl = `/uploads/${session.user.id}/${Date.now()}-${validatedData.fileName}`;
      uploadInfo = {
        uploadUrl: mockFileUrl,
        fileUrl: mockFileUrl,
        key: `content/${session.user.id}/${Date.now()}-${validatedData.fileName}`,
        useLocalStorage: true,
      };
    } else {
      // Generate presigned URL for S3
      uploadInfo = await generatePresignedUrl({
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        artistId: session.user.id,
      });
      uploadInfo.useLocalStorage = false;
    }

    // Log the upload request
    logger.info('Presigned URL generated', {
      artistId: session.user.id,
      fileName: validatedData.fileName,
      fileType: validatedData.fileType,
      fileSize: validatedData.fileSize,
      key: uploadInfo.key,
    });

    return apiSuccess(uploadInfo);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    if (error instanceof UnauthorizedError) {
      return apiError('UNAUTHORIZED', error.message);
    }

    if (error instanceof ValidationError) {
      return apiError('BAD_REQUEST', error.message);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError('INTERNAL_ERROR', message);
  }
}

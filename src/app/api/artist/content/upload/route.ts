import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const uploadRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return apiError('UNAUTHORIZED', 'Artist authentication required');
    }

    const body = await request.json();
    const validatedData = uploadRequestSchema.parse(body);

    const { fileName, fileType, fileSize } = validatedData;

    // Validate file upload parameters
    const validationErrors = validateFileUpload(fileName, fileType, fileSize);
    if (validationErrors.length > 0) {
      return apiError('BAD_REQUEST', 'File validation failed', validationErrors);
    }

    // Generate presigned URL
    const presignedUrlData = await generatePresignedUrl({
      fileName,
      fileType,
      fileSize,
      artistId: session.user.id,
    });

    return apiSuccess(presignedUrlData);
  } catch (error) {
    logger.error('Upload URL generation error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    if (error instanceof Error) {
      return apiError('BAD_REQUEST', error.message);
    }

    return apiError('INTERNAL_ERROR', 'Failed to generate upload URL');
  }
}

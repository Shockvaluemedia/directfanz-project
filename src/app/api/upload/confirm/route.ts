import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createErrorResponse, UnauthorizedError, ValidationError, NotFoundError } from '@/lib/api-error-handler';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

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

    // Verify the file exists in S3 and belongs to the artist
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: validatedData.key,
      });
      
      const headResponse = await s3Client.send(headCommand);
      
      // Check if the file belongs to the current artist
      const artistId = headResponse.Metadata?.artistid;
      if (artistId !== session.user.id) {
        throw UnauthorizedError('File does not belong to current user');
      }
      
      // Get file info
      const fileSize = headResponse.ContentLength || 0;
      const lastModified = headResponse.LastModified || new Date();
      
      logger.info('Upload confirmed', {
        artistId: session.user.id,
        key: validatedData.key,
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize,
      });

      return NextResponse.json({
        success: true,
        data: {
          key: validatedData.key,
          fileName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileSize,
          uploadedAt: lastModified.toISOString(),
          fileUrl: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${validatedData.key}`,
        },
      });

    } catch (s3Error: any) {
      if (s3Error.name === 'NotFound') {
        throw NotFoundError('File not found in storage');
      }
      
      logger.error('S3 error during upload confirmation', {
        artistId: session.user.id,
        key: validatedData.key,
      }, s3Error);
      
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
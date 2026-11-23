import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { getObjectStorage } from '@/lib/storage';
import { StorageNotConfiguredError, UploadRejectedError } from '@/lib/storage/uploads';
import { UnauthorizedError, ValidationError } from '@/lib/api-error-handler';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { UPLOAD_PURPOSES, type UploadPurpose } from '@/lib/upload-policy';

const presignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
  // content (default, artists only), image, submission or attachment.
  purpose: z.enum(Object.keys(UPLOAD_PURPOSES) as [UploadPurpose, ...UploadPurpose[]]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;

    if (!session?.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const body = await request.json();
    const validatedData = presignedUrlSchema.parse(body);
    const purpose: UploadPurpose = validatedData.purpose ?? 'content';

    // Paid content is for artists; images, entries and attachments for anyone signed in.
    if (UPLOAD_PURPOSES[purpose].artistOnly && session.user.role !== 'ARTIST') {
      throw new UnauthorizedError('Artist authentication required');
    }

    // Additional validation using the S3 utility
    const validationErrors = validateFileUpload(
      validatedData.fileName,
      validatedData.fileType,
      validatedData.fileSize
    );

    if (validationErrors.length > 0) {
      throw new ValidationError('File validation failed');
    }

    // Local development without a bucket keeps using the on-disk uploader.
    const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true' || !getObjectStorage();
    
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
      // Signed link(s) straight to the private bucket: one PUT for small
      // files, one per part for large ones. The app never sees the bytes.
      uploadInfo = await generatePresignedUrl({
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        artistId: session.user.id,
        purpose, // createDirectUpload checks the type is allowed for it
      });
      uploadInfo.useLocalStorage = false;
    }

    // Log the upload request
    logger.info('Presigned URL generated', {
      artistId: session.user.id,
      fileName: validatedData.fileName,
      fileType: validatedData.fileType,
      fileSize: validatedData.fileSize,
      purpose,
      key: uploadInfo.key,
    });

    return NextResponse.json({
      success: true,
      data: uploadInfo,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: 'Storage is not configured' }, { status: 503 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

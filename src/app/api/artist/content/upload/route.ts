import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { z } from 'zod';

const uploadRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File size must be positive'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = uploadRequestSchema.parse(body);
    
    const { fileName, fileType, fileSize } = validatedData;

    // Validate file upload parameters
    const validationErrors = validateFileUpload(fileName, fileType, fileSize);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'File validation failed',
            details: { errors: validationErrors }
          } 
        },
        { status: 400 }
      );
    }

    // Generate presigned URL
    const presignedUrlData = await generatePresignedUrl({
      fileName,
      fileType,
      fileSize,
      artistId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: presignedUrlData,
    });

  } catch (error) {
    console.error('Upload URL generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid request data',
            details: { errors: error.errors }
          } 
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_ERROR', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate upload URL' } },
      { status: 500 }
    );
  }
}
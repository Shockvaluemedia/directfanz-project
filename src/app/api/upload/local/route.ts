import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateFileUpload, SUPPORTED_FILE_TYPES } from '@/lib/s3';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    // Check if local storage is enabled
    if (process.env.USE_LOCAL_STORAGE !== 'true') {
      return NextResponse.json(
        { error: { code: 'NOT_AVAILABLE', message: 'Local upload not available in this environment' } },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'MISSING_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Validate file
    const validationErrors = validateFileUpload(file.name, file.type, file.size);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File validation failed',
            details: validationErrors,
          },
        },
        { status: 400 }
      );
    }

    // Create upload directory structure
    const uploadDir = join(process.cwd(), 'public', 'uploads', session.user.id);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${sanitizedFileName}`;
    const filePath = join(uploadDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create file URL
    const fileUrl = `/uploads/${session.user.id}/${fileName}`;

    // Get file type info
    const fileTypeInfo = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];

    logger.info('Local file upload successful', {
      artistId: session.user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      savedPath: filePath,
    });

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        category: fileTypeInfo?.category,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Local file upload error:', error);
    
    return NextResponse.json(
      { 
        error: { 
          code: 'UPLOAD_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to upload file' 
        } 
      },
      { status: 500 }
    );
  }
}
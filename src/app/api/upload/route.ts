import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processFile } from '@/lib/file-upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Allowlist of accepted MIME types mapped to the canonical, server-controlled
// file extension. The client-supplied filename is NEVER used in a filesystem
// path; only these extensions are ever written to disk.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated session — uploads must never be anonymous.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        // Validate type against the allowlist and reject oversized files
        // BEFORE writing anything to disk.
        const safeExt = ALLOWED_TYPES[file.type];
        if (!safeExt) {
          uploadResults.push({
            originalName: file.name,
            error: `Unsupported file type: ${file.type || 'unknown'}`,
            success: false,
          });
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          uploadResults.push({
            originalName: file.name,
            error: 'File exceeds the 100MB size limit',
            success: false,
          });
          continue;
        }

        // Create temp file with a server-generated name (no client input in path)
        const tempDir = path.join(process.cwd(), 'uploads', 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const tempFileName = `${randomUUID()}${safeExt}`;
        const tempFilePath = path.join(tempDir, tempFileName);

        // Save file to temp location
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(tempFilePath, buffer);

        // Process the file
        const processedFile = await processFile(tempFilePath, {
          generateThumbnail: true,
          optimizeImage: true,
          extractMetadata: true
        });

        // Move to permanent storage
        const permanentDir = path.join(process.cwd(), 'uploads', 'content');
        await fs.mkdir(permanentDir, { recursive: true });

        const finalFileName = `${randomUUID()}${safeExt}`;
        const finalFilePath = path.join(permanentDir, finalFileName);

        if (processedFile.processedPath && processedFile.processedPath !== tempFilePath) {
          // File was processed, move the processed version
          await fs.rename(processedFile.processedPath, finalFilePath);
        } else {
          // File wasn't processed, move the original
          await fs.rename(tempFilePath, finalFilePath);
        }

        // Handle thumbnail
        let thumbnailUrl = null;
        if (processedFile.thumbnailPath) {
          const thumbnailFileName = `thumb-${finalFileName}`;
          const thumbnailFinalPath = path.join(permanentDir, thumbnailFileName);
          await fs.rename(processedFile.thumbnailPath, thumbnailFinalPath);
          thumbnailUrl = `/api/files/content/${thumbnailFileName}`;
        }

        // Clean up temp files
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          // File might have been moved, ignore
        }

        uploadResults.push({
          id: Math.random().toString(36).substring(2),
          originalName: file.name,
          fileName: finalFileName,
          mimeType: file.type,
          size: file.size,
          url: `/api/files/content/${finalFileName}`,
          thumbnailUrl,
          metadata: processedFile.metadata,
          success: true
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        uploadResults.push({
          originalName: file.name,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
          success: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadResults
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle file size limit errors
export async function GET() {
  return NextResponse.json({ 
    message: 'File upload endpoint. Use POST to upload files.',
    limits: {
      maxFileSize: '100MB',
      allowedTypes: [
        'Images: JPEG, PNG, GIF, WebP',
        'Videos: MP4, MOV, AVI, MKV', 
        'Audio: MP3, WAV, AAC, OGG',
        'Documents: PDF, DOC, DOCX'
      ]
    }
  });
}
import { NextRequest, NextResponse } from 'next/server';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { processFile } from '@/lib/file-upload';

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov', 'video/avi', 'video/mkv',
      'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// Helper to run multer middleware in Next.js
function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
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
        // Create temp file
        const tempDir = path.join(process.cwd(), 'uploads', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempFileName = `${Date.now()}-${file.name}`;
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
        
        const finalFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.name}`;
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
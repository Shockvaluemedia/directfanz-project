import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { stat } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    
    // Construct file path
    const filePath = path.join(process.cwd(), 'uploads', 'content', sanitizedFilename);
    
    try {
      // Check if file exists
      const fileStat = await stat(filePath);
      
      if (!fileStat.isFile()) {
        return new NextResponse('File not found', { status: 404 });
      }
      
      // Read file
      const fileBuffer = await fs.readFile(filePath);
      
      // Determine content type based on file extension
      const ext = path.extname(sanitizedFilename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        case '.mp4':
          contentType = 'video/mp4';
          break;
        case '.mov':
          contentType = 'video/quicktime';
          break;
        case '.avi':
          contentType = 'video/x-msvideo';
          break;
        case '.mkv':
          contentType = 'video/x-matroska';
          break;
        case '.mp3':
          contentType = 'audio/mpeg';
          break;
        case '.wav':
          contentType = 'audio/wav';
          break;
        case '.aac':
          contentType = 'audio/aac';
          break;
        case '.ogg':
          contentType = 'audio/ogg';
          break;
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.doc':
          contentType = 'application/msword';
          break;
        case '.docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
      }
      
      // Handle range requests for video/audio streaming
      const range = request.headers.get('range');
      
      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
        const chunksize = (end - start) + 1;
        
        if (start >= fileStat.size || end >= fileStat.size || start > end) {
          return new NextResponse('Range not satisfiable', { status: 416 });
        }
        
        const chunk = fileBuffer.slice(start, end + 1);
        
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          }
        });
      }
      
      // Return full file
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileStat.size.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          // Security headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        }
      });
      
    } catch (error) {
      console.error('Error serving file:', error);
      return new NextResponse('File not found', { status: 404 });
    }
    
  } catch (error) {
    console.error('Error in file route:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle HEAD requests for file metadata
export async function HEAD(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'content', sanitizedFilename);
    
    const fileStat = await stat(filePath);
    
    if (!fileStat.isFile()) {
      return new NextResponse(null, { status: 404 });
    }
    
    const ext = path.extname(sanitizedFilename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.mov':
        contentType = 'video/quicktime';
        break;
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }
    
    return new NextResponse(null, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Accept-Ranges': 'bytes',
        'Last-Modified': fileStat.mtime.toUTCString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    });
    
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}
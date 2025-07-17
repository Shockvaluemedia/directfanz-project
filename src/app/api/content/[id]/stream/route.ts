import { NextRequest } from 'next/server'
import { withStreamingAccess } from '@/middleware/content-access'
import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/lib/s3'

// Stream content with access control
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withStreamingAccess(request, params.id, async (req) => {
    try {
      // Get content information
      const content = await prisma.content.findUnique({
        where: { id: params.id },
        select: {
          fileUrl: true,
          type: true,
          format: true,
          fileSize: true,
          title: true
        }
      })

      if (!content) {
        return new Response('Content not found', { status: 404 })
      }

      // Extract S3 key from file URL
      const url = new URL(content.fileUrl)
      const key = url.pathname.substring(1) // Remove leading slash

      // Handle range requests for streaming
      const range = request.headers.get('range')
      
      if (range && (content.type === 'AUDIO' || content.type === 'VIDEO')) {
        return handleRangeRequest(key, range, content)
      }

      // For non-streaming content or full file requests
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: key
      })

      // Generate presigned URL for direct access
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

      // Redirect to signed URL for efficient streaming
      return Response.redirect(signedUrl, 302)

    } catch (error) {
      console.error('Content streaming error:', error)
      return new Response('Streaming failed', { status: 500 })
    }
  })
}

// Handle range requests for audio/video streaming
async function handleRangeRequest(
  key: string,
  rangeHeader: string,
  content: { fileSize: number; format: string; title: string }
): Promise<Response> {
  try {
    // Parse range header
    const ranges = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(ranges[0], 10)
    const end = ranges[1] ? parseInt(ranges[1], 10) : content.fileSize - 1
    const chunkSize = (end - start) + 1

    // Create S3 command with range
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Range: `bytes=${start}-${end}`
    })

    // Get object from S3
    const response = await s3Client.send(command)
    
    if (!response.Body) {
      return new Response('Content not available', { status: 404 })
    }

    // Convert stream to array buffer
    const chunks: Uint8Array[] = []
    const reader = response.Body.transformToWebStream().getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    // Determine content type
    const contentType = getContentType(content.format)

    return new Response(buffer, {
      status: 206, // Partial Content
      headers: {
        'Content-Range': `bytes ${start}-${end}/${content.fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${content.title}.${content.format}"`
      }
    })

  } catch (error) {
    console.error('Range request error:', error)
    return new Response('Range request failed', { status: 500 })
  }
}

// Get content type from format
function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    // Audio formats
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    
    // Video formats
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    
    // Image formats
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    
    // Document formats
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }

  return contentTypes[format.toLowerCase()] || 'application/octet-stream'
}
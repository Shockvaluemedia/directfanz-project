import { NextRequest, NextResponse } from 'next/server'
import { withContentAccess } from '@/middleware/content-access'
import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/lib/s3'

// Download content with access control
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withContentAccess(request, params.id, async (req) => {
    try {
      // Get content information
      const content = await prisma.content.findUnique({
        where: { id: params.id },
        select: {
          fileUrl: true,
          title: true,
          format: true,
          fileSize: true,
          type: true,
          artist: {
            select: {
              displayName: true
            }
          }
        }
      })

      if (!content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        )
      }

      // Extract S3 key from file URL
      const url = new URL(content.fileUrl)
      const key = url.pathname.substring(1) // Remove leading slash

      // Generate filename for download
      const artistName = content.artist.displayName.replace(/[^a-zA-Z0-9]/g, '_')
      const contentTitle = content.title.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `${artistName}_${contentTitle}.${content.format}`

      // Create S3 command for download
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`
      })

      // Generate presigned URL for download
      const downloadUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 3600 // 1 hour
      })

      // Log download activity
      await logDownloadActivity(req.userId, params.id)

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl,
          filename,
          fileSize: content.fileSize,
          expiresIn: 3600
        }
      })

    } catch (error) {
      console.error('Content download error:', error)
      return NextResponse.json(
        { error: 'Download failed' },
        { status: 500 }
      )
    }
  })
}

// Log download activity for analytics
async function logDownloadActivity(userId: string, contentId: string) {
  try {
    // You could create a downloads table to track this
    // For now, we'll just log it
    console.log(`Download: User ${userId} downloaded content ${contentId} at ${new Date().toISOString()}`)
    
    // Future enhancement: Store in database for analytics
    // await prisma.download.create({
    //   data: {
    //     userId,
    //     contentId,
    //     downloadedAt: new Date()
    //   }
    // })
  } catch (error) {
    console.error('Download logging error:', error)
    // Don't fail the download if logging fails
  }
}
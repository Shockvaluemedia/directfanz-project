import { NextRequest, NextResponse } from 'next/server';
import { withContentAccess } from '@/middleware/content-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Download content with access control
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withContentAccess(request, params.id, async req => {
    try {
      const content = await prisma.content.findUnique({
        where: { id: params.id },
        select: {
          fileUrl: true,
          title: true,
          format: true,
          fileSize: true,
          type: true,
          users: {
            select: {
              displayName: true,
            },
          },
        },
      });

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      // Vercel Blob URLs are directly accessible — redirect to the file
      const artistName = content.users?.displayName?.replace(/[^a-zA-Z0-9]/g, '_') || 'artist';
      const contentTitle = content.title.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${artistName}_${contentTitle}.${content.format}`;

      await logDownloadActivity(req.userId, params.id);

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl: content.fileUrl,
          filename,
          fileSize: content.fileSize,
        },
      });
    } catch (error) {
      logger.error('Content download error', {}, error as Error);
      return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
  });
}

async function logDownloadActivity(userId: string, contentId: string) {
  try {
    logger.info(`Download: User ${userId} downloaded content ${contentId} at ${new Date().toISOString()}`);
  } catch (error) {
    logger.error('Download logging error', {}, error as Error);
  }
}

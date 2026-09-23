import { NextRequest, NextResponse } from 'next/server';
import { withContentAccess } from '@/middleware/content-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { extensionFor, mimeFor, proxyMedia, resolveMediaSource } from '@/lib/media-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Downloads gated media as an attachment, streamed through the app. Like the
 * stream route, this never exposes the underlying storage URL.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withContentAccess(request, id, async req => {
    try {
      const content = await prisma.content.findUnique({
        where: { id },
        select: {
          fileUrl: true,
          title: true,
          format: true,
          users: { select: { displayName: true } },
        },
      });
      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      const source = resolveMediaSource(content.fileUrl);
      if (!source) {
        logger.warn('Content media source cannot be proxied', { contentId: id });
        return NextResponse.json({ error: 'Media unavailable' }, { status: 502 });
      }

      const artistName = content.users?.displayName?.replace(/[^a-zA-Z0-9]/g, '_') || 'artist';
      const contentTitle = content.title.replace(/[^a-zA-Z0-9]/g, '_') || 'content';
      const filename = `${artistName}_${contentTitle}.${extensionFor(content.format, content.fileUrl)}`;

      logger.info('Content downloaded', { userId: req.userId, contentId: id });

      return await proxyMedia(request, source, {
        contentType: mimeFor(content.format, content.fileUrl),
        disposition: { attachment: filename },
      });
    } catch (error) {
      logger.error('Content download error', { contentId: id }, error as Error);
      return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
  });
}

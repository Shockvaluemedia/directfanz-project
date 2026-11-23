import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withStreamingAccess } from '@/middleware/content-access';
import { mimeFromExtension, proxyMedia, resolveMediaSource } from '@/lib/media-proxy';
import { signedUrlTtl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Serves a content row's thumbnail. Thumbnails stored in the private bucket
 * are not browser URLs, so clients are given this route instead.
 *
 * The same rules as the content teaser apply: a thumbnail of a gated image is
 * a downscaled copy of the paid image, and a private row is the owner's
 * alone, so both need content access. Other thumbnails (cover art for gated
 * audio or video) are marketing and are served to anyone.
 */
async function serve(request: NextRequest, id: string, head: boolean): Promise<Response> {
  try {
    const content = await prisma.content.findUnique({
      where: { id },
      select: { thumbnailUrl: true, type: true, visibility: true },
    });
    if (!content?.thumbnailUrl) {
      return new Response('Thumbnail not found', { status: 404 });
    }

    const source = resolveMediaSource(content.thumbnailUrl);
    if (!source) {
      logger.warn('Thumbnail source cannot be served', { contentId: id });
      return new Response('Thumbnail unavailable', { status: 502 });
    }

    const gated =
      content.visibility === 'PRIVATE' || (content.type === 'IMAGE' && content.visibility !== 'PUBLIC');

    const send = () =>
      proxyMedia(request, source, {
        contentType: mimeFromExtension(content.thumbnailUrl as string),
        disposition: 'inline',
        head,
        cacheControl: gated ? 'private, no-store' : 'public, max-age=300',
        signedUrlTtlSeconds: signedUrlTtl.download(),
      });

    return gated ? withStreamingAccess(request, id, send) : send();
  } catch (error) {
    logger.error('Thumbnail error', { contentId: id }, error as Error);
    return new Response('Thumbnail failed', { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return serve(request, id, false);
}

export async function HEAD(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return serve(request, id, true);
}

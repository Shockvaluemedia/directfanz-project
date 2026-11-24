import { NextRequest } from 'next/server';
import { withStreamingAccess } from '@/middleware/content-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { mimeFor, proxyMedia, resolveMediaSource } from '@/lib/media-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const select = { fileUrl: true, format: true, type: true, title: true } as const;

/**
 * Plays gated media after an access check on every request. A private S3 file
 * is answered with a redirect to a short-lived signed link; an older public
 * Blob URL is proxied, never redirected or handed out, because anyone holding
 * it could share it around the paywall.
 */
async function serve(request: NextRequest, id: string, head: boolean): Promise<Response> {
  return withStreamingAccess(request, id, async () => {
    try {
      const content = await prisma.content.findUnique({ where: { id }, select });
      if (!content) {
        return new Response('Content not found', { status: 404 });
      }

      const source = resolveMediaSource(content.fileUrl);
      if (!source) {
        logger.warn('Content media source cannot be proxied', { contentId: id });
        return new Response('Media unavailable', { status: 502 });
      }

      return await proxyMedia(request, source, {
        contentType: mimeFor(content.format, content.fileUrl),
        disposition: 'inline',
        head,
      });
    } catch (error) {
      logger.error('Content streaming error', { contentId: id }, error as Error);
      return new Response('Streaming failed', { status: 500 });
    }
  });
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return serve(request, id, false);
}

export async function HEAD(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return serve(request, id, true);
}

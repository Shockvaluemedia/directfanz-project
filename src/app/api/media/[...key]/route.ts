import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withStreamingAccess } from '@/middleware/content-access';
import { mimeFromExtension, proxyMedia, type ProxyOptions } from '@/lib/media-proxy';
import { isSafeKey, keyArea, signedUrlTtl, toMediaPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Serves files the browser loads directly (avatars, covers, banners, stream
 * and content thumbnails, challenge entries, message attachments). Rows store
 * this route's path, `/api/media/<key>`, so every API that returns them hands
 * out a working link. Who may read a file is decided by the key's area:
 *
 * - public/  anyone
 * - content/ only a content row's thumbnail; the row's own rules apply (a
 *            gated image's thumbnail needs content access)
 * - private/ the uploader, and the two people in a conversation whose message
 *            carries it
 *
 * A permitted request is answered with a redirect to a short-lived signed
 * link; the bucket itself stays private.
 */
async function serve(request: NextRequest, segments: string[], head: boolean): Promise<Response> {
  const key = segments.join('/');
  if (!isSafeKey(key)) return new Response('Not found', { status: 404 });
  const area = keyArea(key);
  const path = toMediaPath(key);

  const options = (gated: boolean): ProxyOptions => ({
    contentType: mimeFromExtension(key),
    disposition: 'inline',
    head,
    cacheControl: gated ? 'private, no-store' : 'public, max-age=3600',
    signedUrlTtlSeconds: gated ? signedUrlTtl.download() : signedUrlTtl.stream(),
  });
  const send = (gated: boolean) => proxyMedia(request, { kind: 'object', key }, options(gated));

  try {
    if (area === 'public') return await send(false);

    if (area === 'content') {
      const content = await prisma.content.findFirst({
        where: { thumbnailUrl: path },
        select: { id: true, type: true, visibility: true },
      });
      if (!content) return new Response('Not found', { status: 404 });
      const gated =
        content.visibility === 'PRIVATE' || (content.type === 'IMAGE' && content.visibility !== 'PUBLIC');
      return gated ? await withStreamingAccess(request, content.id, () => send(true)) : await send(false);
    }

    if (area === 'private') {
      const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
      const viewerId = session?.user?.id;
      if (!viewerId) return new Response('Authentication required', { status: 401 });
      const uploader = key.split('/')[1];
      if (uploader !== viewerId) {
        const message = await prisma.messages.findFirst({
          where: { attachmentUrl: path, OR: [{ senderId: viewerId }, { recipientId: viewerId }] },
          select: { id: true },
        });
        if (!message) return new Response('Not found', { status: 404 });
      }
      return await send(true);
    }

    return new Response('Not found', { status: 404 });
  } catch (error) {
    logger.error('Media route error', { area }, error as Error);
    return new Response('Media unavailable', { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ key: string[] }> }) {
  const { key } = await props.params;
  return serve(request, key, false);
}

export async function HEAD(request: NextRequest, props: { params: Promise<{ key: string[] }> }) {
  const { key } = await props.params;
  return serve(request, key, true);
}

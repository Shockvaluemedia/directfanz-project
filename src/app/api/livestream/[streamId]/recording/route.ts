import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { canViewStream, STREAM_ACCESS_SELECT } from '@/lib/stream-access';
import { mimeFromExtension, proxyMedia, resolveMediaSource } from '@/lib/media-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Plays a stream's or listening party's recording through the app. The stored
 * recordingUrl is a permanent storage URL, so it is never handed to anyone but
 * the artist; everyone else goes through here, where the same rule as the live
 * stream applies on every request (a ticket for a ticketed party, a tier for a
 * members-only stream).
 */
async function serve(request: NextRequest, streamId: string, head: boolean): Promise<Response> {
  try {
    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      select: { ...STREAM_ACCESS_SELECT, recordingUrl: true },
    });
    if (!stream || !stream.recordingUrl) {
      return new Response('Recording not found', { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const userId = (session?.user?.id as string | undefined) ?? null;
    if (!(await canViewStream(userId, stream))) {
      return userId
        ? new Response('Access denied', { status: 403 })
        : new Response('Authentication required', { status: 401 });
    }

    const source = resolveMediaSource(stream.recordingUrl);
    if (!source) {
      logger.warn('Stream recording cannot be proxied', { streamId });
      return new Response('Recording unavailable', { status: 502 });
    }

    return await proxyMedia(request, source, {
      contentType: mimeFromExtension(stream.recordingUrl),
      disposition: 'inline',
      head,
    });
  } catch (error) {
    logger.error('Stream recording error', { streamId }, error as Error);
    return new Response('Recording playback failed', { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await props.params;
  return serve(request, streamId, false);
}

export async function HEAD(request: NextRequest, props: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await props.params;
  return serve(request, streamId, true);
}

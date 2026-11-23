import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { canViewStream, STREAM_ACCESS_SELECT } from '@/lib/stream-access';
import { createPlaybackToken, isIvsEnabled, signedPlaybackUrl } from '@/lib/ivs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/livestream/:streamId/playback - a short-lived signed IVS playback
 * URL for a fan who may watch: a ticket holder, a member of a tier the party
 * names, or the artist. Everyone else gets nothing to play.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await props.params;
  try {
    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      select: { ...STREAM_ACCESS_SELECT, status: true, ivsChannelArn: true, ivsPlaybackUrl: true },
    });
    if (!stream) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404, headers: NO_STORE });
    }

    const session = await getServerSession(authOptions);
    const userId = (session?.user?.id as string | undefined) ?? null;
    if (!(await canViewStream(userId, stream))) {
      return userId
        ? NextResponse.json({ error: 'A ticket is needed to watch' }, { status: 403, headers: NO_STORE })
        : NextResponse.json({ error: 'Sign in to watch' }, { status: 401, headers: NO_STORE });
    }

    if (stream.status === 'ENDED' || stream.status === 'CANCELLED') {
      return NextResponse.json(
        { data: { status: stream.status, playbackUrl: null } },
        { headers: NO_STORE }
      );
    }

    if (!isIvsEnabled() || !stream.ivsChannelArn || !stream.ivsPlaybackUrl) {
      // The artist hasn't opened the broadcast page yet, or IVS is switched off.
      return NextResponse.json(
        { data: { status: stream.status, playbackUrl: null } },
        { headers: NO_STORE }
      );
    }

    const { token, expiresAt } = createPlaybackToken(stream.ivsChannelArn);
    return NextResponse.json(
      {
        data: {
          status: stream.status,
          playbackUrl: signedPlaybackUrl(stream.ivsPlaybackUrl, token),
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    logger.error('Party playback error', { streamId }, error as Error);
    return NextResponse.json({ error: 'Playback is unavailable' }, { status: 500, headers: NO_STORE });
  }
}

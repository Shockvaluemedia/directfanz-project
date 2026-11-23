import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getBroadcastDetails, IVS_CHANNEL_SELECT, IvsNotConfiguredError } from '@/lib/ivs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/livestream/:streamId/broadcast - the party's IVS ingest details
 * and stream key, for its artist only. Creates the party's private IVS
 * channel the first time. POST so the key is never cached or prefetched.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      select: { ...IVS_CHANNEL_SELECT, artistId: true, status: true },
    });
    if (!stream || stream.artistId !== userId) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404, headers: NO_STORE });
    }
    if (stream.status === 'ENDED' || stream.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'This party is over' },
        { status: 409, headers: NO_STORE }
      );
    }

    const details = await getBroadcastDetails(stream);
    return NextResponse.json({ data: details }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof IvsNotConfiguredError) {
      return NextResponse.json(
        { error: 'Live broadcasting is not set up yet' },
        { status: 503, headers: NO_STORE }
      );
    }
    logger.error('Party broadcast setup error', { streamId }, error as Error);
    return NextResponse.json(
      { error: 'Could not prepare the broadcast' },
      { status: 500, headers: NO_STORE }
    );
  }
}

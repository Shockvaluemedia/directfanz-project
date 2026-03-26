import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement, updateStreamStatus } from '@/lib/streaming-auth';
import { triggerStreamEvent } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement<any>(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      // Update stream status and set endedAt timestamp
      const updated = await updateStreamStatus(streamId, 'stopped');

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to stop stream' },
          { status: 500 }
        );
      }

      const endedAt = new Date();

      // Update endedAt in database and mark all viewers as left
      await Promise.all([
        prisma.live_streams.update({
          where: { id: streamId },
          data: { endedAt },
        }),
        prisma.stream_viewers.updateMany({
          where: { streamId, leftAt: null },
          data: { leftAt: endedAt },
        }),
      ]);

      // Notify subscribers via Pusher
      await triggerStreamEvent(streamId, 'stream-ended', {
        streamId,
        endedAt: endedAt.toISOString(),
      });

      return NextResponse.json({
        streamId,
        status: 'ENDED',
        message: 'Stream has ended',
        endedAt: endedAt.toISOString(),
      });
    } catch (error) {
      logger.error('Stream stop error', {}, error as Error);
      return NextResponse.json(
        { error: 'Failed to stop stream' },
        { status: 500 }
      );
    }
  });
}

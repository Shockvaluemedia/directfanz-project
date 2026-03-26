import { NextRequest } from 'next/server';
import { withStreamManagement, updateStreamStatus } from '@/lib/streaming-auth';
import { triggerStreamEvent } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement<any>(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return apiError('BAD_REQUEST', 'Stream ID is required');
      }

      // Update stream status and set endedAt timestamp
      const updated = await updateStreamStatus(streamId, 'stopped');

      if (!updated) {
        return apiError('INTERNAL_ERROR', 'Failed to stop stream');
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

      return apiSuccess({
        streamId,
        status: 'ENDED',
        message: 'Stream has ended',
        endedAt: endedAt.toISOString(),
      });
    } catch (error) {
      logger.error('Stream stop error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to stop stream');
    }
  });
}

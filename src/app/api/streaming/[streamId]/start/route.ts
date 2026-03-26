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

      // Update stream status and set startedAt timestamp
      const updated = await updateStreamStatus(streamId, 'running');

      if (!updated) {
        return apiError('INTERNAL_ERROR', 'Failed to start stream');
      }

      // Update startedAt in database
      await prisma.live_streams.update({
        where: { id: streamId },
        data: { startedAt: new Date() },
      });

      // Notify subscribers via Pusher
      await triggerStreamEvent(streamId, 'stream-started', {
        streamId,
        startedAt: new Date().toISOString(),
      });

      return apiSuccess({
        streamId,
        status: 'LIVE',
        message: 'Stream is live',
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Stream start error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to start stream');
    }
  });
}

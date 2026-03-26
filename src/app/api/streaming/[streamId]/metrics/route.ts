import { NextRequest } from 'next/server';
import { withStreamManagement, getStreamMetrics } from '@/lib/streaming-auth';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement<any>(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return apiError('BAD_REQUEST', 'Stream ID is required');
      }

      // Get stream metrics
      const metrics = await getStreamMetrics(streamId);

      if (!metrics) {
        return apiError('NOT_FOUND', 'Stream metrics not found');
      }

      return apiSuccess({
        streamId,
        metrics: {
          currentViewers: metrics.viewerCount,
          peakViewers: metrics.peakViewers,
          totalViews: metrics.totalViews,
          duration: metrics.duration,
          chatMessages: metrics.chatMessages,
          likes: metrics.likes,
        },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Stream metrics error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to get stream metrics');
    }
  });
}
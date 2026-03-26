import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement, getStreamMetrics } from '@/lib/streaming-auth';
import { logger } from '@/lib/logger';

export async function GET(
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

      // Get stream metrics
      const metrics = await getStreamMetrics(streamId);

      if (!metrics) {
        return NextResponse.json(
          { error: 'Stream metrics not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
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
      return NextResponse.json(
        { error: 'Failed to get stream metrics' },
        { status: 500 }
      );
    }
  });
}
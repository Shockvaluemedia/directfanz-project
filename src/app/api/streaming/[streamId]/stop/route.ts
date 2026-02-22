// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement, updateStreamStatus } from '@/lib/streaming-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      // TODO: Stop stream via WebSocket server
      // This would involve signaling the WebSocket server to stop the stream
      
      // Update stream status to stopping
      const updated = await updateStreamStatus(streamId, 'stopping');
      
      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to stop stream' },
          { status: 500 }
        );
      }

      // Simulate channel stop (in real implementation, this would be async)
      setTimeout(async () => {
        await updateStreamStatus(streamId, 'stopped');
      }, 3000);

      return NextResponse.json({
        streamId,
        status: 'stopping',
        message: 'Stream is shutting down',
        estimatedStopTime: new Date(Date.now() + 3000).toISOString(),
      });
    } catch (error) {
      console.error('Stream stop error:', error);
      return NextResponse.json(
        { error: 'Failed to stop stream' },
        { status: 500 }
      );
    }
  });
}
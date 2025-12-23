import { NextRequest, NextResponse } from 'next/server';
import { withFanStreaming, generateStreamAccessUrl, checkStreamAccess } from '@/lib/streaming-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withFanStreaming(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      // Check if user can access this stream
      const canAccess = await checkStreamAccess({
        streamId,
        userId: req.user.id,
        userRole: req.user.role,
        action: 'view'
      });

      if (!canAccess) {
        return NextResponse.json(
          { error: 'Access denied to this stream' },
          { status: 403 }
        );
      }

      // Generate signed access URL
      const accessUrl = await generateStreamAccessUrl(
        streamId,
        req.user.id,
        req.user.role,
        60 // 60 minutes expiration
      );

      if (!accessUrl) {
        return NextResponse.json(
          { error: 'Failed to generate stream access URL' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        streamId,
        accessUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        format: 'hls',
        quality: 'adaptive',
      });
    } catch (error) {
      console.error('Stream access error:', error);
      return NextResponse.json(
        { error: 'Failed to get stream access' },
        { status: 500 }
      );
    }
  });
}
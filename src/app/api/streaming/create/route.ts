import { NextRequest, NextResponse } from 'next/server';
import { withArtistStreaming, createStreamSession } from '@/lib/streaming-auth';

export async function POST(request: NextRequest) {
  return withArtistStreaming(request, async (req) => {
    try {
      const body = await request.json();
      const { title, description, isPrivate = false } = body;

      if (!title || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Stream title is required' },
          { status: 400 }
        );
      }

      if (title.length > 100) {
        return NextResponse.json(
          { error: 'Stream title must be 100 characters or less' },
          { status: 400 }
        );
      }

      // Create new stream session
      const streamSession = await createStreamSession(
        req.user.id,
        title.trim(),
        description?.trim()
      );

      if (!streamSession) {
        return NextResponse.json(
          { error: 'Failed to create stream session' },
          { status: 500 }
        );
      }

      // Return stream details (excluding sensitive information)
      return NextResponse.json({
        streamId: streamSession.streamId,
        title,
        description,
        status: streamSession.status,
        createdAt: new Date().toISOString(),
        rtmpUrl: `rtmp://medialive-input.${process.env.AWS_REGION}.amazonaws.com/live`,
        streamKey: streamSession.streamKey, // Only return to stream owner
      });
    } catch (error) {
      console.error('Stream creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create stream' },
        { status: 500 }
      );
    }
  });
}
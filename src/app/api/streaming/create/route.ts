import { NextRequest } from 'next/server';
import { withArtistStreaming, createStreamSession } from '@/lib/streaming-auth';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  return withArtistStreaming<any>(request, async (req) => {
    try {
      const body = await request.json();
      const { title, description, isPrivate = false } = body;

      if (!title || title.trim().length === 0) {
        return apiError('BAD_REQUEST', 'Stream title is required');
      }

      if (title.length > 100) {
        return apiError('BAD_REQUEST', 'Stream title must be 100 characters or less');
      }

      // Create new stream session
      const streamSession = await createStreamSession(
        req.user.id,
        title.trim(),
        description?.trim()
      );

      if (!streamSession) {
        return apiError('INTERNAL_ERROR', 'Failed to create stream session');
      }

      // Return stream details (excluding sensitive information)
      return apiSuccess({
        streamId: streamSession.streamId,
        title,
        description,
        status: streamSession.status,
        createdAt: new Date().toISOString(),
        wsUrl: `${process.env.WEBSOCKET_URL || 'wss://ws.directfanz.io'}/streaming`,
        streamKey: streamSession.streamKey, // Only return to stream owner
      });
    } catch (error) {
      logger.error('Stream creation error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to create stream');
    }
  });
}
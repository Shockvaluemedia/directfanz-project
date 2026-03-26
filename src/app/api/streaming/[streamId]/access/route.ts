import { NextRequest } from 'next/server';
import { withFanStreaming, generateStreamAccessUrl, checkStreamAccess } from '@/lib/streaming-auth';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withFanStreaming<any>(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return apiError('BAD_REQUEST', 'Stream ID is required');
      }

      // Check if user can access this stream
      const canAccess = await checkStreamAccess({
        streamId,
        userId: req.user.id,
        userRole: req.user.role,
        action: 'view'
      });

      if (!canAccess) {
        return apiError('FORBIDDEN', 'Access denied to this stream');
      }

      // Generate signed access URL
      const accessUrl = await generateStreamAccessUrl(
        streamId,
        req.user.id,
        req.user.role,
        60 // 60 minutes expiration
      );

      if (!accessUrl) {
        return apiError('INTERNAL_ERROR', 'Failed to generate stream access URL');
      }

      return apiSuccess({
        streamId,
        accessUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        format: 'hls',
        quality: 'adaptive',
      });
    } catch (error) {
      logger.error('Stream access error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to get stream access');
    }
  });
}
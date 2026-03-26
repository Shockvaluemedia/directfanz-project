import { NextRequest } from 'next/server';
import { withStreamManagement } from '@/lib/streaming-auth';
import { prisma } from '@/lib/prisma';
import { createVodJob, getVodUrl } from '@/lib/vod-service';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement<any>(request, async (req) => {
    try {
      const { streamId } = params;
      const body = await request.json();
      const { recordingKey, title, description } = body;

      if (!streamId || !recordingKey) {
        return apiError('BAD_REQUEST', 'Stream ID and recording key are required');
      }

      // Verify the stream exists and belongs to the user
      const stream = await prisma.live_streams.findFirst({
        where: { id: streamId, artistId: req.user.id },
        select: { id: true, title: true },
      });

      if (!stream) {
        return apiError('NOT_FOUND', 'Stream not found');
      }

      // Submit MediaConvert job
      const job = await createVodJob({
        streamId,
        inputKey: recordingKey,
        title: title || `VOD from ${stream.title}`,
        userId: req.user.id,
      });

      logger.info('VOD conversion started', {
        streamId,
        jobId: job.jobId,
        userId: req.user.id,
      });

      return apiSuccess({
        vodId: job.jobId,
        status: job.status,
        title: title || `VOD from ${stream.title}`,
        description: description || '',
        message: 'VOD conversion started. Processing will complete in a few minutes.',
      });
    } catch (error) {
      logger.error('VOD conversion error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to start VOD conversion');
    }
  });
}

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

      // Get all VOD recordings for this stream
      const vodRecords = await prisma.stream_recordings.findMany({
        where: { streamId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          videoUrl: true,
          thumbnailUrl: true,
          duration: true,
          fileSize: true,
          quality: true,
          format: true,
          status: true,
          processedAt: true,
          isPublic: true,
          createdAt: true,
        },
      });

      // Also get the playback URL for the latest ready recording
      const playbackUrl = await getVodUrl(streamId);

      return apiSuccess({
        streamId,
        vodRecords,
        totalCount: vodRecords.length,
        playbackUrl,
      });
    } catch (error) {
      logger.error('VOD retrieval error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to retrieve VOD records');
    }
  });
}

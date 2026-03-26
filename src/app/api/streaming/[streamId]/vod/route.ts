import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement } from '@/lib/streaming-auth';
import { prisma } from '@/lib/prisma';
import { createVodJob, getVodUrl } from '@/lib/vod-service';
import { logger } from '@/lib/logger';

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
        return NextResponse.json(
          { error: 'Stream ID and recording key are required' },
          { status: 400 }
        );
      }

      // Verify the stream exists and belongs to the user
      const stream = await prisma.live_streams.findFirst({
        where: { id: streamId, artistId: req.user.id },
        select: { id: true, title: true },
      });

      if (!stream) {
        return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
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

      return NextResponse.json({
        vodId: job.jobId,
        status: job.status,
        title: title || `VOD from ${stream.title}`,
        description: description || '',
        message: 'VOD conversion started. Processing will complete in a few minutes.',
      });
    } catch (error) {
      logger.error('VOD conversion error', {}, error as Error);
      return NextResponse.json(
        { error: 'Failed to start VOD conversion' },
        { status: 500 }
      );
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
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
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

      return NextResponse.json({
        streamId,
        vodRecords,
        totalCount: vodRecords.length,
        playbackUrl,
      });
    } catch (error) {
      logger.error('VOD retrieval error', {}, error as Error);
      return NextResponse.json(
        { error: 'Failed to retrieve VOD records' },
        { status: 500 }
      );
    }
  });
}

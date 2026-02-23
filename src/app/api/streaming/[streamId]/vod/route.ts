import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement } from '@/lib/streaming-auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement<any>(request, async (req) => {
    try {
      const { streamId } = params;
      const body = await request.json();
      const { recordingKey, title, description, videoUrl, duration = 0, fileSize = 0, quality = 'HD', format = 'mp4' } = body;

      if (!streamId || !recordingKey) {
        return NextResponse.json(
          { error: 'Stream ID and recording key are required' },
          { status: 400 }
        );
      }

      // Store VOD record in stream_recordings table.
      // Raw recording URL is stored directly; transcoding can be added later via Mux or Cloudflare Stream.
      const vodRecord = await prisma.stream_recordings.create({
        data: {
          id: crypto.randomUUID(),
          streamId,
          videoUrl: videoUrl || recordingKey,
          duration,
          fileSize,
          quality,
          format,
          status: 'PROCESSING',
          isPublic: false,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        vodId: vodRecord.id,
        status: vodRecord.status,
        title: title || `VOD from Stream ${streamId}`,
        description: description || '',
        message: 'VOD record created. Raw recording stored for playback.',
      });
    } catch (error) {
      console.error('VOD conversion error:', error);
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
  return withStreamManagement<any>(request, async (_req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      const vodRecords = await prisma.stream_recordings.findMany({
        where: { streamId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        streamId,
        vodRecords,
        totalCount: vodRecords.length,
      });
    } catch (error) {
      console.error('VOD retrieval error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve VOD records' },
        { status: 500 }
      );
    }
  });
}

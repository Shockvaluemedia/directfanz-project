// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement } from '@/lib/streaming-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement(request, async (req) => {
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

      // TODO: Implement VOD conversion with a Vercel-compatible transcoding service
      // Previous implementation used AWS MediaConvert which is no longer available.
      // Options: use a third-party transcoding API (e.g., Mux, Cloudflare Stream)
      // or store the raw recording directly for playback.

      const vodRecord = {
        id: crypto.randomUUID(),
        streamId,
        userId: req.user.id,
        title: title || `VOD from Stream ${streamId}`,
        description: description || '',
        status: 'pending',
        recordingKey,
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        vodId: vodRecord.id,
        status: 'pending',
        title: vodRecord.title,
        description: vodRecord.description,
        message: 'VOD conversion queued. Transcoding service integration pending.',
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
  return withStreamManagement(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      // TODO: Get VOD records from database
      const vodRecords: any[] = [];

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

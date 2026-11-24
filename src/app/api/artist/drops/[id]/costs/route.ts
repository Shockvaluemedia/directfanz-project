import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withArtistApi } from '@/lib/api-auth';
import { DropError, toCents } from '@/lib/drops';
import { releaseCostsSchema, setReleaseCosts } from '@/lib/release-report';

// PUT /api/artist/drops/:id/costs - what one of the artist's releases cost, in dollars
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withArtistApi(request, async req => {
    try {
      const input = releaseCostsSchema.parse(await request.json());
      const saved = await setReleaseCosts(req.user.id, id, input);

      return NextResponse.json({
        success: true,
        data: {
          dropId: saved.id,
          recording: toCents(saved.costRecording) / 100,
          video: toCents(saved.costVideo) / 100,
          marketing: toCents(saved.costMarketing) / 100,
          other: toCents(saved.costOther) / 100,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof DropError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }
      console.error('Error saving release costs:', error);
      return NextResponse.json({ success: false, error: 'Failed to save costs' }, { status: 500 });
    }
  });
}

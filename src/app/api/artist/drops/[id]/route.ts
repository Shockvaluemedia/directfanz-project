import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withArtistApi } from '@/lib/api-auth';
import { DropError, toPublicDrop, updateDrop, updateDropSchema } from '@/lib/drops';

// PATCH /api/artist/drops/:id - edit, publish or archive one of the artist's drops.
// Price and content are locked after the first sale.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withArtistApi(request, async req => {
    try {
      const input = updateDropSchema.parse(await request.json());
      const drop = await updateDrop(req.user.id, id, input);

      return NextResponse.json({
        success: true,
        data: {
          ...toPublicDrop(drop),
          status: drop.status,
          soldCount: drop.soldCount,
          reservedCount: drop.reservedCount,
          contentIds: drop.drop_content.map(c => c.contentId),
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
      console.error('Error updating drop:', error);
      return NextResponse.json({ success: false, error: 'Failed to update drop' }, { status: 500 });
    }
  });
}

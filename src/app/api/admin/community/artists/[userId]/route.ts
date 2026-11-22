import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { CommunityError, placeArtist, placeArtistSchema } from '@/lib/community';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// PATCH /api/admin/community/artists/:userId - set an artist's community and
// place on the home page; featuredRank 1 headlines (admins only)
export async function PATCH(request: NextRequest, props: RouteParams) {
  const { userId } = await props.params;
  return withAdminApi(request, async req => {
    try {
      const input = placeArtistSchema.parse(await req.json());
      const artist = await placeArtist(userId, input);
      return NextResponse.json({ data: artist });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof CommunityError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('Error placing artist:', error);
      return NextResponse.json({ error: 'Failed to update artist' }, { status: 500 });
    }
  });
}

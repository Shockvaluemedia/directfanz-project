import { NextRequest, NextResponse } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { listFanListMembers } from '@/lib/fan-list';

// GET /api/artist/fan-list?cursor=&limit= - the signed-in artist's subscribed fans
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const params = request.nextUrl.searchParams;
      const limit = Number(params.get('limit') ?? 50);
      const result = await listFanListMembers(req.user.id, {
        cursor: params.get('cursor') || undefined,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching fan list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch fan list' },
        { status: 500 }
      );
    }
  });
}

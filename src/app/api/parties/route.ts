import { NextRequest, NextResponse } from 'next/server';
import { listUpcomingParties } from '@/lib/parties';

// GET /api/parties?artistId=... - an artist's ticketed listening parties that
// are coming up or live, for their page. Public: no stream keys or viewers.
export async function GET(request: NextRequest) {
  try {
    const artistId = request.nextUrl.searchParams.get('artistId');
    if (!artistId) {
      return NextResponse.json({ error: 'artistId is required' }, { status: 400 });
    }
    return NextResponse.json({ data: await listUpcomingParties(artistId) });
  } catch (error) {
    console.error('Error listing parties:', error);
    return NextResponse.json({ error: 'Failed to list parties' }, { status: 500 });
  }
}

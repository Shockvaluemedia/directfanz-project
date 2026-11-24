import { NextResponse } from 'next/server';
import { getCommunityHome } from '@/lib/community';

export const dynamic = 'force-dynamic';

// GET /api/community - the community home: artists (headliner first), drops, parties
export async function GET() {
  try {
    const home = await getCommunityHome();
    if (!home) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }
    return NextResponse.json({ data: home });
  } catch (error) {
    console.error('Error loading community home:', error);
    return NextResponse.json({ error: 'Failed to load community' }, { status: 500 });
  }
}

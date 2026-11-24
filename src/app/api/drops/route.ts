import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DROP_STATUS, toPublicDrop } from '@/lib/drops';

// GET /api/drops?artistId=... - an artist's published drops, for their page
export async function GET(request: NextRequest) {
  try {
    const artistId = request.nextUrl.searchParams.get('artistId');
    if (!artistId) {
      return NextResponse.json({ error: 'artistId is required' }, { status: 400 });
    }

    const drops = await prisma.drops.findMany({
      where: { artistId, status: DROP_STATUS.PUBLISHED },
      orderBy: { startsAt: 'desc' },
      take: 50,
      include: { drop_content: { select: { contentId: true } } },
    });

    return NextResponse.json({ data: drops.map(toPublicDrop) });
  } catch (error) {
    console.error('Error listing drops:', error);
    return NextResponse.json({ error: 'Failed to list drops' }, { status: 500 });
  }
}

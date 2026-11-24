import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DROP_STATUS, toPublicDrop } from '@/lib/drops';
import { hasPaidPurchase } from '@/lib/purchases';

// GET /api/drops/:id - what a fan sees before buying: title, price, window,
// what's left, and whether they already own it. No file URLs.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const drop = await prisma.drops.findUnique({
      where: { id },
      include: { drop_content: { select: { contentId: true } } },
    });

    if (!drop || drop.status === DROP_STATUS.DRAFT) {
      return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const owned = session?.user?.id
      ? await hasPaidPurchase(session.user.id, 'DROP', drop.id)
      : false;

    return NextResponse.json({ data: { ...toPublicDrop(drop), owned } });
  } catch (error) {
    console.error('Error fetching drop:', error);
    return NextResponse.json({ error: 'Failed to fetch drop' }, { status: 500 });
  }
}

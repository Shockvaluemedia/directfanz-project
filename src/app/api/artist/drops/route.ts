import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withArtistApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { createDrop, createDropSchema, DropError, toPublicDrop } from '@/lib/drops';

// GET /api/artist/drops - the signed-in artist's drops, newest first
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const drops = await prisma.drops.findMany({
        where: { artistId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: { drop_content: { select: { contentId: true } } },
      });

      return NextResponse.json({
        success: true,
        data: drops.map(drop => ({
          ...toPublicDrop(drop),
          status: drop.status,
          soldCount: drop.soldCount,
          quantityLimit: drop.quantityLimit,
          contentIds: drop.drop_content.map(c => c.contentId),
        })),
      });
    } catch (error) {
      console.error('Error fetching artist drops:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch drops' }, { status: 500 });
    }
  });
}

// POST /api/artist/drops - create a drop (DRAFT unless status PUBLISHED is sent)
export async function POST(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const input = createDropSchema.parse(await request.json());
      const drop = await createDrop(req.user.id, input);

      return NextResponse.json(
        {
          success: true,
          data: {
            ...toPublicDrop(drop),
            status: drop.status,
            contentIds: drop.drop_content.map(c => c.contentId),
          },
        },
        { status: 201 }
      );
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
      console.error('Error creating drop:', error);
      return NextResponse.json({ success: false, error: 'Failed to create drop' }, { status: 500 });
    }
  });
}

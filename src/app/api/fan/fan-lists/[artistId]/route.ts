import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { isSmsEnabled } from '@/lib/sms';
import {
  FanListError,
  getFanListStatus,
  joinFanList,
  leaveFanList,
  smsConsentText,
} from '@/lib/fan-list';

type Params = { params: Promise<{ artistId: string }> };

// Joining needs an explicit yes from the fan; the client sends it when they
// tick or press "Join the list".
const joinSchema = z.object({ consent: z.literal(true) }).strict();

function fanListErrorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { success: false, error: 'Consent is required to join the list', details: error.errors },
      { status: 400 }
    );
  }
  if (error instanceof FanListError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

// GET /api/fan/fan-lists/:artistId - the signed-in user's email and text
// opt-ins for this artist, and the words to show before a text opt-in.
export async function GET(request: NextRequest, { params }: Params) {
  const { artistId } = await params;
  return withApi(request, async req => {
    try {
      const artist = await prisma.users.findUnique({
        where: { id: artistId },
        select: { role: true, displayName: true },
      });
      if (!artist || artist.role !== 'ARTIST') {
        throw new FanListError('Artist not found', 404);
      }
      const smsAvailable = isSmsEnabled();
      return NextResponse.json({
        success: true,
        data: {
          ...(await getFanListStatus(artistId, req.user.id)),
          smsAvailable,
          smsConsentText: smsAvailable ? smsConsentText(artist.displayName) : null,
        },
      });
    } catch (error) {
      return fanListErrorResponse(error, 'Failed to check fan list');
    }
  });
}

// POST /api/fan/fan-lists/:artistId - join the artist's email list (and follow them)
export async function POST(request: NextRequest, { params }: Params) {
  const { artistId } = await params;
  return withApi(request, async req => {
    try {
      joinSchema.parse(await request.json());
      await joinFanList(artistId, req.user.id, 'SIGNUP');
      return NextResponse.json({
        success: true,
        data: await getFanListStatus(artistId, req.user.id),
      });
    } catch (error) {
      return fanListErrorResponse(error, 'Failed to join fan list');
    }
  });
}

// DELETE /api/fan/fan-lists/:artistId - leave the list: no more email or texts
export async function DELETE(request: NextRequest, { params }: Params) {
  const { artistId } = await params;
  return withApi(request, async req => {
    try {
      await leaveFanList(artistId, req.user.id);
      return NextResponse.json({ success: true, data: { email: false, sms: false } });
    } catch (error) {
      return fanListErrorResponse(error, 'Failed to leave fan list');
    }
  });
}

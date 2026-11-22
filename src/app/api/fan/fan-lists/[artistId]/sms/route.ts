import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api-auth';
import { FanListError, getFanListStatus, optInToSms, optOutOfSms } from '@/lib/fan-list';

type Params = { params: Promise<{ artistId: string }> };

// Text opt-in is separate from email: the fan gives a number and ticks a box
// showing the consent words from GET /api/fan/fan-lists/:artistId.
const smsOptInSchema = z
  .object({ phone: z.string().min(7).max(32), consent: z.literal(true) })
  .strict();

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { success: false, error: 'A mobile number and consent are required', details: error.errors },
      { status: 400 }
    );
  }
  if (error instanceof FanListError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

// POST /api/fan/fan-lists/:artistId/sms - opt in to the artist's texts
export async function POST(request: NextRequest, { params }: Params) {
  const { artistId } = await params;
  return withApi(request, async req => {
    try {
      const { phone } = smsOptInSchema.parse(await request.json());
      await optInToSms(artistId, req.user.id, phone);
      return NextResponse.json({
        success: true,
        data: await getFanListStatus(artistId, req.user.id),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to sign up for texts');
    }
  });
}

// DELETE /api/fan/fan-lists/:artistId/sms - stop the artist's texts
export async function DELETE(request: NextRequest, { params }: Params) {
  const { artistId } = await params;
  return withApi(request, async req => {
    try {
      await optOutOfSms(artistId, req.user.id);
      return NextResponse.json({
        success: true,
        data: await getFanListStatus(artistId, req.user.id),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to stop texts');
    }
  });
}

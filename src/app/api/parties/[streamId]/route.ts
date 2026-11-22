import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getParty } from '@/lib/parties';

// GET /api/parties/:streamId - a ticketed listening party's public details,
// plus hasTicket and canWatch for the signed-in fan. Buying a ticket goes
// through POST /api/payments/purchase-checkout with itemType LIVE_STREAM_TICKET.
export async function GET(_request: NextRequest, props: { params: Promise<{ streamId: string }> }) {
  try {
    const { streamId } = await props.params;
    const session = await getServerSession(authOptions);
    const party = await getParty(streamId, session?.user?.id);
    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }
    return NextResponse.json({ data: party });
  } catch (error) {
    console.error('Error loading party:', error);
    return NextResponse.json({ error: 'Failed to load party' }, { status: 500 });
  }
}

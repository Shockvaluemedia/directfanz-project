import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { applyIvsStreamEvent, IvsStreamStateEvent } from '@/lib/ivs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/ivs - "IVS Stream State Change" events, sent by an
 * EventBridge rule through an API destination whose connection adds
 * `Authorization: Bearer <secret>`, where the secret is IVS_EVENTS_SECRET or,
 * when that is unset, CRON_SECRET (so the cron routes' EventBridge connection
 * can be reused). Marks a party live when its stream starts and over when it
 * ends. Off (404) until one of them is set.
 */
export async function POST(request: NextRequest) {
  const auth = checkCronAuth(
    request.headers.get('authorization'),
    process.env.IVS_EVENTS_SECRET || process.env.CRON_SECRET
  );
  if (auth === 'off') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (auth === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event: IvsStreamStateEvent;
  try {
    event = (await request.json()) as IvsStreamStateEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const outcome = await applyIvsStreamEvent(event);
    if (outcome === 'unknown-channel') {
      logger.warn('IVS event for a channel no party owns');
    }
    return NextResponse.json({ outcome });
  } catch (error) {
    logger.error('IVS event handling failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

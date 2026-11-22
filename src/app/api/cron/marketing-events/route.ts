import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { deliverDueMarketingEvents } from '@/lib/marketing-events';

// Retries marketing events whose first send failed, with backoff, and prunes
// old delivered ones. Meant to be called on a schedule (for example a Vercel
// cron every 5 minutes) with `Authorization: Bearer <CRON_SECRET>`.
// Switched off (404) until CRON_SECRET is set.

export const dynamic = 'force-dynamic';

async function run(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get('authorization'));
  if (auth === 'off') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await deliverDueMarketingEvents();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Marketing event delivery run failed:', error);
    return NextResponse.json({ error: 'Delivery run failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

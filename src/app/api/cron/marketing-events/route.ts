import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { deliverDueMarketingEvents } from '@/lib/marketing-events';

// Retries marketing events whose first send failed, with backoff, and prunes
// old delivered ones. Meant to be called on a schedule (for example a Vercel
// cron every 5 minutes) with `Authorization: Bearer <CRON_SECRET>`.
// Switched off (404) until CRON_SECRET is set.

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest, secret: string): boolean {
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!authorized(request, secret)) {
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

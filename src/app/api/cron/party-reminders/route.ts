import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { sendPartyReminders } from '@/lib/parties';

// Emails ticket holders of listening parties starting within the hour, once
// each. Meant to be called on a schedule (for example every 10 minutes) with
// `Authorization: Bearer <CRON_SECRET>`. Switched off (404) until CRON_SECRET is set.

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.json(await sendPartyReminders(baseUrl));
  } catch (error) {
    console.error('Party reminder run failed:', error);
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

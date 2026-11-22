import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleInboundSms } from '@/lib/fan-list';

// Texts fans send to the DirectFanz number (STOP, HELP). Provider-neutral:
// the provider is configured to POST { from, body } (JSON or form fields
// From/Body) to /api/webhooks/sms/inbound?token=<SMS_INBOUND_TOKEN>.
// Switched off (404) until SMS_INBOUND_TOKEN is set. When a real provider is
// chosen, its adapter should also verify the provider's own request signature.

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readMessage(request: NextRequest): Promise<{ from: string; body: string } | null> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const json = await request.json().catch(() => null);
    if (!json || typeof json.from !== 'string' || typeof json.body !== 'string') return null;
    return { from: json.from, body: json.body };
  }
  const form = await request.formData().catch(() => null);
  const from = form?.get('From') ?? form?.get('from');
  const body = form?.get('Body') ?? form?.get('body') ?? form?.get('text');
  if (typeof from !== 'string' || typeof body !== 'string') return null;
  return { from, body };
}

export async function POST(request: NextRequest) {
  const expected = process.env.SMS_INBOUND_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const given = request.nextUrl.searchParams.get('token') ?? '';
  if (!tokenMatches(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const message = await readMessage(request);
  if (!message) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  try {
    const result = await handleInboundSms(message.from, message.body.slice(0, 1600));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Inbound SMS error:', error);
    return NextResponse.json({ error: 'Failed to handle message' }, { status: 500 });
  }
}

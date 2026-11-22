// These routes return HTML and CSV and read the query string, which the
// JSON-only global next/server mock can't do, so this file uses a small one.
jest.mock('next/server', () => {
  class NextResponse {
    status: number;
    headers: { get(name: string): string | null };
    constructor(
      private readonly payload: string,
      init: { status?: number; headers?: Record<string, string> } = {}
    ) {
      this.status = init.status ?? 200;
      const lower = Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      this.headers = { get: name => lower[name.toLowerCase()] ?? null };
    }
    async text() {
      return this.payload;
    }
    async json() {
      return JSON.parse(this.payload);
    }
    static json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      return new NextResponse(JSON.stringify(data), {
        ...init,
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      });
    }
  }
  return { NextResponse, NextRequest: class {} };
});

jest.mock('@/lib/api-auth', () => ({
  withApi: (req: any, handler: any) => handler({ ...req, user: { id: 'fan-1' } }),
  withArtistApi: (req: any, handler: any) => handler({ ...req, user: { id: 'artist-1' } }),
}));

import { prisma } from '@/lib/prisma';
import { GET as unsubscribePage, POST as unsubscribe } from '../unsubscribe/route';
import { POST as inboundSms } from '../../webhooks/sms/inbound/route';
import { POST as joinList } from '../../fan/fan-lists/[artistId]/route';
import { GET as exportList } from '../../artist/fan-list/export/route';

const db = prisma as any;

function request(url: string, init: { method?: string; body?: unknown; form?: boolean } = {}) {
  const headers: Record<string, string> = {};
  const fields = new Map<string, string>();
  if (init.body !== undefined) {
    headers['content-type'] = init.form ? 'application/x-www-form-urlencoded' : 'application/json';
    if (init.form) {
      Object.entries(init.body as Record<string, string>).forEach(([k, v]) => fields.set(k, v));
    }
  }
  return {
    method: init.method ?? 'POST',
    nextUrl: new URL(`https://app.test${url}`),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => init.body ?? {},
    formData: async () => ({ get: (name: string) => fields.get(name) ?? null }),
  } as any;
}

const originalToken = process.env.SMS_INBOUND_TOKEN;

beforeEach(() => {
  jest.clearAllMocks();
  db.fan_list_members.updateMany.mockResolvedValue({ count: 1 });
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.SMS_INBOUND_TOKEN;
  else process.env.SMS_INBOUND_TOKEN = originalToken;
});

describe('email unsubscribe link', () => {
  it('opening the link only shows a confirm button, so mail scanners do not unsubscribe', async () => {
    const res = await unsubscribePage(
      request('/api/fan-list/unsubscribe?token=tok_1', { method: 'GET' })
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('method="post"');
    expect(html).toContain('token=tok_1');
    expect(db.fan_list_members.updateMany).not.toHaveBeenCalled();
  });

  it('one-click POST unsubscribes and escapes the artist name', async () => {
    db.fan_list_members.findUnique.mockResolvedValue({
      id: 'm_1',
      emailUnsubscribedAt: null,
      artist: { displayName: '<Nahvee>' },
    });

    const res = await unsubscribe(
      request('/api/fan-list/unsubscribe?token=tok_1', {
        body: { 'List-Unsubscribe': 'One-Click' },
        form: true,
      })
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('&lt;Nahvee&gt;');
    expect(db.fan_list_members.updateMany).toHaveBeenCalled();
  });

  it('an unknown token is refused', async () => {
    db.fan_list_members.findUnique.mockResolvedValue(null);
    const res = await unsubscribe(request('/api/fan-list/unsubscribe?token=bad'));
    expect(res.status).toBe(404);
  });
});

describe('inbound texts', () => {
  it('is switched off until a token is set', async () => {
    delete process.env.SMS_INBOUND_TOKEN;
    const res = await inboundSms(
      request('/api/webhooks/sms/inbound?token=x', { body: { from: '+13125550100', body: 'STOP' } })
    );
    expect(res.status).toBe(404);
  });

  it('refuses a wrong token', async () => {
    process.env.SMS_INBOUND_TOKEN = 'secret-token';
    const res = await inboundSms(
      request('/api/webhooks/sms/inbound?token=wrong', {
        body: { from: '+13125550100', body: 'STOP' },
      })
    );
    expect(res.status).toBe(401);
    expect(db.fan_list_members.updateMany).not.toHaveBeenCalled();
  });

  it('handles STOP sent as provider form fields', async () => {
    process.env.SMS_INBOUND_TOKEN = 'secret-token';
    const res = await inboundSms(
      request('/api/webhooks/sms/inbound?token=secret-token', {
        body: { From: '+13125550100', Body: 'STOP' },
        form: true,
      })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe('stop');
    expect(db.fan_list_members.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { smsPhone: '+13125550100', smsUnsubscribedAt: null } })
    );
  });
});

describe('joining and exporting', () => {
  it('joining needs an explicit yes', async () => {
    const res = await joinList(request('/api/fan/fan-lists/artist-1', { body: {} }), {
      params: Promise.resolve({ artistId: 'artist-1' }),
    });
    expect(res.status).toBe(400);
    expect(db.fan_list_members.upsert).not.toHaveBeenCalled();
  });

  it('exports the artist’s own list as a CSV download', async () => {
    db.fan_list_members.findMany.mockResolvedValue([]);

    const res = await exportList(request('/api/artist/fan-list/export', { method: 'GET' }));

    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(db.fan_list_members.findMany.mock.calls[0][0].where.artistId).toBe('artist-1');
  });
});

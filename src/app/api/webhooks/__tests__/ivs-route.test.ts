jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {},
}));

jest.mock('@/lib/ivs', () => ({ applyIvsStreamEvent: jest.fn() }));

import { applyIvsStreamEvent } from '@/lib/ivs';
import { POST } from '../ivs/route';

const apply = applyIvsStreamEvent as jest.Mock;
const original = process.env.IVS_EVENTS_SECRET;
const originalCron = process.env.CRON_SECRET;

function request(authorization: string | null, body: unknown = {}) {
  return {
    headers: { get: () => authorization },
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.IVS_EVENTS_SECRET = 'events-secret';
  delete process.env.CRON_SECRET;
  apply.mockResolvedValue('live');
});

afterAll(() => {
  if (original === undefined) delete process.env.IVS_EVENTS_SECRET;
  else process.env.IVS_EVENTS_SECRET = original;
  if (originalCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCron;
});

describe('POST /api/webhooks/ivs', () => {
  it('is switched off until the secret is set', async () => {
    delete process.env.IVS_EVENTS_SECRET;
    const response: any = await POST(request('Bearer anything'));
    expect(response.status).toBe(404);
    expect(apply).not.toHaveBeenCalled();
  });

  it('uses CRON_SECRET when no events secret is set', async () => {
    delete process.env.IVS_EVENTS_SECRET;
    process.env.CRON_SECRET = 'cron-secret';
    expect(((await POST(request('Bearer events-secret'))) as any).status).toBe(401);
    const response: any = await POST(request('Bearer cron-secret', { source: 'aws.ivs' }));
    expect(response.status).toBe(200);
  });

  it('refuses a wrong or missing secret', async () => {
    expect(((await POST(request('Bearer wrong'))) as any).status).toBe(401);
    expect(((await POST(request(null))) as any).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it('applies a stream event sent with the secret', async () => {
    const event = { source: 'aws.ivs', detail: { event_name: 'Stream Start' } };
    const response: any = await POST(request('Bearer events-secret', event));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'live' });
    expect(apply).toHaveBeenCalledWith(event);
  });

  it('rejects a body that is not JSON', async () => {
    const response: any = await POST(request('Bearer events-secret', new Error('bad')));
    expect(response.status).toBe(400);
  });
});

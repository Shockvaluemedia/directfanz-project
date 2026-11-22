jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {},
}));

jest.mock('@/lib/marketing-events', () => ({ deliverDueMarketingEvents: jest.fn() }));

import { deliverDueMarketingEvents } from '@/lib/marketing-events';
import { GET } from '../marketing-events/route';

const deliver = deliverDueMarketingEvents as jest.Mock;
const original = process.env.CRON_SECRET;

function request(authorization?: string) {
  return { headers: { get: () => authorization ?? null } } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  deliver.mockResolvedValue({ enabled: true, attempted: 1, sent: 1, pruned: 0 });
});

afterAll(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe('marketing event delivery route', () => {
  it('is switched off until CRON_SECRET is set', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request('Bearer anything'));
    expect(res.status).toBe(404);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('refuses a wrong or missing secret', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    expect((await GET(request('Bearer wrong'))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('runs a delivery pass with the right secret', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const res = await GET(request('Bearer cron-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ attempted: 1, sent: 1 });
  });
});

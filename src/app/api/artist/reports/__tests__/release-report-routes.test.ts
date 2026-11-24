// The shared next/server mock has no NextResponse constructor; the CSV answer needs one.
jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(data: unknown, init: ResponseInit = {}) {
      return new NextResponse(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers as object) },
      });
    }
  }
  return { NextResponse };
});

jest.mock('@/lib/api-auth', () => ({
  withArtistApi: (req: any, handler: any) => handler({ ...req, user: { id: 'artist-1' } }),
  withAdminApi: (req: any, handler: any) => handler({ ...req, user: { id: 'admin-1' } }),
}));

import { prisma } from '@/lib/prisma';
import { GET as artistReport } from '../releases/route';
import { GET as adminReport } from '../../../admin/reports/releases/route';
import { PUT as putCosts } from '../../drops/[id]/costs/route';

const db = prisma as any;

const dropRow = {
  id: 'drop-1',
  artistId: 'artist-1',
  title: 'Single',
  status: 'PUBLISHED',
  currency: 'usd',
  startsAt: new Date('2026-12-01T00:00:00Z'),
  presaleStartsAt: null,
  costRecording: 100,
  costVideo: 0,
  costMarketing: 0,
  costOther: 0,
  users: { displayName: 'Nahvee' },
};

const get = (url: string) => ({ url }) as any;

describe('GET /api/artist/reports/releases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.drops.findMany.mockResolvedValue([dropRow]);
    db.purchases.findMany.mockResolvedValue([
      { itemId: 'drop-1', fanId: 'fan-1', amount: 10, platformFee: 1, status: 'PAID' },
    ]);
    db.subscriptions.findMany.mockResolvedValue([]);
  });

  it("returns the artist's report as JSON", async () => {
    const res = await artistReport(
      get('http://localhost/api/artist/reports/releases?fixedMonthly=0')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.drops.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artistId: 'artist-1' } })
    );
    expect(body.data.rows[0]).toMatchObject({
      dropId: 'drop-1',
      grossSalesCents: 1000,
      artistNetCents: 1000 - 100 - 59,
      profitCents: 841 - 10000,
    });
  });

  it('downloads a CSV', async () => {
    const res = await artistReport(get('http://localhost/api/artist/reports/releases?format=csv'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('release-report.csv');
    // The test Response stand-in keeps the raw body on .body.
    const text = String((res as any).body);
    expect(text.split('\r\n')[1]).toContain('Single');
  });

  it('refuses a bad monthly fixed cost', async () => {
    const res = await artistReport(
      get('http://localhost/api/artist/reports/releases?fixedMonthly=-5')
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/reports/releases', () => {
  it("reads every artist's drops", async () => {
    db.drops.findMany.mockResolvedValue([]);
    const res = await adminReport(get('http://localhost/api/admin/reports/releases'));
    expect(res.status).toBe(200);
    expect(db.drops.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('PUT /api/artist/drops/:id/costs', () => {
  beforeEach(() => jest.clearAllMocks());

  const req = (body: unknown) => ({ json: async () => body }) as any;
  const params = { params: Promise.resolve({ id: 'drop-1' }) };

  it('saves the costs and returns them in dollars', async () => {
    db.drops.findUnique.mockResolvedValue({ id: 'drop-1', artistId: 'artist-1' });
    db.drops.update.mockResolvedValue({
      id: 'drop-1',
      costRecording: 250,
      costVideo: 0,
      costMarketing: 40,
      costOther: 0,
    });

    const res = await putCosts(req({ recording: 250, marketing: 40 }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      dropId: 'drop-1',
      recording: 250,
      video: 0,
      marketing: 40,
      other: 0,
    });
  });

  it('rejects a negative cost', async () => {
    const res = await putCosts(req({ recording: -1 }), params);
    expect(res.status).toBe(400);
    expect(db.drops.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another artist's drop", async () => {
    db.drops.findUnique.mockResolvedValue({ id: 'drop-1', artistId: 'someone-else' });
    const res = await putCosts(req({ other: 1 }), params);
    expect(res.status).toBe(404);
  });
});

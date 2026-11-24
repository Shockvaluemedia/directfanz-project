import { prisma } from '@/lib/prisma';
import {
  allocateFixedCosts,
  buildReleaseReport,
  countNewMembers,
  estimateStripeFeeCents,
  loadReleaseReport,
  parseFixedMonthlyCents,
  releaseCostsSchema,
  releaseReportToCsv,
  releaseWindow,
  setReleaseCosts,
  summarizeSales,
  type ReportDrop,
  type ReportPurchase,
} from '@/lib/release-report';

const db = prisma as any;
const DAY = 24 * 60 * 60 * 1000;
const d = (iso: string) => new Date(iso);

const drop = (overrides: Partial<ReportDrop> = {}): ReportDrop => ({
  id: 'drop-1',
  artistId: 'artist-1',
  title: 'Nahvee Single',
  status: 'PUBLISHED',
  currency: 'usd',
  startsAt: d('2026-12-01T00:00:00Z'),
  presaleStartsAt: d('2026-11-24T00:00:00Z'),
  costRecording: 0,
  costVideo: 0,
  costMarketing: 0,
  costOther: 0,
  ...overrides,
});

const purchase = (overrides: Partial<ReportPurchase> = {}): ReportPurchase => ({
  itemId: 'drop-1',
  fanId: 'fan-1',
  amount: { toString: () => '10' },
  platformFee: { toString: () => '1' },
  status: 'PAID',
  ...overrides,
});

describe('releaseWindow', () => {
  it('runs from presale open to 14 days after release', () => {
    const w = releaseWindow(drop());
    expect(w.start.toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-12-15T00:00:00.000Z');
  });

  it('starts on release day when there is no presale', () => {
    const w = releaseWindow(drop({ presaleStartsAt: null }));
    expect(w.start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('estimateStripeFeeCents', () => {
  it('uses 2.9% + 30 cents per sale', () => {
    expect(estimateStripeFeeCents(1000)).toBe(59);
    expect(estimateStripeFeeCents(300)).toBe(39);
  });

  it('is zero for a free item', () => {
    expect(estimateStripeFeeCents(0)).toBe(0);
  });
});

describe('summarizeSales', () => {
  it('takes the platform fee and Stripe fee out of gross sales', () => {
    const s = summarizeSales([
      purchase(),
      purchase({
        fanId: 'fan-2',
        amount: { toString: () => '5' },
        platformFee: { toString: () => '0.5' },
      }),
    ]);
    expect(s).toEqual({
      unitsSold: 2,
      buyers: 2,
      grossSalesCents: 1500,
      refundsCents: 0,
      platformFeeCents: 150,
      stripeFeeEstimateCents: 59 + 45,
      artistNetCents: 1500 - 150 - 104,
    });
  });

  it('subtracts a refund but still counts the fees Stripe and the platform keep', () => {
    const s = summarizeSales([purchase(), purchase({ fanId: 'fan-2', status: 'REFUNDED' })]);
    expect(s.grossSalesCents).toBe(2000);
    expect(s.refundsCents).toBe(1000);
    expect(s.platformFeeCents).toBe(200);
    expect(s.stripeFeeEstimateCents).toBe(118);
    expect(s.artistNetCents).toBe(2000 - 1000 - 200 - 118);
    expect(s.unitsSold).toBe(1);
    expect(s.buyers).toBe(1);
  });

  it('counts a fan who bought twice as one buyer', () => {
    const s = summarizeSales([purchase(), purchase()]);
    expect(s.unitsSold).toBe(2);
    expect(s.buyers).toBe(1);
  });

  it('ignores pending, failed and expired checkouts', () => {
    const s = summarizeSales([
      purchase({ status: 'PENDING' }),
      purchase({ status: 'FAILED' }),
      purchase({ status: 'EXPIRED' }),
    ]);
    expect(s.grossSalesCents).toBe(0);
    expect(s.artistNetCents).toBe(0);
  });
});

describe('countNewMembers', () => {
  const window = { start: d('2026-11-24T00:00:00Z'), end: d('2026-12-15T00:00:00Z') };

  it('counts distinct fans who joined the artist inside the window', () => {
    const count = countNewMembers(
      [
        { artistId: 'artist-1', fanId: 'a', createdAt: d('2026-11-24T00:00:00Z') },
        { artistId: 'artist-1', fanId: 'a', createdAt: d('2026-11-30T00:00:00Z') },
        { artistId: 'artist-1', fanId: 'b', createdAt: d('2026-12-14T23:59:59Z') },
        { artistId: 'artist-1', fanId: 'c', createdAt: d('2026-12-15T00:00:00Z') },
        { artistId: 'artist-1', fanId: 'd', createdAt: d('2026-11-23T23:59:59Z') },
        { artistId: 'artist-2', fanId: 'e', createdAt: d('2026-12-01T00:00:00Z') },
      ],
      'artist-1',
      window
    );
    expect(count).toBe(2);
  });
});

describe('allocateFixedCosts', () => {
  const monthly = 7300; // $73.00

  it('charges a lone release its days at monthly x 12 / 365', () => {
    const start = d('2026-01-01T00:00:00Z');
    const shares = allocateFixedCosts(
      [{ id: 'a', window: { start, end: new Date(start.getTime() + 21 * DAY) } }],
      monthly
    );
    expect(shares.get('a')).toBe(Math.round((7300 * 12 * 21) / 365));
  });

  it('splits overlapping time evenly and never charges the same day twice', () => {
    const start = d('2026-01-01T00:00:00Z');
    const shares = allocateFixedCosts(
      [
        { id: 'a', window: { start, end: new Date(start.getTime() + 20 * DAY) } },
        {
          id: 'b',
          window: {
            start: new Date(start.getTime() + 10 * DAY),
            end: new Date(start.getTime() + 30 * DAY),
          },
        },
      ],
      monthly
    );
    const perDay = (7300 * 12) / 365;
    expect(shares.get('a')).toBe(Math.round(10 * perDay + 5 * perDay));
    expect(shares.get('b')).toBe(Math.round(5 * perDay + 10 * perDay));
    expect(shares.get('a')! + shares.get('b')!).toBeCloseTo(30 * perDay, -1);
  });

  it('charges nothing when there is no fixed cost', () => {
    const start = d('2026-01-01T00:00:00Z');
    const shares = allocateFixedCosts(
      [{ id: 'a', window: { start, end: new Date(start.getTime() + DAY) } }],
      0
    );
    expect(shares.get('a')).toBe(0);
  });
});

describe('buildReleaseReport', () => {
  it('works out profit as artist net minus all costs', () => {
    const report = buildReleaseReport(
      [
        drop({
          costRecording: 200,
          costVideo: { toString: () => '150.5' },
          costMarketing: 50,
          costOther: 0,
        }),
      ],
      [purchase(), purchase({ fanId: 'fan-2' })],
      [{ artistId: 'artist-1', fanId: 'm1', createdAt: d('2026-12-02T00:00:00Z') }]
    );
    const row = report.rows[0];
    expect(row.grossSalesCents).toBe(2000);
    expect(row.artistNetCents).toBe(2000 - 200 - 118);
    expect(row.costs).toEqual({
      recordingCents: 20000,
      videoCents: 15050,
      marketingCents: 5000,
      otherCents: 0,
      fixedShareCents: 0,
      totalCents: 40050,
    });
    expect(row.profitCents).toBe(1682 - 40050);
    expect(row.newMembers).toBe(1);
    expect(report.totals).toEqual([
      expect.objectContaining({ currency: 'usd', releases: 1, profitCents: 1682 - 40050 }),
    ]);
  });

  it('adds the fixed cost share to costs', () => {
    const report = buildReleaseReport([drop()], [], [], { fixedMonthlyCents: 7300 });
    expect(report.rows[0].costs.fixedShareCents).toBe(Math.round((7300 * 12 * 21) / 365));
    expect(report.rows[0].profitCents).toBe(-report.rows[0].costs.fixedShareCents);
    expect(report.assumptions.fixedMonthlyCents).toBe(7300);
  });

  it('lists the newest release first and keeps currencies apart in totals', () => {
    const report = buildReleaseReport(
      [
        drop({ id: 'old', startsAt: d('2026-01-01T00:00:00Z'), presaleStartsAt: null }),
        drop({ id: 'new', currency: 'eur' }),
      ],
      [],
      []
    );
    expect(report.rows.map(r => r.dropId)).toEqual(['new', 'old']);
    expect(report.totals.map(t => t.currency).sort()).toEqual(['eur', 'usd']);
  });
});

describe('releaseReportToCsv', () => {
  it('writes one line per release in dollars and defuses spreadsheet formulas', () => {
    const report = buildReleaseReport(
      [drop({ title: '=HYPERLINK("x")', costOther: 5 })],
      [purchase()],
      []
    );
    const lines = releaseReportToCsv(report).trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Gross sales');
    expect(lines[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(lines[1]).toContain(',10.00,0.00,1.00,0.59,8.41,');
    expect(lines[1].endsWith(',5.00,0.00,5.00,3.41')).toBe(true);
  });
});

describe('parseFixedMonthlyCents', () => {
  it('reads dollars into cents and defaults to zero', () => {
    expect(parseFixedMonthlyCents(null)).toBe(0);
    expect(parseFixedMonthlyCents('')).toBe(0);
    expect(parseFixedMonthlyCents('73')).toBe(7300);
    expect(parseFixedMonthlyCents('72.995')).toBe(7300);
  });

  it('refuses negative or non-numeric values', () => {
    expect(() => parseFixedMonthlyCents('-1')).toThrow();
    expect(() => parseFixedMonthlyCents('abc')).toThrow();
  });
});

describe('releaseCostsSchema', () => {
  it('accepts dollar amounts from zero up', () => {
    expect(releaseCostsSchema.parse({ recording: 0, video: 12.5 })).toEqual({
      recording: 0,
      video: 12.5,
    });
  });

  it('refuses negatives, unknown fields and an empty body', () => {
    expect(() => releaseCostsSchema.parse({ recording: -1 })).toThrow();
    expect(() => releaseCostsSchema.parse({ hosting: 5 })).toThrow();
    expect(() => releaseCostsSchema.parse({})).toThrow();
  });
});

describe('setReleaseCosts', () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves costs on the artist's own drop, rounded to cents", async () => {
    db.drops.findUnique.mockResolvedValue({ id: 'drop-1', artistId: 'artist-1' });
    db.drops.update.mockResolvedValue({ id: 'drop-1' });

    await setReleaseCosts('artist-1', 'drop-1', { recording: 100.005, marketing: 25 });

    expect(db.drops.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drop-1' },
        data: { costRecording: 100.01, costMarketing: 25 },
      })
    );
  });

  it("refuses another artist's drop", async () => {
    db.drops.findUnique.mockResolvedValue({ id: 'drop-1', artistId: 'artist-2' });
    await expect(setReleaseCosts('artist-1', 'drop-1', { other: 5 })).rejects.toMatchObject({
      status: 404,
    });
    expect(db.drops.update).not.toHaveBeenCalled();
  });
});

describe('loadReleaseReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads only the artist's drops, their paid and refunded sales, and memberships in the windows", async () => {
    db.drops.findMany.mockResolvedValue([{ ...drop(), users: { displayName: 'Nahvee' } }]);
    db.purchases.findMany.mockResolvedValue([purchase()]);
    db.subscriptions.findMany.mockResolvedValue([]);

    const report = await loadReleaseReport('artist-1');

    expect(db.drops.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artistId: 'artist-1' } })
    );
    expect(db.purchases.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          itemType: 'DROP',
          itemId: { in: ['drop-1'] },
          status: { in: ['PAID', 'REFUNDED'] },
        },
      })
    );
    expect(db.subscriptions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          artistId: { in: ['artist-1'] },
          createdAt: { gte: d('2026-11-24T00:00:00Z'), lt: d('2026-12-15T00:00:00Z') },
        },
      })
    );
    expect(report.rows[0]).toMatchObject({ artistName: 'Nahvee', grossSalesCents: 1000 });
  });

  it('skips the other queries when there are no drops', async () => {
    db.drops.findMany.mockResolvedValue([]);
    const report = await loadReleaseReport(null);
    expect(db.drops.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(db.purchases.findMany).not.toHaveBeenCalled();
    expect(report.rows).toEqual([]);
  });
});

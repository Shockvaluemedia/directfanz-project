import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DropError, toCents } from '@/lib/drops';

/**
 * Release report: for each drop, what it sold, what fees came out, what the
 * artist kept, how many fans joined the membership around it, what it cost and
 * the profit. Everything is computed from data the app already records
 * (purchases, subscriptions) plus the costs the artist enters on the drop.
 *
 * All money is handled in cents (integers) and returned in cents.
 */

/** The release window runs from presale open (or release) to this many days after release. */
export const RELEASE_WINDOW_DAYS_AFTER = 14;

/**
 * Stripe's standard US card price, used to estimate its fee because the app
 * does not store the fee Stripe actually charged. On a direct charge the fee is
 * taken from the artist's Stripe account and Stripe keeps it on a refund.
 */
export const STRIPE_FEE_PERCENT = 2.9;
export const STRIPE_FEE_FIXED_CENTS = 30;

/** Upper bound for any single cost or the monthly fixed cost, in dollars. */
export const MAX_COST_DOLLARS = 10_000_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const COUNTED_PURCHASE_STATUSES = ['PAID', 'REFUNDED'] as const;

type Money = { toString(): string } | number | null | undefined;

export interface ReportDrop {
  id: string;
  artistId: string;
  artistName?: string | null;
  title: string;
  status: string;
  currency: string;
  startsAt: Date;
  presaleStartsAt?: Date | null;
  costRecording?: Money;
  costVideo?: Money;
  costMarketing?: Money;
  costOther?: Money;
}

export interface ReportPurchase {
  itemId: string;
  fanId: string;
  amount: Money;
  platformFee: Money;
  status: string;
}

export interface ReportMembership {
  artistId: string;
  fanId: string;
  createdAt: Date;
}

export interface ReleaseWindow {
  start: Date;
  end: Date;
}

export interface ReleaseCosts {
  recordingCents: number;
  videoCents: number;
  marketingCents: number;
  otherCents: number;
  fixedShareCents: number;
  totalCents: number;
}

export interface ReleaseReportRow {
  dropId: string;
  artistId: string;
  artistName: string | null;
  title: string;
  status: string;
  currency: string;
  releaseDate: string;
  windowStart: string;
  windowEnd: string;
  /** Paid units still held by fans (refunded ones excluded). */
  unitsSold: number;
  /** Distinct fans who bought and were not refunded. */
  buyers: number;
  grossSalesCents: number;
  refundsCents: number;
  platformFeeCents: number;
  stripeFeeEstimateCents: number;
  artistNetCents: number;
  newMembers: number;
  costs: ReleaseCosts;
  profitCents: number;
}

export interface ReleaseReportTotals {
  currency: string;
  releases: number;
  unitsSold: number;
  grossSalesCents: number;
  refundsCents: number;
  platformFeeCents: number;
  stripeFeeEstimateCents: number;
  artistNetCents: number;
  costsCents: number;
  profitCents: number;
}

export interface ReleaseReport {
  rows: ReleaseReportRow[];
  /** One entry per currency, so dollars and other currencies are never added together. */
  totals: ReleaseReportTotals[];
  assumptions: {
    windowDaysAfterRelease: number;
    stripeFeePercent: number;
    stripeFeeFixedCents: number;
    fixedMonthlyCents: number;
  };
}

export function releaseWindow(
  drop: Pick<ReportDrop, 'startsAt' | 'presaleStartsAt'>
): ReleaseWindow {
  const start = drop.presaleStartsAt ?? drop.startsAt;
  return { start, end: new Date(drop.startsAt.getTime() + RELEASE_WINDOW_DAYS_AFTER * DAY_MS) };
}

/** Stripe's fee on one charge, estimated at the standard card price. */
export function estimateStripeFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round((amountCents * STRIPE_FEE_PERCENT) / 100) + STRIPE_FEE_FIXED_CENTS;
}

export interface SalesSummary {
  unitsSold: number;
  buyers: number;
  grossSalesCents: number;
  refundsCents: number;
  platformFeeCents: number;
  stripeFeeEstimateCents: number;
  artistNetCents: number;
}

/**
 * Sales for one drop. A refunded purchase counts in gross sales and again as a
 * refund. Stripe keeps its fee and, by default, the platform fee on a refund,
 * so both still count against the artist.
 */
export function summarizeSales(purchases: ReportPurchase[]): SalesSummary {
  let grossSalesCents = 0;
  let refundsCents = 0;
  let platformFeeCents = 0;
  let stripeFeeEstimateCents = 0;
  let unitsSold = 0;
  const buyers = new Set<string>();

  for (const purchase of purchases) {
    if (!(COUNTED_PURCHASE_STATUSES as readonly string[]).includes(purchase.status)) continue;
    const amount = toCents(purchase.amount);
    grossSalesCents += amount;
    platformFeeCents += toCents(purchase.platformFee);
    stripeFeeEstimateCents += estimateStripeFeeCents(amount);
    if (purchase.status === 'REFUNDED') {
      refundsCents += amount;
    } else {
      unitsSold += 1;
      buyers.add(purchase.fanId);
    }
  }

  return {
    unitsSold,
    buyers: buyers.size,
    grossSalesCents,
    refundsCents,
    platformFeeCents,
    stripeFeeEstimateCents,
    artistNetCents: grossSalesCents - refundsCents - platformFeeCents - stripeFeeEstimateCents,
  };
}

/** Distinct fans who started a membership with the artist inside the window. */
export function countNewMembers(
  memberships: ReportMembership[],
  artistId: string,
  window: ReleaseWindow
): number {
  const fans = new Set<string>();
  for (const m of memberships) {
    if (m.artistId !== artistId) continue;
    const t = m.createdAt.getTime();
    if (t >= window.start.getTime() && t < window.end.getTime()) fans.add(m.fanId);
  }
  return fans.size;
}

/**
 * Splits a monthly fixed cost (hosting and the like) across releases by time:
 * the cost runs at monthly x 12 / 365 per day, and while several release
 * windows are open at once, each moment's cost is shared evenly between them.
 * Time when no release window is open is not charged to any release.
 */
export function allocateFixedCosts(
  windows: Array<{ id: string; window: ReleaseWindow }>,
  monthlyCents: number
): Map<string, number> {
  const shares = new Map<string, number>(windows.map(w => [w.id, 0]));
  if (monthlyCents <= 0 || windows.length === 0) return shares;

  const perMs = (monthlyCents * 12) / 365 / DAY_MS;
  const points = Array.from(
    new Set(windows.flatMap(w => [w.window.start.getTime(), w.window.end.getTime()]))
  ).sort((a, b) => a - b);

  const exact = new Map<string, number>(windows.map(w => [w.id, 0]));
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const open = windows.filter(
      w => w.window.start.getTime() <= from && w.window.end.getTime() >= to
    );
    if (open.length === 0) continue;
    const each = ((to - from) * perMs) / open.length;
    for (const w of open) exact.set(w.id, (exact.get(w.id) ?? 0) + each);
  }

  for (const [id, value] of exact) shares.set(id, Math.round(value));
  return shares;
}

export function releaseCosts(drop: ReportDrop, fixedShareCents = 0): ReleaseCosts {
  const recordingCents = toCents(drop.costRecording);
  const videoCents = toCents(drop.costVideo);
  const marketingCents = toCents(drop.costMarketing);
  const otherCents = toCents(drop.costOther);
  return {
    recordingCents,
    videoCents,
    marketingCents,
    otherCents,
    fixedShareCents,
    totalCents: recordingCents + videoCents + marketingCents + otherCents + fixedShareCents,
  };
}

export function buildReleaseReport(
  drops: ReportDrop[],
  purchases: ReportPurchase[],
  memberships: ReportMembership[],
  options: { fixedMonthlyCents?: number } = {}
): ReleaseReport {
  const fixedMonthlyCents = Math.max(0, Math.round(options.fixedMonthlyCents ?? 0));
  const windows = drops.map(d => ({ id: d.id, window: releaseWindow(d) }));
  const windowById = new Map(windows.map(w => [w.id, w.window]));
  const fixedShares = allocateFixedCosts(windows, fixedMonthlyCents);

  const purchasesByDrop = new Map<string, ReportPurchase[]>();
  for (const p of purchases) {
    const list = purchasesByDrop.get(p.itemId) ?? [];
    list.push(p);
    purchasesByDrop.set(p.itemId, list);
  }

  const rows = drops
    .map((drop): ReleaseReportRow => {
      const window = windowById.get(drop.id)!;
      const sales = summarizeSales(purchasesByDrop.get(drop.id) ?? []);
      const costs = releaseCosts(drop, fixedShares.get(drop.id) ?? 0);
      return {
        dropId: drop.id,
        artistId: drop.artistId,
        artistName: drop.artistName ?? null,
        title: drop.title,
        status: drop.status,
        currency: drop.currency,
        releaseDate: drop.startsAt.toISOString(),
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        ...sales,
        newMembers: countNewMembers(memberships, drop.artistId, window),
        costs,
        profitCents: sales.artistNetCents - costs.totalCents,
      };
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  const totalsByCurrency = new Map<string, ReleaseReportTotals>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? {
      currency: row.currency,
      releases: 0,
      unitsSold: 0,
      grossSalesCents: 0,
      refundsCents: 0,
      platformFeeCents: 0,
      stripeFeeEstimateCents: 0,
      artistNetCents: 0,
      costsCents: 0,
      profitCents: 0,
    };
    t.releases += 1;
    t.unitsSold += row.unitsSold;
    t.grossSalesCents += row.grossSalesCents;
    t.refundsCents += row.refundsCents;
    t.platformFeeCents += row.platformFeeCents;
    t.stripeFeeEstimateCents += row.stripeFeeEstimateCents;
    t.artistNetCents += row.artistNetCents;
    t.costsCents += row.costs.totalCents;
    t.profitCents += row.profitCents;
    totalsByCurrency.set(row.currency, t);
  }

  return {
    rows,
    totals: Array.from(totalsByCurrency.values()),
    assumptions: {
      windowDaysAfterRelease: RELEASE_WINDOW_DAYS_AFTER,
      stripeFeePercent: STRIPE_FEE_PERCENT,
      stripeFeeFixedCents: STRIPE_FEE_FIXED_CENTS,
      fixedMonthlyCents,
    },
  };
}

/**
 * Loads and builds the report for one artist, or for every artist when
 * artistId is null (admin view).
 */
export async function loadReleaseReport(
  artistId: string | null,
  options: { fixedMonthlyCents?: number } = {}
): Promise<ReleaseReport> {
  const drops = await prisma.drops.findMany({
    where: artistId ? { artistId } : {},
    select: {
      id: true,
      artistId: true,
      title: true,
      status: true,
      currency: true,
      startsAt: true,
      presaleStartsAt: true,
      costRecording: true,
      costVideo: true,
      costMarketing: true,
      costOther: true,
      users: { select: { displayName: true } },
    },
  });

  if (drops.length === 0) return buildReleaseReport([], [], [], options);

  const reportDrops: ReportDrop[] = drops.map(({ users, ...d }) => ({
    ...d,
    artistName: users?.displayName ?? null,
  }));
  const windows = reportDrops.map(releaseWindow);
  const earliest = new Date(Math.min(...windows.map(w => w.start.getTime())));
  const latest = new Date(Math.max(...windows.map(w => w.end.getTime())));
  const artistIds = Array.from(new Set(reportDrops.map(d => d.artistId)));

  const [purchases, memberships] = await Promise.all([
    prisma.purchases.findMany({
      where: {
        itemType: 'DROP',
        itemId: { in: reportDrops.map(d => d.id) },
        status: { in: [...COUNTED_PURCHASE_STATUSES] },
      },
      select: { itemId: true, fanId: true, amount: true, platformFee: true, status: true },
    }),
    prisma.subscriptions.findMany({
      where: { artistId: { in: artistIds }, createdAt: { gte: earliest, lt: latest } },
      select: { artistId: true, fanId: true, createdAt: true },
    }),
  ]);

  return buildReleaseReport(reportDrops, purchases, memberships, options);
}

const costDollars = z.number().finite().min(0).max(MAX_COST_DOLLARS);

export const releaseCostsSchema = z
  .object({
    recording: costDollars,
    video: costDollars,
    marketing: costDollars,
    other: costDollars,
  })
  .partial()
  .strict()
  .refine(v => Object.keys(v).length > 0, { message: 'Send at least one cost' });

export type ReleaseCostsInput = z.infer<typeof releaseCostsSchema>;

/** Saves the artist's own costs for one of their drops. Rounds to cents. */
export async function setReleaseCosts(artistId: string, dropId: string, input: ReleaseCostsInput) {
  const drop = await prisma.drops.findUnique({ where: { id: dropId } });
  if (!drop || drop.artistId !== artistId) {
    throw new DropError('Drop not found', 404);
  }

  const data: Record<string, number> = {};
  if (input.recording !== undefined) data.costRecording = toCents(input.recording) / 100;
  if (input.video !== undefined) data.costVideo = toCents(input.video) / 100;
  if (input.marketing !== undefined) data.costMarketing = toCents(input.marketing) / 100;
  if (input.other !== undefined) data.costOther = toCents(input.other) / 100;

  return prisma.drops.update({
    where: { id: dropId },
    data,
    select: {
      id: true,
      costRecording: true,
      costVideo: true,
      costMarketing: true,
      costOther: true,
    },
  });
}

/** Parses the optional monthly fixed cost (dollars) from a query string value. */
export function parseFixedMonthlyCents(raw: string | null): number {
  if (raw === null || raw.trim() === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_COST_DOLLARS) {
    throw new DropError('fixedMonthly must be a dollar amount from 0 up', 400);
  }
  return Math.round(value * 100);
}

function csvCell(value: string | number): string {
  let text = String(value);
  // A cell starting with these can run as a formula in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function releaseReportToCsv(report: ReleaseReport): string {
  const header = [
    'Release',
    'Artist',
    'Status',
    'Currency',
    'Release date',
    'Window start',
    'Window end',
    'Units sold',
    'Buyers',
    'Gross sales',
    'Refunds',
    'Platform fee',
    'Stripe fee (est.)',
    'Artist net',
    'New members',
    'Recording cost',
    'Video cost',
    'Marketing cost',
    'Other cost',
    'Fixed cost share',
    'Total costs',
    'Profit',
  ];
  const lines = report.rows.map(r =>
    [
      r.title,
      r.artistName ?? '',
      r.status,
      r.currency.toUpperCase(),
      r.releaseDate.slice(0, 10),
      r.windowStart.slice(0, 10),
      r.windowEnd.slice(0, 10),
      r.unitsSold,
      r.buyers,
      dollars(r.grossSalesCents),
      dollars(r.refundsCents),
      dollars(r.platformFeeCents),
      dollars(r.stripeFeeEstimateCents),
      dollars(r.artistNetCents),
      r.newMembers,
      dollars(r.costs.recordingCents),
      dollars(r.costs.videoCents),
      dollars(r.costs.marketingCents),
      dollars(r.costs.otherCents),
      dollars(r.costs.fixedShareCents),
      dollars(r.costs.totalCents),
      dollars(r.profitCents),
    ]
      .map(csvCell)
      .join(',')
  );
  return [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}

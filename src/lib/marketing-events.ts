import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Marketing event feed: a vendor-neutral, signed webhook that tells an
 * outside marketing tool (GoHighLevel, or anything that takes a webhook)
 * when fans join, buy, and opt in or out. See docs/marketing-events.md.
 *
 * - Off by default. Nothing is stored or sent unless both
 *   MARKETING_WEBHOOK_URL and MARKETING_WEBHOOK_SECRET are set.
 * - Every event has a stable id (dedupe), and is signed with HMAC-SHA256 over
 *   "<timestamp>.<body>" in the X-DirectFanz-Signature header.
 * - Events go into an outbox table. Each is sent once straight away; a
 *   failed send is retried with exponential backoff when the delivery route
 *   (/api/cron/marketing-events) is called on a schedule.
 * - A fan's email or phone is included only while that fan is opted in to
 *   that channel with that artist. Opt-outs are always sent, by fan id.
 * - Emitting never throws: the fan's or artist's action always goes ahead.
 */

export const MARKETING_EVENT_TYPES = [
  'fan.followed',
  'email.opted_in',
  'email.opted_out',
  'sms.opted_in',
  'sms.opted_out',
  'purchase.completed',
  'drop.purchased',
  'ticket.purchased',
  'membership.started',
  'membership.cancelled',
] as const;
export type MarketingEventType = (typeof MARKETING_EVENT_TYPES)[number];

export const SIGNATURE_HEADER = 'X-DirectFanz-Signature';
export const EVENT_ID_HEADER = 'X-DirectFanz-Event-Id';
export const EVENT_TYPE_HEADER = 'X-DirectFanz-Event-Type';

/** Give up after this many tries (about a day and a half of backoff). */
export const MAX_ATTEMPTS = 10;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;
const SEND_TIMEOUT_MS = 3_000;
/** How long a delivery run holds an event so two runs don't send it at once. */
const CLAIM_MS = 2 * 60 * 1000;
/** Delivered and failed events are deleted after this, since they hold contact details. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const EVENT_STATUS = { PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' } as const;

export interface MarketingConfig {
  url: string;
  secret: string;
}

/** The feed's settings, or null when it is switched off. */
export function getMarketingConfig(
  env: Record<string, string | undefined> = process.env
): MarketingConfig | null {
  const url = env.MARKETING_WEBHOOK_URL?.trim();
  const secret = env.MARKETING_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return null;

  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
      logger.warn('MARKETING_WEBHOOK_URL must use https; the marketing feed is off');
      return null;
    }
  } catch {
    logger.warn('MARKETING_WEBHOOK_URL is not a valid URL; the marketing feed is off');
    return null;
  }
  return { url, secret };
}

export function isMarketingFeedEnabled(env: Record<string, string | undefined> = process.env) {
  return getMarketingConfig(env) !== null;
}

export interface MarketingContact {
  id: string;
  name?: string;
  /** Only while the fan gets this artist's email. */
  email?: string;
  /** Only while the fan gets this artist's texts. */
  phone?: string;
}

export interface MarketingEventPayload {
  id: string;
  type: MarketingEventType;
  createdAt: string;
  artist: { id: string; name: string | null };
  fan: MarketingContact;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

export function signPayload(body: string, secret: string, timestamp: number): string {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/**
 * For receivers: true when the header was made with this secret over this
 * exact body, within `toleranceSeconds` of now.
 */
export function verifySignature(
  body: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map(part => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    })
  );
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = signPayload(body, secret, timestamp).split('v1=')[1];
  const given = Buffer.from(parts.v1, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

// ---------------------------------------------------------------------------
// Building events
// ---------------------------------------------------------------------------

const OPT_OUT_TYPES: ReadonlySet<MarketingEventType> = new Set([
  'email.opted_out',
  'sms.opted_out',
]);

/**
 * The fan as the marketing tool may see them for this artist: their name,
 * plus each address only while they are opted in to that channel. An opt-out
 * carries the fan id alone.
 */
async function contactFor(
  type: MarketingEventType,
  artistId: string,
  fanId: string
): Promise<MarketingContact> {
  if (OPT_OUT_TYPES.has(type)) return { id: fanId };

  const [fan, member] = await Promise.all([
    prisma.users.findUnique({
      where: { id: fanId },
      select: { displayName: true, email: true },
    }),
    prisma.fan_list_members.findUnique({ where: { artistId_fanId: { artistId, fanId } } }),
  ]);

  const contact: MarketingContact = { id: fanId };
  if (fan?.displayName) contact.name = fan.displayName;
  if (member?.emailConsentedAt && !member.emailUnsubscribedAt && fan?.email) {
    contact.email = fan.email;
  }
  if (member?.smsConsentedAt && !member.smsUnsubscribedAt && member.smsPhone) {
    contact.phone = member.smsPhone;
  }
  return contact;
}

async function artistName(artistId: string): Promise<string | null> {
  const artist = await prisma.users.findUnique({
    where: { id: artistId },
    select: { displayName: true },
  });
  return artist?.displayName ?? null;
}

export interface EmitInput {
  type: MarketingEventType;
  artistId: string;
  fanId: string;
  data?: Record<string, unknown>;
  now?: Date;
}

/**
 * Record an event and try to send it. Does nothing while the feed is off.
 * Never throws.
 */
export async function emitMarketingEvent(input: EmitInput): Promise<void> {
  const config = getMarketingConfig();
  if (!config) return;

  try {
    const now = input.now ?? new Date();
    const [fan, name] = await Promise.all([
      contactFor(input.type, input.artistId, input.fanId),
      artistName(input.artistId),
    ]);
    const payload: MarketingEventPayload = {
      id: crypto.randomUUID(),
      type: input.type,
      createdAt: now.toISOString(),
      artist: { id: input.artistId, name },
      fan,
      data: input.data ?? {},
    };

    const row = await prisma.marketing_events.create({
      data: {
        id: payload.id,
        type: payload.type,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: EVENT_STATUS.PENDING,
        // Held while this request sends it; a delivery run picks it up after
        // that only if the send never finished.
        nextAttemptAt: new Date(now.getTime() + CLAIM_MS),
      },
    });

    await deliverEvent(row, config, now);
  } catch (error) {
    logger.error('Marketing event was not recorded', { type: input.type }, error as Error);
  }
}

/** Emit the same event for several fans (for example a STOP that left many lists). */
export async function emitMarketingEvents(inputs: EmitInput[]): Promise<void> {
  for (const input of inputs) {
    await emitMarketingEvent(input);
  }
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/** Delay before try number `attempts + 1`, after `attempts` failed tries. */
export function retryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_MS);
}

/** A 4xx other than timeout or rate limit means the receiver won't take it. */
function isPermanentFailure(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

type OutboxRow = Prisma.marketing_eventsGetPayload<Record<string, never>>;

async function post(
  row: OutboxRow,
  config: MarketingConfig,
  now: Date
): Promise<{ ok: boolean; permanent: boolean; error?: string }> {
  const body = JSON.stringify(row.payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DirectFanz-Webhooks/1',
        [SIGNATURE_HEADER]: signPayload(body, config.secret, Math.floor(now.getTime() / 1000)),
        [EVENT_ID_HEADER]: row.id,
        [EVENT_TYPE_HEADER]: row.type,
      },
      body,
      signal: controller.signal,
      redirect: 'manual',
    });
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, permanent: false };
    }
    return {
      ok: false,
      permanent: isPermanentFailure(response.status),
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = (error as Error).name === 'AbortError' ? 'Timed out' : 'Network error';
    return { ok: false, permanent: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** One delivery attempt for an event this run has claimed. */
async function deliverEvent(row: OutboxRow, config: MarketingConfig, now: Date) {
  const result = await post(row, config, now);
  const attempts = row.attempts + 1;

  if (result.ok) {
    await prisma.marketing_events.update({
      where: { id: row.id },
      data: { status: EVENT_STATUS.SENT, attempts, sentAt: now, lastError: null },
    });
    return true;
  }

  const giveUp = result.permanent || attempts >= MAX_ATTEMPTS;
  await prisma.marketing_events.update({
    where: { id: row.id },
    data: {
      status: giveUp ? EVENT_STATUS.FAILED : EVENT_STATUS.PENDING,
      attempts,
      lastError: result.error ?? null,
      nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)),
    },
  });
  if (giveUp) {
    logger.warn('Marketing event was not delivered', {
      eventId: row.id,
      type: row.type,
      attempts,
      error: result.error,
    });
  }
  return false;
}

export interface DeliveryRunResult {
  enabled: boolean;
  attempted: number;
  sent: number;
  pruned: number;
}

/**
 * Retry events that are due, oldest first, and delete delivered or failed
 * events past the retention period. Called by /api/cron/marketing-events.
 */
export async function deliverDueMarketingEvents(
  options: { limit?: number; now?: Date } = {}
): Promise<DeliveryRunResult> {
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const pruned = await prisma.marketing_events.deleteMany({
    where: {
      status: { in: [EVENT_STATUS.SENT, EVENT_STATUS.FAILED] },
      createdAt: { lt: new Date(now.getTime() - RETENTION_MS) },
    },
  });

  const config = getMarketingConfig();
  if (!config) {
    return { enabled: false, attempted: 0, sent: 0, pruned: pruned.count };
  }

  const due = await prisma.marketing_events.findMany({
    where: { status: EVENT_STATUS.PENDING, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let attempted = 0;
  let sent = 0;
  for (const row of due) {
    // Claim it, so an overlapping run skips it. The event id still lets the
    // receiver drop a duplicate if a send is retried after it landed.
    const claimed = await prisma.marketing_events.updateMany({
      where: { id: row.id, status: EVENT_STATUS.PENDING, nextAttemptAt: row.nextAttemptAt },
      data: { nextAttemptAt: new Date(now.getTime() + CLAIM_MS) },
    });
    if (claimed.count !== 1) continue;

    attempted += 1;
    if (await deliverEvent(row, config, now)) sent += 1;
  }

  return { enabled: true, attempted, sent, pruned: pruned.count };
}

/**
 * The marketing event feed, tested against a fake receiver: a real local
 * HTTP server that checks each request's signature the way a receiver would.
 */
import http from 'http';
import { AddressInfo } from 'net';
import { prisma } from '@/lib/prisma';
import {
  deliverDueMarketingEvents,
  emitMarketingEvent,
  EVENT_ID_HEADER,
  getMarketingConfig,
  MAX_ATTEMPTS,
  retryDelayMs,
  signPayload,
  verifySignature,
} from '@/lib/marketing-events';

const db = prisma as any;
const SECRET = 'whsec_test_marketing';
const now = new Date('2026-12-01T12:00:00Z');

interface Received {
  headers: http.IncomingHttpHeaders;
  body: string;
  validSignature: boolean;
}

let server: http.Server;
let received: Received[] = [];
let replyStatus = 200;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const signature = req.headers['x-directfanz-signature'] as string | undefined;
      received.push({
        headers: req.headers,
        body,
        // The receiver's clock is the real one; the signature uses `now` below.
        validSignature: verifySignature(body, signature, SECRET, 300, now.getTime() / 1000),
      });
      res.statusCode = replyStatus;
      res.end('ok');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  delete process.env.MARKETING_WEBHOOK_URL;
  delete process.env.MARKETING_WEBHOOK_SECRET;
});

const rows = new Map<string, any>();

beforeEach(() => {
  jest.clearAllMocks();
  received = [];
  replyStatus = 200;
  rows.clear();
  process.env.MARKETING_WEBHOOK_URL = `${baseUrl}/hooks/directfanz`;
  process.env.MARKETING_WEBHOOK_SECRET = SECRET;

  db.users.findUnique.mockImplementation(({ where }: any) =>
    Promise.resolve(
      where.id === 'artist_1'
        ? { displayName: 'Nahvee' }
        : { displayName: 'Fan One', email: 'fan1@example.com' }
    )
  );
  db.fan_list_members.findUnique.mockResolvedValue(null);
  db.marketing_events.create.mockImplementation(({ data }: any) => {
    const row = { attempts: 0, lastError: null, sentAt: null, ...data };
    rows.set(row.id, row);
    return Promise.resolve(row);
  });
  db.marketing_events.update.mockImplementation(({ where, data }: any) => {
    const row = { ...rows.get(where.id), ...data };
    rows.set(where.id, row);
    return Promise.resolve(row);
  });
  db.marketing_events.deleteMany.mockResolvedValue({ count: 0 });
  db.marketing_events.updateMany.mockResolvedValue({ count: 1 });
});

function onlyRow() {
  expect(rows.size).toBe(1);
  return [...rows.values()][0];
}

describe('switched off', () => {
  it('stores and sends nothing without both a URL and a secret', async () => {
    delete process.env.MARKETING_WEBHOOK_URL;
    await emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1' });

    process.env.MARKETING_WEBHOOK_URL = `${baseUrl}/x`;
    delete process.env.MARKETING_WEBHOOK_SECRET;
    await emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1' });

    expect(db.marketing_events.create).not.toHaveBeenCalled();
    expect(received).toHaveLength(0);
  });

  it('refuses a plain-http address outside this machine', () => {
    expect(
      getMarketingConfig({
        MARKETING_WEBHOOK_URL: 'http://example.com/h',
        MARKETING_WEBHOOK_SECRET: 's',
      })
    ).toBeNull();
    expect(
      getMarketingConfig({
        MARKETING_WEBHOOK_URL: 'https://example.com/h',
        MARKETING_WEBHOOK_SECRET: 's',
      })
    ).not.toBeNull();
  });
});

describe('sending', () => {
  it('posts a signed event with its id, and marks it sent', async () => {
    db.fan_list_members.findUnique.mockResolvedValue({
      emailConsentedAt: now,
      emailUnsubscribedAt: null,
      smsConsentedAt: null,
      smsUnsubscribedAt: null,
      smsPhone: null,
    });

    await emitMarketingEvent({
      type: 'drop.purchased',
      artistId: 'artist_1',
      fanId: 'fan_1',
      data: { purchaseId: 'p_1', amount: '5' },
      now,
    });

    expect(received).toHaveLength(1);
    const [hit] = received;
    const body = JSON.parse(hit.body);
    expect(hit.validSignature).toBe(true);
    expect(hit.headers['x-directfanz-event-id']).toBe(body.id);
    expect(hit.headers['x-directfanz-event-type']).toBe('drop.purchased');
    expect(body).toMatchObject({
      type: 'drop.purchased',
      createdAt: now.toISOString(),
      artist: { id: 'artist_1', name: 'Nahvee' },
      fan: { id: 'fan_1', name: 'Fan One', email: 'fan1@example.com' },
      data: { purchaseId: 'p_1', amount: '5' },
    });
    expect(body.fan).not.toHaveProperty('phone');
    expect(onlyRow()).toMatchObject({ status: 'SENT', attempts: 1, sentAt: now });
  });

  it('leaves out email and phone when the fan has not opted in to them', async () => {
    db.fan_list_members.findUnique.mockResolvedValue({
      emailConsentedAt: now,
      emailUnsubscribedAt: now,
      smsConsentedAt: null,
      smsUnsubscribedAt: null,
      smsPhone: '+13125550100',
    });

    await emitMarketingEvent({
      type: 'ticket.purchased',
      artistId: 'artist_1',
      fanId: 'fan_1',
      now,
    });

    const fan = JSON.parse(received[0].body).fan;
    expect(fan).toEqual({ id: 'fan_1', name: 'Fan One' });
  });

  it('includes the phone only while the fan gets texts', async () => {
    db.fan_list_members.findUnique.mockResolvedValue({
      emailConsentedAt: null,
      emailUnsubscribedAt: null,
      smsConsentedAt: now,
      smsUnsubscribedAt: null,
      smsPhone: '+13125550100',
    });

    await emitMarketingEvent({ type: 'sms.opted_in', artistId: 'artist_1', fanId: 'fan_1', now });

    expect(JSON.parse(received[0].body).fan).toEqual({
      id: 'fan_1',
      name: 'Fan One',
      phone: '+13125550100',
    });
  });

  it('always sends opt-outs, by fan id only', async () => {
    await emitMarketingEvent({
      type: 'email.opted_out',
      artistId: 'artist_1',
      fanId: 'fan_1',
      data: { reason: 'unsubscribe_link' },
      now,
    });

    const body = JSON.parse(received[0].body);
    expect(body.type).toBe('email.opted_out');
    expect(body.fan).toEqual({ id: 'fan_1' });
    expect(db.fan_list_members.findUnique).not.toHaveBeenCalled();
  });

  it('never throws, even when the database fails', async () => {
    db.marketing_events.create.mockRejectedValue(new Error('db down'));
    await expect(
      emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1' })
    ).resolves.toBeUndefined();
  });
});

describe('retries', () => {
  it('a failed send waits with backoff, and a later run delivers it with the same id', async () => {
    replyStatus = 503;
    await emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1', now });

    const failed = onlyRow();
    expect(failed).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'HTTP 503' });
    expect(failed.nextAttemptAt.getTime() - now.getTime()).toBe(retryDelayMs(1));

    replyStatus = 200;
    db.marketing_events.findMany.mockResolvedValue([failed]);
    const later = new Date(now.getTime() + retryDelayMs(1));
    const result = await deliverDueMarketingEvents({ now: later });

    expect(result).toMatchObject({ enabled: true, attempted: 1, sent: 1 });
    expect(received).toHaveLength(2);
    expect(received[1].headers[EVENT_ID_HEADER.toLowerCase()]).toBe(failed.id);
    expect(onlyRow()).toMatchObject({ status: 'SENT', attempts: 2 });
  });

  it('backs off exponentially up to six hours', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(5)).toBe(480_000);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60 * 1000);
  });

  it('gives up after the last try, or at once when the receiver refuses the event', async () => {
    replyStatus = 500;
    await emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1', now });
    const row = onlyRow();
    row.attempts = MAX_ATTEMPTS - 1;
    db.marketing_events.findMany.mockResolvedValue([row]);

    await deliverDueMarketingEvents({ now });
    expect(onlyRow()).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS });

    rows.clear();
    replyStatus = 400;
    await emitMarketingEvent({ type: 'fan.followed', artistId: 'artist_1', fanId: 'fan_1', now });
    expect(onlyRow()).toMatchObject({ status: 'FAILED', attempts: 1 });
  });

  it('skips an event another run already claimed', async () => {
    db.marketing_events.findMany.mockResolvedValue([
      { id: 'evt_1', type: 'fan.followed', payload: {}, attempts: 1, nextAttemptAt: now },
    ]);
    db.marketing_events.updateMany.mockResolvedValue({ count: 0 });

    const result = await deliverDueMarketingEvents({ now });

    expect(result.attempted).toBe(0);
    expect(received).toHaveLength(0);
  });

  it('prunes old delivered events, and sends nothing while switched off', async () => {
    delete process.env.MARKETING_WEBHOOK_URL;
    db.marketing_events.deleteMany.mockResolvedValue({ count: 3 });

    const result = await deliverDueMarketingEvents({ now });

    expect(result).toEqual({ enabled: false, attempted: 0, sent: 0, pruned: 3 });
    expect(db.marketing_events.deleteMany.mock.calls[0][0].where.status).toEqual({
      in: ['SENT', 'FAILED'],
    });
    expect(db.marketing_events.findMany).not.toHaveBeenCalled();
  });
});

describe('signatures', () => {
  const body = '{"id":"evt_1"}';
  const t = 1_800_000_000;

  it('accepts its own signature and rejects a changed body, wrong secret or old timestamp', () => {
    const header = signPayload(body, SECRET, t);
    expect(verifySignature(body, header, SECRET, 300, t)).toBe(true);
    expect(verifySignature('{"id":"evt_2"}', header, SECRET, 300, t)).toBe(false);
    expect(verifySignature(body, header, 'other', 300, t)).toBe(false);
    expect(verifySignature(body, header, SECRET, 300, t + 301)).toBe(false);
    expect(verifySignature(body, 'garbage', SECRET, 300, t)).toBe(false);
    expect(verifySignature(body, null, SECRET, 300, t)).toBe(false);
  });
});

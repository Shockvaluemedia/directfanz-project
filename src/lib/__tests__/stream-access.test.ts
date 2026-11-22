import { prisma } from '@/lib/prisma';
import { canViewStream, parseTierIds, ticketPriceError } from '@/lib/stream-access';
import { checkStreamAccess } from '@/lib/streaming-auth';
import { UserRole } from '@/types/database';

const db = prisma as any;

function stream(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stream_1',
    artistId: 'artist_1',
    isPublic: false,
    tierIds: '[]',
    requiresPayment: false,
    paymentAmount: null,
    ...overrides,
  } as any;
}

const party = (overrides: Record<string, unknown> = {}) =>
  stream({ requiresPayment: true, paymentAmount: { toString: () => '8.00' }, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  db.purchases.findFirst.mockResolvedValue(null);
  db.subscriptions.findFirst.mockResolvedValue(null);
});

describe('ticketed listening parties', () => {
  it('lets a fan with a paid ticket in', async () => {
    db.purchases.findFirst.mockResolvedValue({ id: 'pur_1' });

    await expect(canViewStream('fan_1', party())).resolves.toBe(true);
    expect(db.purchases.findFirst).toHaveBeenCalledWith({
      where: { fanId: 'fan_1', itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1', status: 'PAID' },
      select: { id: true },
    });
  });

  it('keeps a fan without a ticket out, even when the party is marked public', async () => {
    await expect(canViewStream('fan_1', party())).resolves.toBe(false);
    await expect(canViewStream('fan_1', party({ isPublic: true }))).resolves.toBe(false);
    await expect(canViewStream(null, party({ isPublic: true }))).resolves.toBe(false);
  });

  it('lets members of a named tier in without a ticket', async () => {
    db.subscriptions.findFirst.mockResolvedValue({ id: 'sub_1' });

    await expect(canViewStream('fan_1', party({ tierIds: '["tier_1"]' }))).resolves.toBe(true);
    expect(db.subscriptions.findFirst.mock.calls[0][0].where).toEqual({
      fanId: 'fan_1',
      tierId: { in: ['tier_1'] },
      status: 'ACTIVE',
    });
  });

  it('always lets the artist in', async () => {
    await expect(canViewStream('artist_1', party())).resolves.toBe(true);
  });

  it('treats a zero price as not ticketed', async () => {
    await expect(
      canViewStream('fan_1', party({ isPublic: true, paymentAmount: { toString: () => '0' } }))
    ).resolves.toBe(true);
  });
});

describe('free streams', () => {
  it('public streams are open, signed out included', async () => {
    await expect(canViewStream(null, stream({ isPublic: true }))).resolves.toBe(true);
  });

  it('private streams need a member of a named tier, and a sign-in', async () => {
    const tiered = stream({ tierIds: '["tier_1"]' });
    await expect(canViewStream('fan_1', tiered)).resolves.toBe(false);
    await expect(canViewStream(null, stream())).resolves.toBe(false);
    await expect(canViewStream('fan_1', stream())).resolves.toBe(true);
  });

  it('reads a broken tier list as empty', () => {
    expect(parseTierIds('not json')).toEqual([]);
    expect(parseTierIds('{"a":1}')).toEqual([]);
    expect(parseTierIds(null)).toEqual([]);
  });
});

describe('the stream socket and chat', () => {
  it('chat needs the same access as watching', async () => {
    db.live_streams.findUnique.mockResolvedValue(party());

    await expect(
      checkStreamAccess({
        streamId: 'stream_1',
        userId: 'fan_1',
        userRole: UserRole.FAN,
        action: 'chat',
      })
    ).resolves.toBe(false);

    db.purchases.findFirst.mockResolvedValue({ id: 'pur_1' });
    await expect(
      checkStreamAccess({
        streamId: 'stream_1',
        userId: 'fan_1',
        userRole: UserRole.FAN,
        action: 'view',
      })
    ).resolves.toBe(true);
  });
});

describe('ticket prices', () => {
  it.each([
    [false, null, null],
    [true, 8, null],
    [true, 0.5, null],
    [true, 1000, null],
    [true, 0.49, 'between'],
    [true, 1000.01, 'between'],
    [true, null, 'between'],
    [true, 4.999, 'whole cents'],
  ])('requiresPayment %s at %s', (requires, amount, error) => {
    const result = ticketPriceError(requires as boolean, amount as number | null);
    if (error === null) expect(result).toBeNull();
    else expect(result).toContain(error);
  });
});

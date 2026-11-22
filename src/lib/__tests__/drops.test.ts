import { prisma } from '@/lib/prisma';
import {
  createDrop,
  createDropSchema,
  DropError,
  getDropAvailability,
  isActiveMember,
  MAX_DROP_PAYMENT_CENTS,
  resolveDropAmountCents,
  toPublicDrop,
  updateDrop,
} from '@/lib/drops';

const db = prisma as any;
const price = (v: string) => ({ toString: () => v });

const baseDrop = {
  id: 'drop-1',
  artistId: 'artist-1',
  title: 'Never More: first single',
  description: null,
  priceType: 'PAY_WHAT_YOU_WANT',
  price: price('3'),
  currency: 'usd',
  startsAt: new Date('2026-12-01T00:00:00Z'),
  endsAt: new Date('2026-12-15T00:00:00Z') as Date | null,
  quantityLimit: null as number | null,
  soldCount: 0,
  status: 'PUBLISHED',
};

describe('getDropAvailability', () => {
  const during = new Date('2026-12-05T00:00:00Z');

  it.each([
    ['on sale inside the window', baseDrop, during, 'on_sale'],
    ['not started before the window', baseDrop, new Date('2026-11-30T00:00:00Z'), 'not_started'],
    ['ended at the end time', baseDrop, new Date('2026-12-15T00:00:00Z'), 'ended'],
    ['on sale with no end time', { ...baseDrop, endsAt: null }, new Date('2030-01-01'), 'on_sale'],
    [
      'sold out at the cap',
      { ...baseDrop, quantityLimit: 100, soldCount: 100 },
      during,
      'sold_out',
    ],
    [
      'sold out when the last units are held by checkouts',
      { ...baseDrop, quantityLimit: 100, soldCount: 98, reservedCount: 2 },
      during,
      'sold_out',
    ],
    ['unavailable as a draft', { ...baseDrop, status: 'DRAFT' }, during, 'unavailable'],
    ['unavailable when archived', { ...baseDrop, status: 'ARCHIVED' }, during, 'unavailable'],
    [
      'in presale between the presale start and the public start',
      { ...baseDrop, presaleStartsAt: new Date('2026-11-28T00:00:00Z') },
      new Date('2026-11-30T00:00:00Z'),
      'presale',
    ],
    [
      'not started before the presale opens',
      { ...baseDrop, presaleStartsAt: new Date('2026-11-28T00:00:00Z') },
      new Date('2026-11-27T00:00:00Z'),
      'not_started',
    ],
    [
      'on sale to everyone once the public start passes',
      { ...baseDrop, presaleStartsAt: new Date('2026-11-28T00:00:00Z') },
      during,
      'on_sale',
    ],
    [
      'sold out in presale when members take every unit',
      {
        ...baseDrop,
        presaleStartsAt: new Date('2026-11-28T00:00:00Z'),
        quantityLimit: 10,
        soldCount: 10,
      },
      new Date('2026-11-30T00:00:00Z'),
      'sold_out',
    ],
  ])('is %s', (_label, drop, now, expected) => {
    expect(getDropAvailability(drop as any, now as Date)).toBe(expected);
  });
});

describe('isActiveMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is true for an active membership of the artist, any tier', async () => {
    db.subscriptions.findFirst.mockResolvedValue({ id: 'sub_1' });

    await expect(isActiveMember('fan-1', 'artist-1')).resolves.toBe(true);
    expect(db.subscriptions.findFirst.mock.calls[0][0].where).toEqual({
      fanId: 'fan-1',
      artistId: 'artist-1',
      status: 'ACTIVE',
    });
  });

  it('is false without one', async () => {
    db.subscriptions.findFirst.mockResolvedValue(null);
    await expect(isActiveMember('fan-1', 'artist-1')).resolves.toBe(false);
  });
});

describe('resolveDropAmountCents', () => {
  it('uses the minimum when a pay-what-you-want fan names no amount', () => {
    expect(resolveDropAmountCents(baseDrop)).toBe(300);
  });

  it('accepts an amount at or above the minimum', () => {
    expect(resolveDropAmountCents(baseDrop, 300)).toBe(300);
    expect(resolveDropAmountCents(baseDrop, 2500)).toBe(2500);
  });

  it('rejects an amount below the minimum or above the cap', () => {
    expect(() => resolveDropAmountCents(baseDrop, 299)).toThrow('at least $3.00');
    expect(() => resolveDropAmountCents(baseDrop, MAX_DROP_PAYMENT_CENTS + 1)).toThrow(DropError);
  });

  it('charges a fixed drop its price and refuses a fan-chosen amount', () => {
    const fixed = { priceType: 'FIXED', price: price('9.99') };
    expect(resolveDropAmountCents(fixed)).toBe(999);
    expect(() => resolveDropAmountCents(fixed, 2000)).toThrow('fixed price');
  });
});

describe('createDropSchema', () => {
  const valid = {
    title: 'Single',
    priceType: 'PAY_WHAT_YOU_WANT',
    price: 3,
    startsAt: '2026-12-01T00:00:00Z',
    contentIds: ['content-1'],
  };

  it('accepts an early pay-what-you-want drop with a minimum', () => {
    expect(createDropSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['a price under Stripe’s minimum', { price: 0.49 }],
    ['an end before the start', { endsAt: '2026-11-30T00:00:00Z' }],
    ['no content', { contentIds: [] }],
    ['an unknown field', { soldCount: 5 }],
    ['a presale that opens at or after the start', { presaleStartsAt: '2026-12-01T00:00:00Z' }],
  ])('rejects %s', (_label, change) => {
    expect(createDropSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('createDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.drops.create.mockImplementation(({ data }: any) => ({
      ...data,
      drop_content: data.drop_content.create,
    }));
  });

  const input = createDropSchema.parse({
    title: 'Single',
    priceType: 'PAY_WHAT_YOU_WANT',
    price: 3,
    startsAt: '2026-12-01T00:00:00Z',
    contentIds: ['content-1', 'content-1'],
  });

  it('creates a draft drop with the artist’s private content', async () => {
    db.content.findMany.mockResolvedValue([{ id: 'content-1', visibility: 'PRIVATE' }]);

    const drop = await createDrop('artist-1', input);

    expect(db.content.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['content-1'] }, artistId: 'artist-1' },
      select: { id: true, visibility: true },
    });
    expect(drop).toMatchObject({ artistId: 'artist-1', status: 'DRAFT', price: 3 });
    expect(drop.drop_content).toEqual([{ contentId: 'content-1' }]);
  });

  it('refuses content that belongs to someone else', async () => {
    db.content.findMany.mockResolvedValue([]);

    await expect(createDrop('artist-1', input)).rejects.toThrow('not found');
    expect(db.drops.create).not.toHaveBeenCalled();
  });

  it('refuses public content, which is already free', async () => {
    db.content.findMany.mockResolvedValue([{ id: 'content-1', visibility: 'PUBLIC' }]);

    await expect(createDrop('artist-1', input)).rejects.toThrow('already free');
  });
});

describe('updateDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.drops.update.mockResolvedValue({ ...baseDrop, drop_content: [] });
  });

  it('lets the artist publish their drop', async () => {
    db.drops.findUnique.mockResolvedValue(baseDrop);

    await updateDrop('artist-1', 'drop-1', { status: 'PUBLISHED' });

    expect(db.drops.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'drop-1' }, data: { status: 'PUBLISHED' } })
    );
  });

  it('hides another artist’s drop', async () => {
    db.drops.findUnique.mockResolvedValue(baseDrop);

    await expect(updateDrop('artist-2', 'drop-1', { title: 'x' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('locks price and content after the first sale', async () => {
    db.drops.findUnique.mockResolvedValue({ ...baseDrop, soldCount: 1 });

    await expect(updateDrop('artist-1', 'drop-1', { price: 1 })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      updateDrop('artist-1', 'drop-1', { contentIds: ['content-2'] })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('sets a presale window that opens before the public start', async () => {
    db.drops.findUnique.mockResolvedValue(baseDrop);
    const presaleStartsAt = new Date('2026-11-28T00:00:00Z');

    await updateDrop('artist-1', 'drop-1', { presaleStartsAt });

    expect(db.drops.update.mock.calls[0][0].data).toEqual({ presaleStartsAt });
  });

  it('refuses a presale that would open after a moved public start', async () => {
    db.drops.findUnique.mockResolvedValue({
      ...baseDrop,
      presaleStartsAt: new Date('2026-11-28T00:00:00Z'),
    });

    await expect(
      updateDrop('artist-1', 'drop-1', { startsAt: new Date('2026-11-27T00:00:00Z') })
    ).rejects.toMatchObject({ status: 400 });
    expect(db.drops.update).not.toHaveBeenCalled();
  });

  it('keeps the quantity cap at or above what has sold', async () => {
    db.drops.findUnique.mockResolvedValue({ ...baseDrop, soldCount: 10 });

    await expect(updateDrop('artist-1', 'drop-1', { quantityLimit: 5 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('counts checkouts in progress as claimed', async () => {
    db.drops.findUnique.mockResolvedValue({ ...baseDrop, soldCount: 3, reservedCount: 2 });

    await expect(updateDrop('artist-1', 'drop-1', { quantityLimit: 4 })).rejects.toMatchObject({
      status: 400,
    });

    db.drops.findUnique.mockResolvedValue({ ...baseDrop, soldCount: 0, reservedCount: 1 });
    await expect(updateDrop('artist-1', 'drop-1', { price: 1 })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('toPublicDrop', () => {
  it('shows price, what is left and availability without content details', () => {
    const view = toPublicDrop({
      ...baseDrop,
      quantityLimit: 100,
      soldCount: 40,
      drop_content: [{ contentId: 'content-1' }],
    });

    expect(view).toMatchObject({ price: 3, remaining: 60, itemCount: 1 });
    expect(
      toPublicDrop({ ...baseDrop, quantityLimit: 100, soldCount: 40, reservedCount: 5 })
    ).toMatchObject({ remaining: 55 });
    expect(view).not.toHaveProperty('drop_content');
  });
});

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/api-auth', () => ({
  withArtistApi: (req: any, handler: any) => handler({ ...req, user: { id: 'artist-1' } }),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as getDrop } from '../[id]/route';
import { POST as createDropRoute } from '../../artist/drops/route';

const db = prisma as any;
const mockSession = getServerSession as jest.Mock;

const drop = {
  id: 'drop-1',
  artistId: 'artist-1',
  title: 'Single',
  description: null,
  priceType: 'PAY_WHAT_YOU_WANT',
  price: { toString: () => '3' },
  currency: 'usd',
  startsAt: new Date(Date.now() - 1000),
  endsAt: null,
  quantityLimit: null,
  soldCount: 0,
  status: 'PUBLISHED',
  drop_content: [{ contentId: 'content-1' }],
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/drops/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a published drop and whether the fan owns it', async () => {
    db.drops.findUnique.mockResolvedValue(drop);
    mockSession.mockResolvedValue({ user: { id: 'fan-1' } });
    db.purchases.findFirst.mockResolvedValue({ id: 'pur-1' });

    const res = await getDrop({} as any, params('drop-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      id: 'drop-1',
      price: 3,
      availability: 'on_sale',
      owned: true,
    });
    expect(body.data).not.toHaveProperty('drop_content');
  });

  it('hides a draft', async () => {
    db.drops.findUnique.mockResolvedValue({ ...drop, status: 'DRAFT' });

    const res = await getDrop({} as any, params('drop-1'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/artist/drops', () => {
  beforeEach(() => jest.clearAllMocks());

  const req = (body: unknown) => ({ json: async () => body }) as any;

  it('creates a drop for the signed-in artist', async () => {
    db.content.findMany.mockResolvedValue([{ id: 'content-1', visibility: 'PRIVATE' }]);
    db.drops.create.mockResolvedValue({ ...drop, status: 'DRAFT' });

    const res = await createDropRoute(
      req({
        title: 'Single',
        priceType: 'PAY_WHAT_YOU_WANT',
        price: 3,
        startsAt: new Date().toISOString(),
        contentIds: ['content-1'],
      })
    );

    expect(res.status).toBe(201);
    expect(db.drops.create.mock.calls[0][0].data.artistId).toBe('artist-1');
  });

  it('rejects invalid input', async () => {
    const res = await createDropRoute(req({ title: '', priceType: 'FREE' }));

    expect(res.status).toBe(400);
    expect(db.drops.create).not.toHaveBeenCalled();
  });
});

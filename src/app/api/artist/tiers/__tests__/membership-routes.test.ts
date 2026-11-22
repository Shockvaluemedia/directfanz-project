jest.mock('@/lib/api-auth', () => ({
  withArtistApi: (req: any, handler: any) => handler({ ...req, user: { id: 'artist-1' } }),
}));
jest.mock('@/lib/database', () => ({
  getTiersByArtistId: jest.fn(),
  createTier: jest.fn(),
  updateTier: jest.fn(),
  deleteTier: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { createTier, getTiersByArtistId, updateTier } from '@/lib/database';
import { POST } from '../route';
import { PUT } from '../[id]/route';

const db = prisma as any;
const request = (body: unknown) => ({ json: async () => body }) as any;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const membership = {
  name: 'Members',
  description: 'Early access and drop discounts',
  minimumPrice: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getTiersByArtistId as jest.Mock).mockResolvedValue([]);
  (createTier as jest.Mock).mockResolvedValue({ id: 'tier-1' });
  (updateTier as jest.Mock).mockResolvedValue({ id: 'tier-2' });
});

describe('one membership per artist', () => {
  it('opens the artist’s first membership', async () => {
    db.tiers.findFirst.mockResolvedValue(null);

    const res = await POST(request(membership));

    expect(res.status).toBe(201);
    expect(createTier).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: 'artist-1', minimumPrice: 3 })
    );
  });

  it('refuses a second while one is active', async () => {
    db.tiers.findFirst.mockResolvedValue({ id: 'tier-1' });

    const res = await POST(request({ ...membership, name: 'VIP' }));

    expect(res.status).toBe(409);
    expect(createTier).not.toHaveBeenCalled();
  });

  it('refuses turning an old tier back on while another is active', async () => {
    db.tiers.findFirst
      .mockResolvedValueOnce({ id: 'tier-2', artistId: 'artist-1', isActive: false, name: 'Old' })
      .mockResolvedValueOnce({ id: 'tier-1' });

    const res = await PUT(request({ isActive: true }), params('tier-2'));

    expect(res.status).toBe(409);
    expect(updateTier).not.toHaveBeenCalled();
  });

  it('lets the artist edit their membership', async () => {
    db.tiers.findFirst.mockResolvedValueOnce({
      id: 'tier-1',
      artistId: 'artist-1',
      isActive: true,
      name: 'Members',
    });

    const res = await PUT(request({ minimumPrice: 4 }), params('tier-1'));

    expect(res.status).toBe(200);
    expect(updateTier).toHaveBeenCalledWith('tier-1', { minimumPrice: 4 });
  });
});

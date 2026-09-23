/**
 * GET /api/content/[id] decides access with the same rule as the media routes
 * and shapes the response so the raw storage URL only reaches the owner or
 * goes out for public content; everyone else gets the gated app URLs. Locked
 * content returns a teaser (no media, no comments) instead of a bare 403.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));
jest.mock('@/lib/content-access', () => ({
  ...jest.requireActual('@/lib/content-access'),
  checkContentAccess: jest.fn(),
}));

const mockAuth = { user: { id: 'fan-1', role: 'FAN', email: 'fan@example.com', name: 'Fan' } };
jest.mock('@/lib/api-auth', () => ({
  withApi: (request: any, handler: any) => handler(Object.assign(request, { user: mockAuth.user })),
}));

const { checkContentAccess } = require('@/lib/content-access');
const { GET } = require('@/app/api/content/[id]/route');

const BLOB_URL = 'https://store.public.blob.vercel-storage.com/content/artist-1/video/a.mp4';
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Backstage',
  description: 'Exclusive',
  type: 'VIDEO',
  visibility: 'SUBSCRIBERS_ONLY',
  artistId: 'artist-1',
  fileUrl: BLOB_URL,
  thumbnailUrl: 'https://store.public.blob.vercel-storage.com/content/artist-1/video/a-thumb.jpg',
  tags: '["tour"]',
  createdAt: new Date('2026-01-02T00:00:00Z'),
  totalViews: 12,
  totalLikes: 3,
  users: { id: 'artist-1', displayName: 'Casey', avatar: null },
  tiers: [{ id: 't1', name: 'Gold', minimumPrice: 5 }],
  comments: [{ id: 'k1', text: 'hi', users: { id: 'fan-9', displayName: 'X', avatar: null } }],
  ...overrides,
});

const get = () =>
  GET(new NextRequest('http://localhost:3000/api/content/c1'), { params: Promise.resolve({ id: 'c1' }) });

describe('GET /api/content/[id]', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'fan-1', role: 'FAN', email: 'fan@example.com', name: 'Fan' };
    (checkContentAccess as jest.Mock).mockReset();
    (prisma.content.findUnique as jest.Mock).mockReset();
  });

  it('gives an entitled fan the gated app URLs but not the storage URL', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row());
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'subscription' });

    const response = await get();
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(checkContentAccess).toHaveBeenCalledWith('fan-1', 'c1');
    expect(data.hasAccess).toBe(true);
    expect(data.streamUrl).toBe('/api/content/c1/stream');
    expect(data.downloadUrl).toBe('/api/content/c1/download');
    expect(data).not.toHaveProperty('fileUrl');
    expect(data.tags).toEqual(['tour']);
    expect(data.comments).toHaveLength(1);
  });

  it('gives the owner the storage URL as well', async () => {
    mockAuth.user = { id: 'artist-1', role: 'ARTIST', email: 'a@example.com', name: 'Casey' };
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row());
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'owner' });

    const { data } = await (await get()).json();

    expect(data.fileUrl).toBe(BLOB_URL);
    expect(data.streamUrl).toBe('/api/content/c1/stream');
  });

  it('keeps the storage URL for public content', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row({ visibility: 'PUBLIC' }));
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'public' });

    const { data } = await (await get()).json();

    expect(data.fileUrl).toBe(BLOB_URL);
    expect(data.hasAccess).toBe(true);
  });

  it('returns a teaser without media URLs or comments when access is denied', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row());
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'no_subscription' });

    const response = await get();
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasAccess).toBe(false);
    expect(data).toMatchObject({ id: 'c1', title: 'Backstage', visibility: 'SUBSCRIBERS_ONLY' });
    expect(data.tiers).toEqual([{ id: 't1', name: 'Gold', minimumPrice: 5 }]);
    expect(data.thumbnailUrl).toContain('a-thumb.jpg');
    for (const key of ['fileUrl', 'streamUrl', 'downloadUrl', 'comments']) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it('hides the thumbnail of a locked image, which is a downscaled copy of the paid image', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row({ type: 'IMAGE' }));
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'no_subscription' });

    const { data } = await (await get()).json();

    expect(data.thumbnailUrl).toBeNull();
  });

  it('returns 404 when the content does not exist', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
  });
});

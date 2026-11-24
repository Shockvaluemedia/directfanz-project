/**
 * GET /api/content (list) must not hand fans the raw storage URL of gated
 * items they are entitled to; they get the access-checked app URLs. Owners and
 * public items keep the URL.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const mockAuth = { user: { id: 'fan-1', role: 'FAN', email: 'fan@example.com', name: 'Fan' } };
jest.mock('@/lib/api-auth', () => {
  const passthrough = (request: any, handler: any) => handler(Object.assign(request, { user: mockAuth.user }));
  return { withApi: passthrough, withArtistApi: passthrough, withAdminApi: passthrough };
});

const { GET } = require('@/app/api/content/route');

const GATED_URL = 'https://store.public.blob.vercel-storage.com/content/artist-1/audio/gated.mp3';
const PUBLIC_URL = 'https://store.public.blob.vercel-storage.com/content/artist-1/audio/free.mp3';

const item = (overrides: Record<string, unknown>) => ({
  id: 'c-gated',
  title: 'Gated',
  description: null,
  type: 'AUDIO',
  fileUrl: GATED_URL,
  thumbnailUrl: null,
  visibility: 'TIER_LOCKED',
  artistId: 'artist-1',
  tags: '["a"]',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  users: { id: 'artist-1', displayName: 'Casey', avatar: null },
  tiers: [{ id: 't1', name: 'Gold', minimumPrice: 5 }],
  _count: { comments: 2 },
  ...overrides,
});

describe('GET /api/content', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'fan-1', role: 'FAN', email: 'fan@example.com', name: 'Fan' };
    (prisma.subscriptions.findMany as jest.Mock).mockReset().mockResolvedValue([{ tierId: 't1' }]);
    (prisma.content.findMany as jest.Mock).mockReset().mockResolvedValue([
      item({}),
      item({ id: 'c-free', title: 'Free', visibility: 'PUBLIC', fileUrl: PUBLIC_URL }),
    ]);
    (prisma.content.count as jest.Mock).mockReset().mockResolvedValue(2);
  });

  it('gives a fan gated app URLs for gated items and the storage URL only for public ones', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/content'));
    const body = await response.json();

    expect(response.status).toBe(200);
    const items: any[] = body.data.content;
    const gated = items.find(i => i.id === 'c-gated');
    const free = items.find(i => i.id === 'c-free');

    expect(gated).not.toHaveProperty('fileUrl');
    expect(gated.streamUrl).toBe('/api/content/c-gated/stream');
    expect(gated.downloadUrl).toBe('/api/content/c-gated/download');
    expect(gated.tags).toEqual(['a']);
    expect(gated.commentCount).toBe(2);
    expect(free.fileUrl).toBe(PUBLIC_URL);
  });

  it('gives the owner the storage URL', async () => {
    mockAuth.user = { id: 'artist-1', role: 'ARTIST', email: 'a@example.com', name: 'Casey' };

    const response = await GET(new NextRequest('http://localhost:3000/api/content'));
    const body = await response.json();

    expect(response.status).toBe(200);
    const gated = body.data.content.find((i: any) => i.id === 'c-gated');
    expect(gated.fileUrl).toBe(GATED_URL);
    expect(gated.streamUrl).toBe('/api/content/c-gated/stream');
  });
});

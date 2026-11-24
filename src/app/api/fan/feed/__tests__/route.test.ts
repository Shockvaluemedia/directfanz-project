/**
 * The fan feed must not hand out the raw storage URL of gated items; fans get
 * the access-checked app URLs instead. Public items keep their URL.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { getServerSession } = require('next-auth');
const { GET } = require('@/app/api/fan/feed/route');

const GATED_URL = 'https://store.public.blob.vercel-storage.com/content/artist-1/video/gated.mp4';
const PUBLIC_URL = 'https://store.public.blob.vercel-storage.com/content/artist-1/video/free.mp4';

const item = (overrides: Record<string, unknown>) => ({
  id: 'c-gated',
  title: 'Gated',
  description: null,
  type: 'VIDEO',
  fileUrl: GATED_URL,
  thumbnailUrl: null,
  fileSize: 1,
  format: 'video/mp4',
  tags: '[]',
  visibility: 'TIER_LOCKED',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  users: { id: 'artist-1', displayName: 'Casey', avatar: null },
  tiers: [{ id: 't1', name: 'Gold' }],
  ...overrides,
});

describe('GET /api/fan/feed', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1', role: 'FAN' } });
    (prisma.subscriptions.findMany as jest.Mock).mockReset().mockResolvedValue([{ artistId: 'artist-1', tierId: 't1' }]);
    (prisma.content.findMany as jest.Mock).mockReset().mockResolvedValue([
      item({}),
      item({ id: 'c-free', title: 'Free', visibility: 'PUBLIC', fileUrl: PUBLIC_URL }),
    ]);
    (prisma.content.count as jest.Mock).mockReset().mockResolvedValue(2);
    (prisma.content_views.count as jest.Mock).mockReset().mockResolvedValue(0);
    (prisma.content_views.findMany as jest.Mock).mockReset().mockResolvedValue([]);
    (prisma.content_likes.findMany as jest.Mock).mockReset().mockResolvedValue([]);
    (prisma.content_likes.count as jest.Mock).mockReset().mockResolvedValue(0);
    (prisma.comments.count as jest.Mock).mockReset().mockResolvedValue(0);
  });

  it('replaces the storage URL of gated items with the gated app URLs', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/fan/feed'));
    const body = await response.json();
    const items: any[] = body.data?.content ?? body.content ?? body.data;

    expect(response.status).toBe(200);
    expect(Array.isArray(items)).toBe(true);

    const gated = items.find(i => i.id === 'c-gated');
    const free = items.find(i => i.id === 'c-free');

    expect(gated).not.toHaveProperty('fileUrl');
    expect(gated.streamUrl).toBe('/api/content/c-gated/stream');
    expect(gated.downloadUrl).toBe('/api/content/c-gated/download');
    expect(free.fileUrl).toBe(PUBLIC_URL);
    expect(free.streamUrl).toBe('/api/content/c-free/stream');
  });
});

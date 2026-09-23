import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { getServerSession } = require('next-auth');
const { GET } = require('@/app/api/admin/content/route');

const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin' } };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Track one',
  type: 'AUDIO',
  status: 'PENDING_REVIEW',
  createdAt: new Date('2026-01-02T03:04:05Z'),
  thumbnailUrl: null,
  reviewReason: null,
  users: { displayName: 'Casey', email: 'casey@example.com' },
  ...overrides,
});

const get = (query = '') => GET(new NextRequest(`http://localhost:3000/api/admin/content${query}`));

describe('GET /api/admin/content', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (prisma.content.findMany as jest.Mock).mockReset();
    (prisma.content.count as jest.Mock).mockReset();
  });

  it('requires a session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(401);
  });

  it('requires the ADMIN role', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1', role: 'FAN' } });
    const response = await get();
    expect(response.status).toBe(403);
    expect(prisma.content.findMany).not.toHaveBeenCalled();
  });

  it('returns the queue in the shape the admin page reads, with statuses translated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    (prisma.content.findMany as jest.Mock).mockResolvedValue([
      row(),
      row({ id: 'c2', status: 'PUBLISHED', thumbnailUrl: 'https://cdn/x.jpg', reviewReason: 'ok' }),
      row({ id: 'c3', status: 'REJECTED' }),
      row({ id: 'c4', status: 'UNDER_REVIEW' }),
    ]);
    (prisma.content.count as jest.Mock).mockResolvedValue(4);

    const response = await get();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content.map((c: { status: string }) => c.status)).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
      'PENDING',
    ]);
    expect(data.content[0]).toEqual({
      id: 'c1',
      title: 'Track one',
      type: 'AUDIO',
      artistName: 'Casey',
      artistEmail: 'casey@example.com',
      status: 'PENDING',
      createdAt: '2026-01-02T03:04:05.000Z',
    });
    expect(data.content[1]).toMatchObject({ previewUrl: 'https://cdn/x.jpg', reason: 'ok' });
    expect(data.pagination).toEqual({ limit: 100, offset: 0, total: 4, hasNext: false });
    // Newest first, no status filter by default.
    expect(prisma.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' }, take: 100, skip: 0 })
    );
  });

  it('maps a PENDING filter onto both database review statuses', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    (prisma.content.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.content.count as jest.Mock).mockResolvedValue(0);

    const response = await get('?status=PENDING&limit=10&offset=20');

    expect(response.status).toBe(200);
    expect(prisma.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } },
        take: 10,
        skip: 20,
      })
    );
  });

  it('rejects invalid parameters', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    const response = await get('?limit=abc');
    expect(response.status).toBe(400);
    expect(prisma.content.findMany).not.toHaveBeenCalled();
  });
});

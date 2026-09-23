import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

// No REDIS_URL in tests: the client is null and the route must say so safely.
jest.mock('@/lib/redis', () => ({
  ...jest.requireActual('@/lib/redis'),
  getRedisClient: jest.fn(() => null),
}));

const { getServerSession } = require('next-auth');
const { GET } = require('@/app/api/admin/monitoring/route');

const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin' } };

const get = () => GET(new NextRequest('http://localhost:3000/api/admin/monitoring'));

// Every number the page renders goes through .toFixed / .toLocaleString, so it
// must be a finite number, never null, undefined, or NaN.
function expectRenderableShape(data: Record<string, any>) {
  expect(typeof data.status).toBe('string');
  expect(Number.isFinite(data.activeUsers)).toBe(true);
  expect(Number.isFinite(data.apiLatency)).toBe(true);
  expect(Number.isFinite(data.errorRate)).toBe(true);
  expect(typeof data.uptime).toBe('string');
  expect(typeof data.database.status).toBe('string');
  expect(Number.isFinite(data.database.latency)).toBe(true);
  expect(Number.isFinite(data.database.connections)).toBe(true);
  expect(typeof data.redis.status).toBe('string');
  expect(typeof data.redis.memoryUsage).toBe('string');
  expect(Number.isFinite(data.redis.hitRate)).toBe(true);
  expect(Array.isArray(data.endpoints)).toBe(true);
  expect(Array.isArray(data.recentErrors)).toBe(true);
}

describe('GET /api/admin/monitoring', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (prisma.$queryRaw as jest.Mock).mockReset();
    (prisma.users.count as jest.Mock).mockReset();
  });

  it('requires the ADMIN role', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1', role: 'FAN' } });
    const response = await get();
    expect(response.status).toBe(403);
  });

  it('returns the full metrics shape at the top level when the database is healthy', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }]) // SELECT 1
      .mockResolvedValueOnce([{ count: 7 }]); // pg_stat_activity
    (prisma.users.count as jest.Mock).mockResolvedValue(42);

    const response = await get();
    const data = await response.json();

    expect(response.status).toBe(200);
    expectRenderableShape(data);
    expect(data.status).toBe('healthy');
    expect(data.database).toMatchObject({ status: 'healthy', connections: 7 });
    expect(data.activeUsers).toBe(42);
    expect(data.redis).toMatchObject({ status: 'not_configured', memoryUsage: 'N/A' });
    expect(data.endpoints).toEqual([]);
    expect(data.recentErrors).toEqual([]);
  });

  it('still returns a complete, renderable payload when the database probe fails', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('connection refused'));
    (prisma.users.count as jest.Mock).mockRejectedValue(new Error('connection refused'));

    const response = await get();
    const data = await response.json();

    expect(response.status).toBe(200);
    expectRenderableShape(data);
    expect(data.status).toBe('unhealthy');
    expect(data.database).toEqual({ status: 'unhealthy', latency: 0, connections: 0 });
    expect(data.activeUsers).toBe(0);
  });
});

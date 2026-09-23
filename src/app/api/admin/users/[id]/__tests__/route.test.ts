import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { getServerSession } = require('next-auth');
const { logger } = require('@/lib/logger');
const { PATCH } = require('@/app/api/admin/users/[id]/route');

const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin' } };

const fan = (overrides: Record<string, unknown> = {}) => ({
  id: 'u2',
  email: 'fan@example.com',
  displayName: 'Fan Two',
  role: 'FAN',
  status: 'ACTIVE',
  ...overrides,
});

const patch = (body: unknown, id = 'u2') =>
  PATCH(
    new NextRequest(`http://localhost:3000/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    [prisma.users.findUnique, prisma.users.update, prisma.refresh_tokens.updateMany].forEach(fn =>
      (fn as jest.Mock).mockReset()
    );
    // The first findUnique is the caller's database role re-check.
    (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce({ role: 'ADMIN' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma));
    (logger.securityEvent as jest.Mock).mockClear();
  });

  it('refuses when the database no longer says the caller is an admin', async () => {
    (prisma.users.findUnique as jest.Mock).mockReset().mockResolvedValueOnce({ role: 'FAN' });
    const response = await patch({ isBanned: true });
    expect(response.status).toBe(403);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('rejects a malformed body', async () => {
    const response = await patch({ isBanned: 'yes' });
    expect(response.status).toBe(400);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('refuses to ban the caller', async () => {
    const response = await patch({ isBanned: true }, 'admin-1');
    expect(response.status).toBe(400);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const response = await patch({ isBanned: true });
    expect(response.status).toBe(404);
  });

  it('refuses to ban another admin', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(fan({ role: 'ADMIN' }));
    const response = await patch({ isBanned: true });
    expect(response.status).toBe(403);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('bans: sets BANNED, revokes refresh tokens, and logs a high-severity event', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(fan());
    (prisma.users.update as jest.Mock).mockResolvedValue(fan({ status: 'BANNED' }));

    const response = await patch({ isBanned: true });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({
      id: 'u2',
      email: 'fan@example.com',
      name: 'Fan Two',
      role: 'FAN',
      status: 'BANNED',
      isBanned: true,
    });
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u2' }, data: expect.objectContaining({ status: 'BANNED' }) })
    );
    expect(prisma.refresh_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u2', isRevoked: false },
        data: expect.objectContaining({ isRevoked: true }),
      })
    );
    expect(logger.securityEvent).toHaveBeenCalledWith(
      'admin_user_banned',
      'high',
      expect.objectContaining({ adminUserId: 'admin-1', targetUserId: 'u2' })
    );
  });

  it('unbans: sets ACTIVE without touching refresh tokens', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(fan({ status: 'BANNED' }));
    (prisma.users.update as jest.Mock).mockResolvedValue(fan({ status: 'ACTIVE' }));

    const response = await patch({ isBanned: false });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.isBanned).toBe(false);
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    );
    expect(prisma.refresh_tokens.updateMany).not.toHaveBeenCalled();
    expect(logger.securityEvent).toHaveBeenCalledWith('admin_user_unbanned', 'high', expect.anything());
  });
});

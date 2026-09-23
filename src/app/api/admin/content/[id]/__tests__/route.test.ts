import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { getServerSession } = require('next-auth');
const { logger } = require('@/lib/logger');
const { PATCH } = require('@/app/api/admin/content/[id]/route');

const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin' } };

const existing = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  status: 'PENDING_REVIEW',
  visibility: 'PUBLIC',
  metadata: null,
  ...overrides,
});

const updatedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Track one',
  type: 'AUDIO',
  status: 'PUBLISHED',
  createdAt: new Date('2026-01-02T03:04:05Z'),
  thumbnailUrl: null,
  reviewReason: 'Approved by admin review',
  users: { displayName: 'Casey', email: 'casey@example.com' },
  ...overrides,
});

const patch = (body: unknown, id = 'c1') =>
  PATCH(
    new NextRequest(`http://localhost:3000/api/admin/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe('PATCH /api/admin/content/[id]', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    [prisma.users.findUnique, prisma.content.findUnique, prisma.content.update, prisma.moderation_logs.create].forEach(
      fn => (fn as jest.Mock).mockReset()
    );
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
    (logger.securityEvent as jest.Mock).mockClear();
  });

  it('refuses when the database no longer says the caller is an admin', async () => {
    // The session role is a JWT claim that can be up to two hours stale.
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ role: 'FAN' });
    const response = await patch({ status: 'APPROVED' });
    expect(response.status).toBe(403);
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown status', async () => {
    const response = await patch({ status: 'FLAGGED' });
    expect(response.status).toBe(400);
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('returns 404 for missing content', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await patch({ status: 'APPROVED' });
    expect(response.status).toBe(404);
  });

  it('approves: publishes, records the reviewer, and writes an audit row', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(existing());
    (prisma.content.update as jest.Mock).mockResolvedValue(updatedRow());

    const response = await patch({ status: 'APPROVED' });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toMatchObject({ id: 'c1', status: 'APPROVED', reason: 'Approved by admin review' });

    const update = (prisma.content.update as jest.Mock).mock.calls[0][0];
    expect(update.where).toEqual({ id: 'c1' });
    expect(update.data).toMatchObject({
      status: 'PUBLISHED',
      reviewedBy: 'admin-1',
      reviewReason: 'Approved by admin review',
    });
    expect(update.data.reviewedAt).toBeInstanceOf(Date);
    // Nothing was stashed, so visibility and metadata are left alone.
    expect(update.data).not.toHaveProperty('visibility');
    expect(update.data).not.toHaveProperty('metadata');

    expect(prisma.moderation_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contentId: 'c1', userId: 'admin-1', status: 'PUBLISHED' }),
    });
    expect(logger.securityEvent).toHaveBeenCalledWith(
      'admin_content_reviewed',
      'medium',
      expect.objectContaining({ contentId: 'c1', action: 'APPROVED', newStatus: 'PUBLISHED' })
    );
  });

  it('rejects: hides the item from fans and remembers its previous visibility', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(existing({ visibility: 'PUBLIC' }));
    (prisma.content.update as jest.Mock).mockResolvedValue(
      updatedRow({ status: 'REJECTED', reviewReason: 'Copyright' })
    );

    const response = await patch({ status: 'REJECTED', reason: 'Copyright' });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content.status).toBe('REJECTED');

    const update = (prisma.content.update as jest.Mock).mock.calls[0][0];
    expect(update.data).toMatchObject({ status: 'REJECTED', visibility: 'PRIVATE', reviewReason: 'Copyright' });
    expect(JSON.parse(update.data.metadata)).toEqual({ adminPreviousVisibility: 'PUBLIC' });
  });

  it('approving a previously rejected item restores its stashed visibility', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(
      existing({
        status: 'REJECTED',
        visibility: 'PRIVATE',
        metadata: JSON.stringify({ adminPreviousVisibility: 'PUBLIC', other: 1 }),
      })
    );
    (prisma.content.update as jest.Mock).mockResolvedValue(updatedRow());

    const response = await patch({ status: 'APPROVED' });

    expect(response.status).toBe(200);
    const update = (prisma.content.update as jest.Mock).mock.calls[0][0];
    expect(update.data).toMatchObject({ status: 'PUBLISHED', visibility: 'PUBLIC' });
    // The stash is consumed; unrelated metadata survives.
    expect(JSON.parse(update.data.metadata)).toEqual({ other: 1 });
  });

  it('does not let an audit-row failure undo the review', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(existing());
    (prisma.content.update as jest.Mock).mockResolvedValue(updatedRow());
    (prisma.moderation_logs.create as jest.Mock).mockRejectedValue(new Error('column "contentid" does not exist'));

    const response = await patch({ status: 'APPROVED' });

    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith('Moderation log write failed', expect.objectContaining({ contentId: 'c1' }));
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isAdminInDatabase } from '@/lib/admin-moderation';

const banSchema = z.object({
  isBanned: z.boolean(),
});

const userSelect = { id: true, email: true, displayName: true, role: true, status: true } as const;

function formatUser(user: { id: string; email: string; displayName: string; role: string; status: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    role: user.role,
    status: user.status,
    isBanned: user.status === 'BANNED',
  };
}

// PATCH /api/admin/users/[id] - ban or unban an account
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withAdminApi(request, async req => {
    try {
      if (!(await isAdminInDatabase(req.user.id))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json().catch(() => null);
      const parsed = banSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.errors },
          { status: 400 }
        );
      }

      if (id === req.user.id) {
        return NextResponse.json({ error: 'You cannot ban your own account' }, { status: 400 });
      }

      const target = await prisma.users.findUnique({ where: { id }, select: userSelect });
      if (!target) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (target.role === 'ADMIN') {
        return NextResponse.json({ error: 'Admin accounts cannot be banned' }, { status: 403 });
      }

      const { isBanned } = parsed.data;
      const now = new Date();

      const updated = await prisma.$transaction(async tx => {
        const user = await tx.users.update({
          where: { id },
          data: { status: isBanned ? 'BANNED' : 'ACTIVE', updatedAt: now },
          select: userSelect,
        });
        if (isBanned) {
          // Sessions are stateless JWTs and can't be revoked here, but refresh
          // tokens can, so a banned account can't silently mint new sessions.
          await tx.refresh_tokens.updateMany({
            where: { userId: id, isRevoked: false },
            data: { isRevoked: true, updatedAt: now },
          });
        }
        return user;
      });

      logger.securityEvent(isBanned ? 'admin_user_banned' : 'admin_user_unbanned', 'high', {
        adminUserId: req.user.id,
        targetUserId: id,
      });

      return NextResponse.json({ success: true, user: formatUser(updated) });
    } catch (error) {
      logger.error(
        'Admin user ban/unban error',
        { adminUserId: req.user?.id, targetUserId: id },
        error as Error
      );
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  });
}

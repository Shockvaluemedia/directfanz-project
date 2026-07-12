import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const VALID_ROLES = ['FAN', 'ARTIST', 'ADMIN'] as const;

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the caller actually holds the ADMIN role in the database
    const actor = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (actor?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Normalize and validate the requested role against the DB enum
    const role = String(body.role ?? '').toUpperCase();
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const updated = await prisma.users.update({
      where: { id: body.userId },
      data: { role, updatedAt: new Date() },
      select: { id: true, role: true },
    });

    logger.info('Admin changed user role', {
      adminUserId: session.user.id,
      targetUserId: body.userId,
      newRole: role,
    });

    return NextResponse.json({
      message: 'User role updated successfully',
      user: {
        id: updated.id,
        role: updated.role,
      },
    });
  } catch (error) {
    logger.error('Change role error', undefined, error as Error);
    return NextResponse.json({ error: 'Failed to change user role' }, { status: 500 });
  }
}

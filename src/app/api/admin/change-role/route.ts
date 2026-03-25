import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const changeRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['FAN', 'ARTIST', 'ADMIN'], {
    errorMap: () => ({ message: 'Invalid role. Must be FAN, ARTIST, or ADMIN' }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = changeRoleSchema.parse(body);

    // Prevent admin from changing their own role
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousRole = targetUser.role;

    // Update the role
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { role },
      select: { id: true, displayName: true, email: true, role: true },
    });

    // If promoting to ARTIST, ensure an artist record exists
    if (role === 'ARTIST') {
      await prisma.artists.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    }

    logger.info('User role changed', {
      adminId: session.user.id,
      targetUserId: userId,
      previousRole,
      newRole: role,
    });

    return NextResponse.json({
      success: true,
      message: `User role updated from ${previousRole} to ${role}`,
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to change user role', {}, error as Error);
    return NextResponse.json({ error: 'Failed to change user role' }, { status: 500 });
  }
}

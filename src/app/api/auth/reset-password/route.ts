import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { hashPasswordResetToken, isPasswordResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';

const requestSchema = z.object({
  token: z.string().refine(isPasswordResetToken),
  newPassword: z.string().min(8).max(128),
});

const INVALID_TOKEN_RESPONSE = {
  error: 'This password reset link is invalid or has expired',
};

class InvalidPasswordResetTokenError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Use a valid reset link and a password between 8 and 128 characters' },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const now = new Date();
    const resetToken = await prisma.password_reset_tokens.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.$transaction(async transaction => {
      const claimed = await transaction.password_reset_tokens.updateMany({
        where: {
          id: resetToken.id,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new InvalidPasswordResetTokenError();
      }

      await transaction.users.update({
        where: { id: resetToken.userId },
        data: {
          password: passwordHash,
          sessionVersion: { increment: 1 },
          updatedAt: now,
        },
      });

      await transaction.sessions.deleteMany({
        where: { userId: resetToken.userId },
      });

      await transaction.refresh_tokens.updateMany({
        where: {
          userId: resetToken.userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          updatedAt: now,
        },
      });
    });

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
    }

    // Database errors can include query data; keep password material out of logs.
    logger.error('Password reset failed');
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

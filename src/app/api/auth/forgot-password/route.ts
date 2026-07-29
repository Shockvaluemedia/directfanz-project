import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RATE_LIMIT_CONFIGS } from '@/config/security';
import { sendPasswordResetEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limiting';

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
});

const GENERIC_RESPONSE = {
  message: "If an account with that email exists, we've sent a password reset link",
};

const passwordResetRateLimiter = createRateLimiter(
  RATE_LIMIT_CONFIGS.AUTH_PASSWORD_RESET,
  'auth-password-reset'
);

async function requestPasswordReset(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        displayName: true,
        password: true,
      },
    });

    // Keep the response identical for unknown and passwordless accounts.
    if (!user?.password) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const resetToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(resetToken);
    const now = new Date();

    await prisma.password_reset_tokens.upsert({
      where: { userId: user.id },
      update: {
        tokenHash,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
        usedAt: null,
        createdAt: now,
      },
      create: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    const sent = await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userName: user.displayName,
    });

    if (!sent) {
      logger.warn('Password reset email was not delivered', { userId: user.id });
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch {
    // Provider and database errors can include request data; do not risk logging
    // the recipient address or reset token.
    logger.error('Password reset request failed');
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(passwordResetRateLimiter)(requestPasswordReset);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Always return success to prevent email enumeration attacks
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link",
    });

    // Look up user
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, displayName: true, email: true },
    });

    if (!user) {
      // Return same response to prevent enumeration
      return successResponse;
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store the token in verification_tokens table
    await prisma.verificationtokens.upsert({
      where: {
        identifier_token: {
          identifier: `password-reset:${user.id}`,
          token: tokenHash,
        },
      },
      update: {
        token: tokenHash,
        expires: expiresAt,
      },
      create: {
        identifier: `password-reset:${user.id}`,
        token: tokenHash,
        expires: expiresAt,
      },
    });

    // Send reset email via the email service
    try {
      const emailModule = await import('@/lib/email-service');
      const emailService = emailModule.default;
      await emailService.sendPasswordReset(user.email, user.displayName, resetToken);
    } catch (emailError) {
      logger.error('Failed to send password reset email', { userId: user.id }, emailError as Error);
      // Still return success — don't leak that the email failed
    }

    logger.info('Password reset requested', { userId: user.id });

    return successResponse;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    logger.error('Forgot password error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

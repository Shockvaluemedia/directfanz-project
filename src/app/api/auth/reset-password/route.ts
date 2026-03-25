import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find a valid, non-expired token
    const storedToken = await prisma.verificationtokens.findFirst({
      where: {
        token: tokenHash,
        identifier: { startsWith: 'password-reset:' },
        expires: { gt: new Date() },
      },
    });

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset token' },
        { status: 400 }
      );
    }

    // Extract user ID from identifier
    const userId = storedToken.identifier.replace('password-reset:', '');

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete the used token (and any other reset tokens for this user)
    await prisma.verificationtokens.deleteMany({
      where: { identifier: storedToken.identifier },
    });

    // Invalidate all existing sessions for this user
    await prisma.sessions.deleteMany({
      where: { userId },
    });

    logger.info('Password reset successful', { userId });

    return NextResponse.json({
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Reset password error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

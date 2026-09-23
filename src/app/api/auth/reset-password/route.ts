import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { hashResetToken, userIdFromResetIdentifier } from '@/lib/password-reset';

// Defined inline (like change-password) because @/lib/validations is mocked in
// the auth integration tests. Minimum length matches the other password schemas.
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(256),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// One message for missing, foreign, and expired tokens so the response never
// reveals which it was.
function invalidTokenResponse() {
  return NextResponse.json(
    { error: 'Password reset token is invalid or has expired' },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { token, newPassword } = parsed.data;

    // Only the hash is stored, so look the token up by its hash.
    const tokenHash = hashResetToken(token);
    const record = await prisma.verificationtokens.findUnique({
      where: { token: tokenHash },
    });

    // Rows without the pwreset: prefix belong to NextAuth magic links, not us.
    const userId = record ? userIdFromResetIdentifier(record.identifier) : null;
    if (!record || !userId) {
      return invalidTokenResponse();
    }

    if (new Date(record.expires).getTime() <= Date.now()) {
      // Expired links are dead; remove the row so it can't linger.
      await prisma.verificationtokens.deleteMany({ where: { token: tokenHash } });
      return invalidTokenResponse();
    }

    // The token table has no FK to users, so a deleted account can leave a
    // dangling token behind.
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return invalidTokenResponse();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async tx => {
      await tx.users.update({
        where: { id: userId },
        data: { password: hashedPassword, updatedAt: new Date() },
      });
      // Consume the token (single-use) and drop any siblings for this user.
      await tx.verificationtokens.deleteMany({ where: { identifier: record.identifier } });
      // Sessions are stateless JWTs and can't be revoked here, but refresh
      // tokens can, so other devices can't silently mint new sessions.
      await tx.refresh_tokens.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, updatedAt: new Date() },
      });
    });

    logger.securityEvent('password_reset_completed', 'medium', { userId });

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Password reset error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

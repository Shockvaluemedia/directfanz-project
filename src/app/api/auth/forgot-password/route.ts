import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { sendPasswordResetEmail } from '@/lib/email';
import { createRateLimiter } from '@/lib/rate-limiting';
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  resetIdentifierFor,
} from '@/lib/password-reset';

// Defined inline (like change-password) because @/lib/validations is mocked in
// the auth integration tests.
const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email address is required').max(254),
});

// Identical for known and unknown addresses so emails can't be enumerated.
const GENERIC_RESPONSE = {
  success: true,
  message: "If an account with that email exists, we've sent a password reset link",
};

// Key strictly by client IP / hashed email. The shared limiter's default key
// trusts an `x-user-id` header first, which an unauthenticated caller could
// spoof to get a fresh bucket on every request.
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || '127.0.0.1';
}

// 5 requests per IP per 15 minutes, and 3 per email address per hour.
const ipRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: req => `rate_limit:pwreset:ip:${getClientIp(req)}`,
  },
  'pwreset-ip'
);

function emailRateLimiter(email: string) {
  const emailKey = createHash('sha256').update(email).digest('hex');
  return createRateLimiter(
    {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      keyGenerator: () => `rate_limit:pwreset:email:${emailKey}`,
    },
    'pwreset-email'
  );
}

export async function POST(request: NextRequest) {
  try {
    const ipLimited = await ipRateLimiter(request);
    if (ipLimited) return ipLimited;

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }
    // Credentials sign-in looks users up by exact email, so normalise the same
    // way registration does.
    const email = parsed.data.email.trim().toLowerCase();

    const emailLimited = await emailRateLimiter(email)(request);
    if (emailLimited) return emailLimited;

    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, password: true },
    });

    // Only accounts with a password can reset one (OAuth-only accounts have
    // none). The response is the same either way.
    if (user?.password) {
      const rawToken = generateResetToken();
      const identifier = resetIdentifierFor(user.id);

      // Invalidate any earlier links, then store only the hash of the new one.
      await prisma.verificationtokens.deleteMany({ where: { identifier } });
      await prisma.verificationtokens.create({
        data: {
          identifier,
          token: hashResetToken(rawToken),
          expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const emailSent = await sendPasswordResetEmail({
        email: user.email,
        resetToken: rawToken,
        userName: user.displayName,
      });

      logger.securityEvent('password_reset_requested', 'low', {
        userId: user.id,
        ip: getClientIp(request),
        emailSent,
      });
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    logger.error('Forgot password error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

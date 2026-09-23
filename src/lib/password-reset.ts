import { createHash, randomBytes } from 'crypto';

/**
 * Password-reset token helpers.
 *
 * Reset tokens are stored in NextAuth's `verificationtokens` table, so no
 * schema change is needed. Only a SHA-256 hash of the token is persisted; the
 * raw token exists solely in the emailed link. Rows are namespaced with a
 * `pwreset:` identifier prefix so they never collide with magic-link tokens,
 * which use the email address as their identifier.
 */

/** Reset links are valid for one hour and are single-use. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const RESET_IDENTIFIER_PREFIX = 'pwreset:';

export function resetIdentifierFor(userId: string): string {
  return `${RESET_IDENTIFIER_PREFIX}${userId}`;
}

/** Returns the user id encoded in a reset identifier, or null if it is not one. */
export function userIdFromResetIdentifier(identifier: string): string | null {
  return identifier.startsWith(RESET_IDENTIFIER_PREFIX)
    ? identifier.slice(RESET_IDENTIFIER_PREFIX.length)
    : null;
}

/** 256 bits of entropy, hex-encoded (64 characters). */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

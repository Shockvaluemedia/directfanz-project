import { createHash, randomBytes } from 'crypto';

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isPasswordResetToken(token: string): boolean {
  return PASSWORD_RESET_TOKEN_PATTERN.test(token);
}

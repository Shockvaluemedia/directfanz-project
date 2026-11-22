import crypto from 'crypto';

/**
 * Scheduled routes (under /api/cron) take `Authorization: Bearer <CRON_SECRET>`,
 * which is what a Vercel cron sends. 'off' when CRON_SECRET is unset, so the
 * routes stay switched off until a scheduler is set up.
 */
export function checkCronAuth(
  authorization: string | null,
  secret: string | undefined = process.env.CRON_SECRET
): 'ok' | 'off' | 'unauthorized' {
  if (!secret) return 'off';
  const given = Buffer.from(authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
    ? 'ok'
    : 'unauthorized';
}

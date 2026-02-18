import { NextRequest } from 'next/server';
import { createRateLimiter, RateLimits } from '@/lib/rate-limiting';

const rateLimiter = createRateLimiter(RateLimits.API, 'analytics');

export async function applyRateLimit(req: NextRequest) {
  const rateLimitResponse = await rateLimiter(req);

  if (rateLimitResponse) {
    // Rate limit exceeded
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: 100 };
}

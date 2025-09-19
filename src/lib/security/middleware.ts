// Temporary stub file for security middleware
// TODO: Implement proper rate limiting

import { NextRequest } from 'next/server';

export async function applyRateLimit(req: NextRequest) {
  // Placeholder rate limiting - implement actual rate limiting later
  return { success: true, remaining: 100 };
}

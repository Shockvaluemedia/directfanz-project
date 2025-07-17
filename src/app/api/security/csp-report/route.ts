import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

/**
 * Endpoint to receive CSP violation reports
 * This helps monitor potential security issues in real-time
 */
export const POST = withErrorHandling(async (context, request: NextRequest) => {
  try {
    const report = await request.json();
    
    logger.securityEvent('CSP violation reported', 'medium', {
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
      report,
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to process CSP report', {
      requestId: context.requestId,
    }, error as Error);
    
    return { success: false };
  }
});
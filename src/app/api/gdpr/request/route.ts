import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const gdprRequestSchema = z.object({
  type: z.enum(['DATA_EXPORT', 'DATA_DELETION', 'DATA_PORTABILITY', 'DATA_RECTIFICATION'], {
    required_error: 'Request type is required',
    invalid_type_error:
      'Invalid request type. Must be one of: DATA_EXPORT, DATA_DELETION, DATA_PORTABILITY, DATA_RECTIFICATION',
  }),
  reason: z.string().max(1000).optional(),
});

// POST /api/gdpr/request - Submit a new GDPR request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return apiError('UNAUTHORIZED', 'Unauthorized. You must be logged in to submit a GDPR request.');
    }

    const body = await request.json();
    const parsed = gdprRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'Validation failed');
    }

    const { type, reason } = parsed.data;

    const result = await GDPRComplianceService.submitRequest(
      session.user.id,
      type,
      session.user.email,
      reason
    );

    if (result.success) {
      return apiSuccess({ requestId: result.requestId,
        message:
          'Your GDPR request has been submitted. A verification email has been sent to your email address. Please verify to proceed.' });
    }

    return apiError('INTERNAL_ERROR', result.error || 'An error occurred');
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiError('BAD_REQUEST', 'Invalid JSON in request body');
    }
    logger.error('GDPR request submission error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'An internal error occurred while submitting your GDPR request');
  }
}

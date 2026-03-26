import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { type, reason } = body;

    const validTypes = ['DATA_EXPORT', 'DATA_DELETION', 'DATA_PORTABILITY', 'DATA_RECTIFICATION'];
    if (!type || !validTypes.includes(type)) {
      return apiError('BAD_REQUEST', 'Invalid request type. Must be one of: ' + validTypes.join(', '));
    }

    const result = await GDPRComplianceService.submitRequest(
      session.user.id,
      type,
      session.user.email,
      reason
    );

    if (result.success) {
      return apiSuccess({ requestId: result.requestId,
        message: 'A verification email has been sent. Please check your email to confirm this request.' });
    }

    return apiError('INTERNAL_ERROR', result.error || 'An error occurred');
  } catch (error) {
    logger.error('GDPR request error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to submit GDPR request');
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const requestId = url.searchParams.get('requestId');

    if (token && requestId) {
      const result = await GDPRComplianceService.verifyAndProcessRequest(requestId, token);

      if (result.success) {
        return apiSuccess({ message: 'Your request has been processed successfully.' });
      }

      return apiError('BAD_REQUEST', result.error || 'Bad request');
    }

    // Get user's GDPR request history
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const userData = await GDPRComplianceService.exportUserData(session.user.id);
    return apiSuccess({ data: userData });
  } catch (error) {
    logger.error('GDPR request error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to process request');
  }
}

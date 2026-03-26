import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, reason } = body;

    const validTypes = ['DATA_EXPORT', 'DATA_DELETION', 'DATA_PORTABILITY', 'DATA_RECTIFICATION'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request type. Must be one of: ' + validTypes.join(', ') },
        { status: 400 }
      );
    }

    const result = await GDPRComplianceService.submitRequest(
      session.user.id,
      type,
      session.user.email,
      reason
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        requestId: result.requestId,
        message: 'A verification email has been sent. Please check your email to confirm this request.',
      });
    }

    return NextResponse.json({ error: result.error }, { status: 500 });
  } catch (error) {
    logger.error('GDPR request error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to submit GDPR request' }, { status: 500 });
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
        return NextResponse.json({
          success: true,
          message: 'Your request has been processed successfully.',
        });
      }

      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Get user's GDPR request history
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = await GDPRComplianceService.exportUserData(session.user.id);
    return NextResponse.json({ data: userData });
  } catch (error) {
    logger.error('GDPR request error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

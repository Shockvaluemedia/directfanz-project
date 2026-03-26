import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const consentRecords = await prisma.consent_records.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        consentType: true,
        granted: true,
        timestamp: true,
        source: true,
        version: true,
      },
    });

    // Also get any GDPR requests
    const gdprRequests = await prisma.gdpr_requests.findMany({
      where: { userId },
      orderBy: { requestDate: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        requestDate: true,
        completionDate: true,
        reason: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        consentHistory: consentRecords,
        gdprRequests,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch consent history', {}, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const GRACE_PERIOD_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const userEmail = session.user.email || '';

    // Check for existing pending deletion request
    const existingRequest = await prisma.gdpr_requests.findFirst({
      where: {
        userId,
        type: 'DATA_DELETION',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json({
        success: true,
        message: 'A deletion request is already pending',
        data: {
          requestId: existingRequest.id,
          status: existingRequest.status,
          requestDate: existingRequest.requestDate,
          scheduledDeletion: new Date(
            existingRequest.requestDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      });
    }

    // Create a new GDPR deletion request with grace period
    const gdprRequest = await prisma.gdpr_requests.create({
      data: {
        userId,
        type: 'DATA_DELETION',
        status: 'PENDING',
        email: userEmail,
        reason: 'User-initiated account deletion',
      },
    });

    const scheduledDeletion = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    logger.info('GDPR deletion request created with grace period', {
      userId,
      requestId: gdprRequest.id,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      scheduledDeletion: scheduledDeletion.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Account deletion scheduled. You have ${GRACE_PERIOD_DAYS} days to cancel this request.`,
      data: {
        requestId: gdprRequest.id,
        scheduledDeletion: scheduledDeletion.toISOString(),
        gracePeriodDays: GRACE_PERIOD_DAYS,
      },
    });
  } catch (error) {
    console.error('GDPR deletion request failed:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// Cancel a pending deletion request
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const pendingRequest = await prisma.gdpr_requests.findFirst({
      where: {
        userId,
        type: 'DATA_DELETION',
        status: 'PENDING',
      },
    });

    if (!pendingRequest) {
      return NextResponse.json(
        { success: false, error: { message: 'No pending deletion request found' } },
        { status: 404 }
      );
    }

    await prisma.gdpr_requests.update({
      where: { id: pendingRequest.id },
      data: {
        status: 'REJECTED',
        reason: 'Cancelled by user',
        completionDate: new Date(),
      },
    });

    logger.info('GDPR deletion request cancelled by user', {
      userId,
      requestId: pendingRequest.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Deletion request has been cancelled',
    });
  } catch (error) {
    console.error('GDPR deletion cancel failed:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

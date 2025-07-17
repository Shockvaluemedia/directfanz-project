import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { retryFailedPayment } from '@/lib/payment-retry';
import { z } from 'zod';

const retrySchema = z.object({
  subscriptionId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subscriptionId } = retrySchema.parse(body);

    // Verify the subscription belongs to the user
    const subscription = await prisma.subscription.findUnique({
      where: { 
        id: subscriptionId,
        fanId: session.user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'PAST_DUE') {
      return NextResponse.json(
        { error: 'Subscription is not in past due status' },
        { status: 400 }
      );
    }

    // Attempt to retry the payment
    const success = await retryFailedPayment(subscriptionId);

    if (success) {
      return NextResponse.json({
        message: 'Payment retry successful',
        success: true,
      });
    } else {
      return NextResponse.json({
        message: 'Payment retry failed or not eligible for retry',
        success: false,
      });
    }
  } catch (error) {
    console.error('Payment retry error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retry payment' },
      { status: 500 }
    );
  }
}
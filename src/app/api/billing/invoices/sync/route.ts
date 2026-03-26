import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncInvoices } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

/**
 * Endpoint to sync invoices from Stripe to the local database
 * This is useful for ensuring our local database has the latest invoice data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return apiError('BAD_REQUEST', 'Missing subscriptionId parameter');
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: subscriptionId,
        OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    // Sync invoices from Stripe
    const result = await syncInvoices(subscriptionId);

    return apiSuccess({
      message: 'Invoices synced successfully',
      result,
    });
  } catch (error) {
    logger.error('Error syncing invoices', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to sync invoices');
  }
}

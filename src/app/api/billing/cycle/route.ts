import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getBillingCycleInfo,
  getUpcomingInvoices,
  getBillingCycleStats,
  processBillingRenewals,
  processFailedPaymentRetries,
  sendBillingReminders,
  processScheduledTierChanges,
  getArtistBillingSummary,
  syncArtistInvoices,
} from '@/lib/billing-cycle';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const subscriptionId = url.searchParams.get('subscriptionId');

    switch (action) {
      case 'info':
        if (!subscriptionId) {
          return apiError('BAD_REQUEST', 'Missing subscriptionId parameter');
        }

        // Verify subscription ownership
        const subscription = await prisma.subscriptions.findUnique({
          where: {
            id: subscriptionId,
            OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
          },
        });

        if (!subscription) {
          return apiError('NOT_FOUND', 'Subscription not found');
        }

        const billingInfo = await getBillingCycleInfo(subscriptionId);
        return apiSuccess({ billingInfo });

      case 'upcoming':
        // Only allow artists to see upcoming invoices for their subscriptions
        if (session.user.role !== 'ARTIST') {
          return apiError('FORBIDDEN', 'Only artists can view upcoming invoices');
        }

        const upcomingInvoices = await getUpcomingInvoices(session.user.id);

        return apiSuccess({ upcomingInvoices });

      case 'stats':
        // Only allow artists to see billing stats
        if (session.user.role !== 'ARTIST') {
          return apiError('FORBIDDEN', 'Only artists can view billing statistics');
        }

        const stats = await getBillingCycleStats();
        return apiSuccess({ stats });

      case 'summary':
        // Only allow artists to see billing summary
        if (session.user.role !== 'ARTIST') {
          return apiError('FORBIDDEN', 'Only artists can view billing summary');
        }

        const summary = await getArtistBillingSummary(session.user.id);
        return apiSuccess({ summary });

      default:
        return apiError('BAD_REQUEST', 'Invalid action parameter');
    }
  } catch (error) {
    logger.error('Billing cycle error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to process billing cycle request');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Only allow admin users to trigger billing processes
    // For now, we'll allow artists to trigger these for their own data
    if (session.user.role !== 'ARTIST') {
      return apiError('FORBIDDEN', 'Only artists can trigger billing processes');
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'process-renewals':
        const renewalEvents = await processBillingRenewals();
        return apiSuccess({
          message: 'Billing renewals processed',
          events: renewalEvents,
        });

      case 'process-retries':
        const retryEvents = await processFailedPaymentRetries();
        return apiSuccess({
          message: 'Payment retries processed',
          events: retryEvents,
        });

      case 'send-reminders':
        const reminderCount = await sendBillingReminders();
        return apiSuccess({
          message: 'Billing reminders sent',
          count: reminderCount,
        });

      case 'process-scheduled-changes':
        const tierChangeEvents = await processScheduledTierChanges();
        return apiSuccess({
          message: 'Scheduled tier changes processed',
          events: tierChangeEvents,
        });

      case 'sync-invoices':
        const syncResult = await syncArtistInvoices(session.user.id);
        return apiSuccess({
          message: 'Artist invoices synced successfully',
          result: syncResult,
        });

      default:
        return apiError('BAD_REQUEST', 'Invalid action');
    }
  } catch (error) {
    logger.error('Billing cycle process error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to process billing cycle action');
  }
}

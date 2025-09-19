import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const subscriptionId = url.searchParams.get('subscriptionId');

    switch (action) {
      case 'info':
        if (!subscriptionId) {
          return NextResponse.json({ error: 'Missing subscriptionId parameter' }, { status: 400 });
        }

        // Verify subscription ownership
        const subscription = await prisma.subscriptions.findUnique({
          where: {
            id: subscriptionId,
            OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
          },
        });

        if (!subscription) {
          return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const billingInfo = await getBillingCycleInfo(subscriptionId);
        return NextResponse.json({ billingInfo });

      case 'upcoming':
        // Only allow artists to see upcoming invoices for their subscriptions
        if (session.user.role !== 'ARTIST') {
          return NextResponse.json(
            { error: 'Only artists can view upcoming invoices' },
            { status: 403 }
          );
        }

        const upcomingInvoices = await getUpcomingInvoices(session.user.id);

        return NextResponse.json({ upcomingInvoices });

      case 'stats':
        // Only allow artists to see billing stats
        if (session.user.role !== 'ARTIST') {
          return NextResponse.json(
            { error: 'Only artists can view billing statistics' },
            { status: 403 }
          );
        }

        const stats = await getBillingCycleStats();
        return NextResponse.json({ stats });

      case 'summary':
        // Only allow artists to see billing summary
        if (session.user.role !== 'ARTIST') {
          return NextResponse.json(
            { error: 'Only artists can view billing summary' },
            { status: 403 }
          );
        }

        const summary = await getArtistBillingSummary(session.user.id);
        return NextResponse.json({ summary });

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing cycle error:', error);
    return NextResponse.json({ error: 'Failed to process billing cycle request' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to trigger billing processes
    // For now, we'll allow artists to trigger these for their own data
    if (session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: 'Only artists can trigger billing processes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'process-renewals':
        const renewalEvents = await processBillingRenewals();
        return NextResponse.json({
          message: 'Billing renewals processed',
          events: renewalEvents,
        });

      case 'process-retries':
        const retryEvents = await processFailedPaymentRetries();
        return NextResponse.json({
          message: 'Payment retries processed',
          events: retryEvents,
        });

      case 'send-reminders':
        const reminderCount = await sendBillingReminders();
        return NextResponse.json({
          message: 'Billing reminders sent',
          count: reminderCount,
        });

      case 'process-scheduled-changes':
        const tierChangeEvents = await processScheduledTierChanges();
        return NextResponse.json({
          message: 'Scheduled tier changes processed',
          events: tierChangeEvents,
        });

      case 'sync-invoices':
        const syncResult = await syncArtistInvoices(session.user.id);
        return NextResponse.json({
          message: 'Artist invoices synced successfully',
          result: syncResult,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing cycle process error:', error);
    return NextResponse.json({ error: 'Failed to process billing cycle action' }, { status: 500 });
  }
}

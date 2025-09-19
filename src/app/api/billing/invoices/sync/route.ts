import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncInvoices } from '@/lib/billing';

/**
 * Endpoint to sync invoices from Stripe to the local database
 * This is useful for ensuring our local database has the latest invoice data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId parameter' }, { status: 400 });
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: subscriptionId,
        OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Sync invoices from Stripe
    const result = await syncInvoices(subscriptionId);

    return NextResponse.json({
      message: 'Invoices synced successfully',
      result,
    });
  } catch (error) {
    console.error('Error syncing invoices:', error);
    return NextResponse.json({ error: 'Failed to sync invoices' }, { status: 500 });
  }
}

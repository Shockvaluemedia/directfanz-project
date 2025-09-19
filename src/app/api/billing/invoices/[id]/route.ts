import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getInvoiceById,
  updateInvoice,
  sendInvoiceNotification,
  processInvoicePayment,
} from '@/lib/invoice';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await getInvoiceById(params.id);

    // Verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: invoice.subscriptionId,
        OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error(`Error retrieving invoice ${params.id}:`, error);

    if (error instanceof Error && error.message === 'Invoice not found') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to retrieve invoice' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    // Get invoice and verify ownership
    const invoice = await getInvoiceById(params.id);

    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: invoice.subscriptionId,
        OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    switch (action) {
      case 'send-notification':
        await sendInvoiceNotification(params.id);
        return NextResponse.json({
          message: 'Invoice notification sent successfully',
        });

      case 'process-payment':
        // Only fans can process payments
        if (subscription.fanId !== session.user.id) {
          return NextResponse.json(
            { error: 'Only the subscriber can process payments' },
            { status: 403 }
          );
        }

        const result = await processInvoicePayment(params.id);
        return NextResponse.json({
          message: result.alreadyPaid
            ? 'Invoice was already paid'
            : 'Payment processed successfully',
          invoice: result.invoice,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error(`Error processing invoice action for ${params.id}:`, error);

    if (error instanceof Error && error.message === 'Invoice not found') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to process invoice action' }, { status: 500 });
  }
}

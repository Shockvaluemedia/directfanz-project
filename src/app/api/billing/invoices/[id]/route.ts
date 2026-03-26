import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getInvoiceById,
  updateInvoice,
  sendInvoiceNotification,
  processInvoicePayment,
} from '@/lib/invoice';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
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
      return apiError('NOT_FOUND', 'Invoice not found');
    }

    return apiSuccess({ invoice });
  } catch (error) {
    logger.error(`Error retrieving invoice ${params.id}`, {}, error as Error);

    if (error instanceof Error && error.message === 'Invoice not found') {
      return apiError('NOT_FOUND', 'Invoice not found');
    }

    return apiError('INTERNAL_ERROR', 'Failed to retrieve invoice');
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return apiError('BAD_REQUEST', 'Missing action parameter');
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
      return apiError('NOT_FOUND', 'Invoice not found');
    }

    switch (action) {
      case 'send-notification':
        await sendInvoiceNotification(params.id);
        return apiSuccess({
          message: 'Invoice notification sent successfully',
        });

      case 'process-payment':
        // Only fans can process payments
        if (subscription.fanId !== session.user.id) {
          return apiError('FORBIDDEN', 'Only the subscriber can process payments');
        }

        const result = await processInvoicePayment(params.id);
        return apiSuccess({
          message: result.alreadyPaid
            ? 'Invoice was already paid'
            : 'Payment processed successfully',
          invoice: result.invoice,
        });

      default:
        return apiError('BAD_REQUEST', 'Invalid action');
    }
  } catch (error) {
    logger.error(`Error processing invoice action for ${params.id}`, {}, error as Error);

    if (error instanceof Error && error.message === 'Invoice not found') {
      return apiError('NOT_FOUND', 'Invoice not found');
    }

    return apiError('INTERNAL_ERROR', 'Failed to process invoice action');
  }
}

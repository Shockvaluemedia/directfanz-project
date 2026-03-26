import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { generateInvoiceData } from '@/lib/billing';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const startingAfter = url.searchParams.get('startingAfter');

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

    // Get invoices from Stripe
    const stripeInvoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId,
      limit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    // Process invoices
    const invoices = [];
    for (const invoice of stripeInvoices.data) {
      try {
        const invoiceData = await generateInvoiceData(invoice.id);
        invoices.push(invoiceData);
      } catch (error) {
        logger.error(`Error generating invoice data for ${invoice.id}`, {}, error as Error);
        // Continue with other invoices
      }
    }

    return apiSuccess({
      invoices,
      hasMore: stripeInvoices.has_more,
    });
  } catch (error) {
    logger.error('Error retrieving invoices', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve invoices');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { stripeInvoiceId } = body;

    if (!stripeInvoiceId) {
      return apiError('BAD_REQUEST', 'Missing stripeInvoiceId parameter');
    }

    // Get invoice from Stripe
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);

    // Verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        stripeSubscriptionId: stripeInvoice.subscription as string,
        OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    // Generate invoice data
    const invoiceData = await generateInvoiceData(stripeInvoiceId);

    // Store invoice in database
    const prorationAmount = invoiceData.items.some(item => item.description.includes('Proration'))
      ? invoiceData.items
          .filter(item => item.description.includes('Proration'))
          .reduce((sum, item) => sum + item.amount, 0)
      : null;

    const invoice = await prisma.$queryRaw`
      INSERT INTO "invoices" (
        "id", "subscriptionId", "stripeInvoiceId", "amount", "status", 
        "dueDate", "paidAt", "periodStart", "periodEnd", "prorationAmount", 
        "items", "createdAt", "updatedAt"
      ) 
      VALUES (
        ${`inv_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 13)}`},
        ${subscription.id}, 
        ${stripeInvoiceId}, 
        ${invoiceData.amount}, 
        ${invoiceData.status.toUpperCase()}, 
        ${invoiceData.dueDate}, 
        ${invoiceData.paidAt || null}, 
        ${invoiceData.items[0]?.period.start || new Date()}, 
        ${invoiceData.items[0]?.period.end || new Date()}, 
        ${prorationAmount}, 
        ${JSON.stringify(invoiceData.items)},
        NOW(),
        NOW()
      )
      RETURNING "id"
    `;

    return apiSuccess({
      message: 'Invoice stored successfully',
      invoice,
    });
  } catch (error) {
    logger.error('Error storing invoice', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to store invoice');
  }
}

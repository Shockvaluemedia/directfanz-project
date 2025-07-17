import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './prisma';
import { stripe } from './stripe';
import { sendEmail } from './notifications';
import { generateInvoiceData, InvoiceData } from './billing';
import { logger } from './logger';

export interface InvoiceCreateParams {
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  dueDate: Date;
  paidAt?: Date | null;
  periodStart: Date;
  periodEnd: Date;
  prorationAmount?: number | null;
  items: any;
}

export interface InvoiceUpdateParams {
  amount?: number;
  status?: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  dueDate?: Date;
  paidAt?: Date | null;
  items?: any;
}

export interface InvoiceFilterParams {
  subscriptionId?: string;
  artistId?: string;
  fanId?: string;
  status?: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Create a new invoice in the database
 */
export async function createInvoice(params: InvoiceCreateParams): Promise<any> {
  try {
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: params.subscriptionId,
        stripeInvoiceId: params.stripeInvoiceId,
        amount: new Decimal(params.amount),
        status: params.status,
        dueDate: params.dueDate,
        paidAt: params.paidAt,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        prorationAmount: params.prorationAmount ? new Decimal(params.prorationAmount) : null,
        items: params.items,
      },
    });

    return invoice;
  } catch (error) {
    logger.error('Error creating invoice:', error);
    throw new Error('Failed to create invoice');
  }
}

/**
 * Update an existing invoice in the database
 */
export async function updateInvoice(id: string, params: InvoiceUpdateParams): Promise<any> {
  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(params.amount !== undefined && { amount: new Decimal(params.amount) }),
        ...(params.status && { status: params.status }),
        ...(params.dueDate && { dueDate: params.dueDate }),
        ...(params.paidAt !== undefined && { paidAt: params.paidAt }),
        ...(params.items && { items: params.items }),
        updatedAt: new Date(),
      },
    });

    return invoice;
  } catch (error) {
    logger.error(`Error updating invoice ${id}:`, error);
    throw new Error('Failed to update invoice');
  }
}

/**
 * Get invoices with filtering options
 */
export async function getInvoices(filters: InvoiceFilterParams): Promise<any[]> {
  try {
    const where: any = {};
    
    if (filters.subscriptionId) {
      where.subscriptionId = filters.subscriptionId;
    }
    
    if (filters.artistId) {
      where.subscription = {
        artistId: filters.artistId,
      };
    }
    
    if (filters.fanId) {
      where.subscription = {
        ...(where.subscription || {}),
        fanId: filters.fanId,
      };
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.startDate || filters.endDate) {
      where.dueDate = {};
      
      if (filters.startDate) {
        where.dueDate.gte = filters.startDate;
      }
      
      if (filters.endDate) {
        where.dueDate.lte = filters.endDate;
      }
    }
    
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: {
        dueDate: 'desc',
      },
      skip: filters.offset || 0,
      take: filters.limit || 10,
      include: {
        subscription: {
          include: {
            fan: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            tier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    return invoices;
  } catch (error) {
    logger.error('Error getting invoices:', error);
    throw new Error('Failed to get invoices');
  }
}

/**
 * Get a single invoice by ID
 */
export async function getInvoiceById(id: string): Promise<any> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            fan: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            tier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    return invoice;
  } catch (error) {
    logger.error(`Error getting invoice ${id}:`, error);
    throw new Error('Failed to get invoice');
  }
}

/**
 * Generate and store an invoice from Stripe data
 */
export async function generateAndStoreInvoice(stripeInvoiceId: string): Promise<any> {
  try {
    // Get invoice data from Stripe
    const invoiceData = await generateInvoiceData(stripeInvoiceId);
    
    // Get subscription from database
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: invoiceData.subscriptionId },
    });
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    // Calculate proration amount if any
    const prorationAmount = invoiceData.items.some(item => item.description.includes('Proration'))
      ? invoiceData.items
          .filter(item => item.description.includes('Proration'))
          .reduce((sum, item) => sum + item.amount, 0)
      : null;
    
    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId },
    });
    
    if (existingInvoice) {
      // Update existing invoice
      return await updateInvoice(existingInvoice.id, {
        amount: invoiceData.amount,
        status: invoiceData.status.toUpperCase() as any,
        dueDate: invoiceData.dueDate,
        paidAt: invoiceData.paidAt,
        items: invoiceData.items,
      });
    } else {
      // Create new invoice
      return await createInvoice({
        subscriptionId: subscription.id,
        stripeInvoiceId,
        amount: invoiceData.amount,
        status: invoiceData.status.toUpperCase() as any,
        dueDate: invoiceData.dueDate,
        paidAt: invoiceData.paidAt,
        periodStart: invoiceData.items[0]?.period.start || new Date(),
        periodEnd: invoiceData.items[0]?.period.end || new Date(),
        prorationAmount,
        items: invoiceData.items,
      });
    }
  } catch (error) {
    logger.error(`Error generating and storing invoice ${stripeInvoiceId}:`, error);
    throw new Error('Failed to generate and store invoice');
  }
}

/**
 * Send invoice notification to customer
 */
export async function sendInvoiceNotification(invoiceId: string): Promise<void> {
  try {
    const invoice = await getInvoiceById(invoiceId);
    
    if (!invoice.subscription.fan.email) {
      logger.warn(`Cannot send invoice notification: no email for fan ${invoice.subscription.fan.id}`);
      return;
    }
    
    const prefs = invoice.subscription.fan.notificationPreferences as any;
    if (prefs?.billing === false) {
      logger.info(`Skipping invoice notification: billing notifications disabled for fan ${invoice.subscription.fan.id}`);
      return;
    }
    
    const formattedAmount = parseFloat(invoice.amount.toString()).toFixed(2);
    const formattedDate = invoice.dueDate.toLocaleDateString();
    const invoiceStatus = invoice.status.toLowerCase();
    const tierName = invoice.subscription.tier.name;
    
    await sendEmail({
      to: invoice.subscription.fan.email,
      subject: `Invoice ${invoiceStatus === 'paid' ? 'Receipt' : 'Due'} - ${tierName} Subscription`,
      html: `
        <h1>Invoice ${invoiceStatus === 'paid' ? 'Receipt' : ''}</h1>
        <p>Your ${tierName} subscription invoice is ${invoiceStatus === 'paid' ? 'paid' : 'due'}.</p>
        <p>Amount: $${formattedAmount}</p>
        <p>Due date: ${formattedDate}</p>
        ${invoice.prorationAmount ? `<p>Includes proration amount: $${parseFloat(invoice.prorationAmount.toString()).toFixed(2)}</p>` : ''}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
      `,
      text: `Invoice ${invoiceStatus === 'paid' ? 'Receipt' : ''}\n\nYour ${tierName} subscription invoice is ${invoiceStatus === 'paid' ? 'paid' : 'due'}.\n\nAmount: $${formattedAmount}\nDue date: ${formattedDate}\n${invoice.prorationAmount ? `Includes proration amount: $${parseFloat(invoice.prorationAmount.toString()).toFixed(2)}\n` : ''}Manage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`
    });
  } catch (error) {
    logger.error(`Error sending invoice notification for ${invoiceId}:`, error);
    throw new Error('Failed to send invoice notification');
  }
}

/**
 * Process a payment for an invoice
 */
export async function processInvoicePayment(invoiceId: string): Promise<any> {
  try {
    const invoice = await getInvoiceById(invoiceId);
    
    if (invoice.status === 'PAID') {
      return { success: true, alreadyPaid: true, invoice };
    }
    
    // Pay the invoice in Stripe
    const stripeInvoice = await stripe.invoices.pay(invoice.stripeInvoiceId);
    
    // Update local invoice
    const updatedInvoice = await updateInvoice(invoiceId, {
      status: 'PAID',
      paidAt: new Date(),
    });
    
    // Send receipt notification
    await sendInvoiceNotification(invoiceId);
    
    return { success: true, invoice: updatedInvoice };
  } catch (error) {
    logger.error(`Error processing payment for invoice ${invoiceId}:`, error);
    throw new Error('Failed to process invoice payment');
  }
}

/**
 * Get upcoming invoice for a subscription
 */
export async function getUpcomingInvoice(subscriptionId: string): Promise<InvoiceData> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      subscription: subscription.stripeSubscriptionId,
    });
    
    const invoiceData: InvoiceData = {
      id: 'upcoming',
      subscriptionId: subscription.stripeSubscriptionId,
      amount: (upcomingInvoice.amount_due || 0) / 100,
      status: upcomingInvoice.status || 'draft',
      dueDate: new Date(upcomingInvoice.due_date ? upcomingInvoice.due_date * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: upcomingInvoice.lines.data.map(line => ({
        description: line.description || 'Subscription',
        amount: (line.amount || 0) / 100,
        quantity: line.quantity || 1,
        period: {
          start: new Date((line.period?.start || 0) * 1000),
          end: new Date((line.period?.end || 0) * 1000)
        }
      }))
    };
    
    return invoiceData;
  } catch (error) {
    logger.error(`Error getting upcoming invoice for subscription ${subscriptionId}:`, error);
    throw new Error('Failed to get upcoming invoice');
  }
}
import { Decimal } from '@prisma/client/runtime/library';
import { stripe } from './stripe';
import { prisma } from './prisma';
import { sendEmail } from './notifications';
import { generateSecureId } from './crypto-utils';
import type Stripe from 'stripe';
import { randomUUID } from 'crypto';

export interface ProrationCalculation {
  currentAmount: number;
  newAmount: number;
  prorationAmount: number;
  nextInvoiceAmount: number;
  daysRemaining: number;
  totalDaysInPeriod: number;
  effectiveDate?: Date;
}

export interface BillingCycleInfo {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  daysInCurrentPeriod: number;
  daysRemaining: number;
}

export interface InvoiceData {
  id: string;
  subscriptionId: string;
  amount: number;
  status: string;
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface TierChangeOptions {
  effectiveDate?: 'now' | 'next_billing_cycle';
  prorationBehavior?: 'create_prorations' | 'none';
  sendNotification?: boolean;
}

/**
 * Calculate proration for tier changes
 */
export async function calculateTierChangeProration(
  subscriptionId: string,
  newTierId: string,
  newAmount: number,
  options?: { effectiveDate?: Date }
): Promise<ProrationCalculation> {
  try {
    // Get current subscription details
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      include: { tiers: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get Stripe subscription for accurate billing period info
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const currentAmount = parseFloat(subscription.amount.toString());
    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

    // Calculate time-based proration
    const effectiveDate = options?.effectiveDate || new Date();
    const totalDaysInPeriod = Math.max(
      1,
      Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((currentPeriodEnd.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Prevent division by zero
    if (totalDaysInPeriod <= 0) {
      throw new Error('Invalid billing period - period end must be after period start');
    }

    // Calculate proration amounts
    const dailyCurrentRate = currentAmount / totalDaysInPeriod;
    const dailyNewRate = newAmount / totalDaysInPeriod;

    const unusedCurrentAmount = dailyCurrentRate * daysRemaining;
    const newAmountForRemainingPeriod = dailyNewRate * daysRemaining;

    const prorationAmount = Number((newAmountForRemainingPeriod - unusedCurrentAmount).toFixed(2));
    const nextInvoiceAmount = newAmount; // Full amount for next period

    return {
      currentAmount,
      newAmount,
      prorationAmount,
      nextInvoiceAmount,
      daysRemaining,
      totalDaysInPeriod,
      effectiveDate,
    };
  } catch (error) {
    console.error('Error calculating proration:', error);
    throw new Error('Failed to calculate proration');
  }
}

/**
 * Get billing cycle information for a subscription
 */
export async function getBillingCycleInfo(subscriptionId: string): Promise<BillingCycleInfo> {
  try {
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    const nextBillingDate = currentPeriodEnd;

    const now = new Date();
    const daysInCurrentPeriod = Math.max(
      1,
      Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Validate billing period
    if (daysInCurrentPeriod <= 0) {
      throw new Error('Invalid billing period - current period end must be after start');
    }

    return {
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate,
      daysInCurrentPeriod,
      daysRemaining,
    };
  } catch (error) {
    console.error('Error getting billing cycle info:', error);
    throw new Error('Failed to get billing cycle information');
  }
}

/**
 * Handle subscription tier change with proration
 */
export async function changeTier(
  subscriptionId: string,
  newTierId: string,
  newAmount: number,
  options: TierChangeOptions = {}
): Promise<{
  success: boolean;
  prorationAmount: number;
  invoiceId?: string;
  effectiveDate: Date;
}> {
  try {
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new Error('Can only change tier for active subscriptions');
    }

    // Get new tier details
    const newTier = await prisma.tiers.findUnique({
      where: { id: newTierId },
      include: {
        artist: true,
      },
    });

    if (!newTier) {
      throw new Error('New tier not found');
    }

    // Validate minimum amount
    if (newAmount < parseFloat(newTier.minimumPrice.toString())) {
      throw new Error('Amount is below minimum price for the new tier');
    }

    // Determine if this is an upgrade or downgrade
    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmount > currentAmount;

    // Set effective date based on options
    const effectiveDate =
      options.effectiveDate === 'next_billing_cycle'
        ? new Date(subscription.currentPeriodEnd)
        : new Date();

    // Calculate proration
    const proration = await calculateTierChangeProration(subscriptionId, newTierId, newAmount, {
      effectiveDate,
    });

    // Update Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const updateParams: Stripe.SubscriptionUpdateParams = {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price_data: {
            currency: 'usd',
            product: stripeSubscription.items.data[0].price.product as string,
            unit_amount: Math.round(newAmount * 100),
            recurring: {
              interval: 'month',
            },
          },
        },
      ],
      proration_behavior: options.prorationBehavior || 'create_prorations',
    };

    // If effective date is next billing cycle, set proration_date to current_period_end
    if (options.effectiveDate === 'next_billing_cycle') {
      updateParams.proration_date = Math.floor(subscription.currentPeriodEnd.getTime() / 1000);
      updateParams.billing_cycle_anchor = 'unchanged';
    }

    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      updateParams
    );

    // Get the latest invoice for this subscription
    const latestInvoice = updatedSubscription.latest_invoice as string;
    let invoiceId: string | undefined;

    if (latestInvoice) {
      const invoiceData = await generateInvoiceData(latestInvoice);

      // Store invoice in database
      const invoice = (await prisma.$queryRaw`
        INSERT INTO "invoices" (
          "id", "subscriptionId", "stripeInvoiceId", "amount", "status", 
          "dueDate", "paidAt", "periodStart", "periodEnd", "prorationAmount", 
          "items", "createdAt", "updatedAt"
        ) 
        VALUES (
          ${generateSecureId('inv', 15)},
          ${subscription.id}, 
          ${latestInvoice}, 
          ${invoiceData.amount}, 
          ${invoiceData.status.toUpperCase()}, 
          ${invoiceData.dueDate}, 
          ${invoiceData.paidAt || null}, 
          ${invoiceData.items[0]?.period.start || new Date()}, 
          ${invoiceData.items[0]?.period.end || new Date()}, 
          ${proration.prorationAmount !== 0 ? proration.prorationAmount : null}, 
          ${JSON.stringify(invoiceData.items)},
          NOW(),
          NOW()
        )
        RETURNING "id"
      `) as any[];

      invoiceId = invoice[0]?.id;
    }

    // Update local database
    await prisma.$transaction(async tx => {
      // Update subscription
      await tx.subscriptions.update({
        where: { id: subscriptionId },
        data: {
          tierId: newTierId,
          amount: new Decimal(newAmount),
        },
      });

      // Update tier subscriber counts
      await tx.tiers.update({
        where: { id: subscription.tierId },
        data: { subscriberCount: { decrement: 1 } },
      });

      await tx.tiers.update({
        where: { id: newTierId },
        data: { subscriberCount: { increment: 1 } },
      });
    });

    // Send notification if requested
    if (options.sendNotification && subscription.fan?.email) {
      await sendEmail({
        to: subscription.fan.email!,
        subject: `Subscription ${isUpgrade ? 'Upgraded' : 'Changed'} - ${newTier.artist?.displayName}`,
        html: `
          <h1>Subscription ${isUpgrade ? 'Upgraded' : 'Changed'}</h1>
          <p>Your subscription to ${subscription.tier.artist?.displayName}'s content has been changed from ${subscription.tier.name} tier to ${newTier.name} tier.</p>
          <p>New amount: $${newAmount.toFixed(2)}</p>
          ${proration.prorationAmount !== 0 ? `<p>Proration amount: $${proration.prorationAmount.toFixed(2)}</p>` : ''}
          <p>Next billing date: ${subscription.currentPeriodEnd.toLocaleDateString()}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
        `,
        text: `Subscription ${isUpgrade ? 'Upgraded' : 'Changed'}\n\nYour subscription to ${subscription.tier.artist?.displayName}'s content has been changed from ${subscription.tier.name} tier to ${newTier.name} tier.\n\nNew amount: $${newAmount.toFixed(2)}\n${proration.prorationAmount !== 0 ? `Proration amount: $${proration.prorationAmount.toFixed(2)}\n` : ''}Next billing date: ${subscription.currentPeriodEnd.toLocaleDateString()}\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`,
      });
    }

    return {
      success: true,
      prorationAmount: proration.prorationAmount,
      invoiceId,
      effectiveDate,
    };
  } catch (error) {
    console.error('Error changing subscription tier:', error);
    throw error;
  }
}

/**
 * Handle subscription upgrade with proration
 */
export async function upgradeSubscription(
  subscriptionId: string,
  newTierId: string,
  newAmount: number
): Promise<{ success: boolean; prorationAmount: number }> {
  const result = await changeTier(subscriptionId, newTierId, newAmount, {
    effectiveDate: 'now',
    prorationBehavior: 'create_prorations',
    sendNotification: true,
  });

  return {
    success: result.success,
    prorationAmount: result.prorationAmount,
  };
}

/**
 * Handle subscription downgrade with proration
 */
export async function downgradeSubscription(
  subscriptionId: string,
  newTierId: string,
  newAmount: number
): Promise<{ success: boolean; prorationAmount: number }> {
  const result = await changeTier(subscriptionId, newTierId, newAmount, {
    effectiveDate: 'now',
    prorationBehavior: 'create_prorations',
    sendNotification: true,
  });

  return {
    success: result.success,
    prorationAmount: result.prorationAmount,
  };
}

/**
 * Generate invoice data from Stripe invoice
 */
export async function generateInvoiceData(stripeInvoiceId: string): Promise<InvoiceData> {
  try {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['lines.data.price.product'],
    });

    const items: InvoiceItem[] = invoice.lines.data.map(line => ({
      description: line.description || 'Subscription',
      amount: (line.amount || 0) / 100,
      quantity: line.quantity || 1,
      period: {
        start: new Date((line.period?.start || 0) * 1000),
        end: new Date((line.period?.end || 0) * 1000),
      },
    }));

    const result: InvoiceData = {
      id: invoice.id,
      subscriptionId: invoice.subscription as string,
      amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
      status: invoice.status || 'draft',
      dueDate: new Date((invoice.due_date || invoice.created) * 1000),
      items,
      paidAt:
        invoice.status_transitions && typeof invoice.status_transitions.paid_at === 'number'
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : undefined,
    };

    return result;
  } catch (error) {
    console.error('Error generating invoice data:', error);
    throw new Error('Failed to generate invoice data');
  }
}

/**
 * Schedule a subscription tier change for the next billing cycle
 */
export async function scheduleTierChange(
  subscriptionId: string,
  newTierId: string,
  newAmount: number
): Promise<{
  success: boolean;
  scheduledDate: Date;
  invoiceId?: string;
}> {
  try {
    // Get current subscription details
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new Error('Can only schedule tier changes for active subscriptions');
    }

    // Get new tier details
    const newTier = await prisma.tiers.findUnique({
      where: { id: newTierId },
      include: {
        artist: true,
      },
    });

    if (!newTier) {
      throw new Error('New tier not found');
    }

    // Validate minimum amount
    if (newAmount < parseFloat(newTier.minimumPrice.toString())) {
      throw new Error('Amount is below minimum price for the new tier');
    }

    // Determine if this is an upgrade or downgrade
    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmount > currentAmount;

    // Set effective date to next billing cycle
    const effectiveDate = new Date(subscription.currentPeriodEnd);

    // Update Stripe subscription with scheduled change
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Schedule the update for the next billing cycle
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        proration_behavior: 'none',
        billing_cycle_anchor: 'unchanged',
        metadata: {
          scheduled_tier_change: 'true',
          scheduled_tier_id: newTierId,
          scheduled_amount: newAmount.toString(),
          scheduled_date: effectiveDate.toISOString(),
        },
      }
    );

    // Create an invoice to track the scheduled change
    const invoiceData = {
      subscriptionId: subscription.id,
      stripeInvoiceId: `scheduled_${subscription.stripeSubscriptionId}_${Date.now()}`,
      amount: new Decimal(0), // No immediate charge
      status: 'DRAFT' as any,
      dueDate: effectiveDate,
      paidAt: null,
      periodStart: new Date(),
      periodEnd: effectiveDate,
      prorationAmount: null,
      items: {
        scheduledTierChange: {
          fromTierId: subscription.tierId,
          toTierId: newTierId,
          fromAmount: currentAmount,
          toAmount: newAmount,
          scheduledDate: effectiveDate,
          isUpgrade,
          processed: false,
        },
      },
    };

    // Store scheduled change in database
    const invoice = (await prisma.$queryRaw`
      INSERT INTO "invoices" (
        "id", "subscriptionId", "stripeInvoiceId", "amount", "status", 
        "dueDate", "paidAt", "periodStart", "periodEnd", "prorationAmount", 
        "items", "createdAt", "updatedAt"
      ) 
      VALUES (
        ${`inv_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 13)}`},
        ${subscription.id}, 
        ${invoiceData.stripeInvoiceId}, 
        ${invoiceData.amount}, 
        ${invoiceData.status}, 
        ${invoiceData.dueDate}, 
        ${invoiceData.paidAt}, 
        ${invoiceData.periodStart}, 
        ${invoiceData.periodEnd}, 
        ${invoiceData.prorationAmount}, 
        ${JSON.stringify(invoiceData.items)},
        NOW(),
        NOW()
      )
      RETURNING "id"
    `) as any[];

    // Send notification if requested
    if (subscription.fan?.email) {
      await sendEmail({
        to: subscription.users.email,
        subject: `Subscription Change Scheduled - ${newTier.artist?.displayName}`,
        html: `
          <h1>Subscription Change Scheduled</h1>
          <p>Your subscription to ${subscription.tiers.artist?.displayName}'s content will be changed from ${subscription.tiers.name} tier to ${newTier.name} tier on your next billing date.</p>
          <p>Current tier: ${subscription.tiers.name}</p>
          <p>New tier: ${newTier.name}</p>
          <p>Current amount: ${currentAmount.toFixed(2)}</p>
          <p>New amount: ${newAmount.toFixed(2)}</p>
          <p>Effective date: ${effectiveDate.toLocaleDateString()}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
        `,
        text: `Subscription Change Scheduled\n\nYour subscription to ${subscription.tiers.artist?.displayName}'s content will be changed from ${subscription.tiers.name} tier to ${newTier.name} tier on your next billing date.\n\nCurrent tier: ${subscription.tiers.name}\nNew tier: ${newTier.name}\nCurrent amount: ${currentAmount.toFixed(2)}\nNew amount: ${newAmount.toFixed(2)}\nEffective date: ${effectiveDate.toLocaleDateString()}\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`,
      });
    }

    return {
      success: true,
      scheduledDate: effectiveDate,
      invoiceId: invoice[0]?.id,
    };
  } catch (error) {
    console.error('Error scheduling tier change:', error);
    throw error;
  }
}

/**
 * Get all invoices for a subscription
 */
export async function getSubscriptionInvoices(
  subscriptionId: string,
  options: { limit?: number; startingAfter?: string } = {}
): Promise<{
  invoices: InvoiceData[];
  hasMore: boolean;
}> {
  try {
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const limit = options.limit || 10;

    const stripeInvoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId,
      limit,
      ...(options.startingAfter ? { starting_after: options.startingAfter } : {}),
    });

    const invoices: InvoiceData[] = [];

    for (const invoice of stripeInvoices.data) {
      try {
        const invoiceData = await generateInvoiceData(invoice.id);
        invoices.push(invoiceData);
      } catch (error) {
        console.error(`Error generating invoice data for ${invoice.id}:`, error);
        // Continue with other invoices
      }
    }

    return {
      invoices,
      hasMore: stripeInvoices.has_more || false,
    };
  } catch (error) {
    console.error('Error getting subscription invoices:', error);
    throw new Error('Failed to get subscription invoices');
  }
}

/**
 * Sync invoices from Stripe to local database
 */
export async function syncInvoices(subscriptionId: string): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  try {
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    let created = 0;
    let updated = 0;
    let hasMore = true;
    let startingAfter: string | undefined;
    const limit = 100;

    while (hasMore) {
      const stripeInvoices = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        limit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const invoice of stripeInvoices.data) {
        try {
          const invoiceData = await generateInvoiceData(invoice.id);

          // Check if invoice already exists
          const existingInvoice = (await prisma.$queryRaw`
            SELECT * FROM "invoices" WHERE "stripeInvoiceId" = ${invoice.id}
          `) as any[];

          if (existingInvoice && existingInvoice.length > 0) {
            // Update existing invoice
            await prisma.$executeRaw`
              UPDATE "invoices"
              SET "amount" = ${invoiceData.amount},
                  "status" = ${invoiceData.status.toUpperCase()},
                  "dueDate" = ${invoiceData.dueDate},
                  "paidAt" = ${invoiceData.paidAt || null},
                  "items" = ${JSON.stringify(invoiceData.items)},
                  "updatedAt" = NOW()
              WHERE "id" = ${existingInvoice[0].id}
            `;
            updated++;
          } else {
            // Create new invoice
            const prorationAmount = invoiceData.items.some(item =>
              item.description.includes('Proration')
            )
              ? invoiceData.items
                  .filter(item => item.description.includes('Proration'))
                  .reduce((sum, item) => sum + item.amount, 0)
              : null;

            await prisma.$executeRaw`
              INSERT INTO "invoices" (
                "id", "subscriptionId", "stripeInvoiceId", "amount", "status", 
                "dueDate", "paidAt", "periodStart", "periodEnd", "prorationAmount", 
                "items", "createdAt", "updatedAt"
              ) 
              VALUES (
                ${`inv_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 13)}`},
                ${subscription.id}, 
                ${invoice.id}, 
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
            `;
            created++;
          }
        } catch (error) {
          console.error(`Error processing invoice ${invoice.id}:`, error);
          // Continue with other invoices
        }
      }

      hasMore = stripeInvoices.has_more || false;
      if (hasMore && stripeInvoices.data.length > 0) {
        startingAfter = stripeInvoices.data[stripeInvoices.data.length - 1].id;
      }
    }

    return {
      created,
      updated,
      total: created + updated,
    };
  } catch (error) {
    console.error('Error syncing invoices:', error);
    throw new Error('Failed to sync invoices');
  }
}

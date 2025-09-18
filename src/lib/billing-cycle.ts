import { prisma } from './prisma';
import { stripe } from './stripe';
import { sendEmail } from './notifications';
import { generateInvoiceData } from './billing';
import { logger } from './logger';
import type Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

export interface BillingCycleEvent {
  type: 'renewal' | 'failure' | 'retry' | 'cancellation';
  subscriptionId: string;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UpcomingInvoice {
  subscriptionId: string;
  amount: number;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  prorationAmount?: number;
}

export interface BillingCycleInfo {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  daysInCurrentPeriod: number;
  daysRemaining: number;
}

/**
 * Get billing cycle information for a subscription
 */
export async function getBillingCycleInfo(subscriptionId: string): Promise<BillingCycleInfo> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
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
    const daysInCurrentPeriod = Math.ceil(
      (currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = Math.max(0, Math.ceil(
      (currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    return {
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate,
      daysInCurrentPeriod,
      daysRemaining
    };
  } catch (error) {
    console.error('Error getting billing cycle info:', error);
    throw new Error('Failed to get billing cycle information');
  }
}

/**
 * Get upcoming invoices for all active subscriptions
 */
export async function getUpcomingInvoices(artistId?: string): Promise<UpcomingInvoice[]> {
  try {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { 
        status: 'ACTIVE',
        ...(artistId ? { artistId } : {})
      },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true
          }
        }
      }
    });

    const upcomingInvoices: UpcomingInvoice[] = [];

    for (const subscription of activeSubscriptions) {
      try {
        const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          subscription: subscription.stripeSubscriptionId,
        });

        upcomingInvoices.push({
          subscriptionId: subscription.id,
          amount: upcomingInvoice.amount_due / 100,
          dueDate: new Date(upcomingInvoice.due_date! * 1000),
          periodStart: new Date(upcomingInvoice.period_start * 1000),
          periodEnd: new Date(upcomingInvoice.period_end * 1000),
          prorationAmount: upcomingInvoice.lines.data
            .filter(line => line.proration)
            .reduce((sum, line) => sum + (line.amount / 100), 0) || undefined
        });
      } catch (error) {
        console.error(`Error getting upcoming invoice for subscription ${subscription.id}:`, error);
        // Continue with other subscriptions
      }
    }

    return upcomingInvoices;
  } catch (error) {
    console.error('Error getting upcoming invoices:', error);
    throw new Error('Failed to get upcoming invoices');
  }
}

/**
 * Process billing cycle renewals
 */
export async function processBillingRenewals(): Promise<BillingCycleEvent[]> {
  try {
    const events: BillingCycleEvent[] = [];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get subscriptions that are due for renewal in the next 24 hours
    const subscriptionsToRenew = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: tomorrow
        }
      },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true
          }
        }
      }
    });

    for (const subscription of subscriptionsToRenew) {
      try {
        // Get the latest Stripe subscription data
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        // Update local subscription with latest period info
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            status: stripeSubscription.status.toUpperCase() as any
          }
        });

        // Send renewal notification to fan
        if (subscription.fan.email) {
          const prefs = subscription.fan.notificationPreferences as any;
          if (!prefs || prefs?.billing !== false) {
            await sendEmail({
              to: subscription.fan.email,
              subject: `Subscription Renewed - ${subscription.tier.artist?.displayName}`,
              html: `
                <h1>Subscription Renewed</h1>
                <p>Your subscription to ${subscription.tier.artist?.displayName}'s ${subscription.tier.name} tier has been renewed.</p>
                <p>Amount: $${subscription.amount}</p>
                <p>Next billing date: ${new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
              `,
              text: `Subscription Renewed\n\nYour subscription to ${subscription.tier.artist?.displayName}'s ${subscription.tier.name} tier has been renewed.\n\nAmount: $${subscription.amount}\nNext billing date: ${new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`
            });
          }
        }

        events.push({
          type: 'renewal',
          subscriptionId: subscription.id,
          amount: parseFloat(subscription.amount.toString()),
          timestamp: new Date(),
          metadata: {
            periodStart: stripeSubscription.current_period_start,
            periodEnd: stripeSubscription.current_period_end
          }
        });
      } catch (error) {
        console.error(`Error processing renewal for subscription ${subscription.id}:`, error);
      }
    }

    return events;
  } catch (error) {
    console.error('Error processing billing renewals:', error);
    throw new Error('Failed to process billing renewals');
  }
}

/**
 * Handle failed payment retries
 */
export async function processFailedPaymentRetries(): Promise<BillingCycleEvent[]> {
  try {
    const events: BillingCycleEvent[] = [];
    const now = new Date();

    // Get payment failures that are due for retry
    const failuresToRetry = await prisma.$queryRaw`
      SELECT pf.*, s.id as "subscriptionId", s."stripeSubscriptionId", s."artistId",
             f.email as "fanEmail", t.name as "tierName", 
             a."displayName" as "artistDisplayName"
      FROM "payment_failures" pf
      JOIN "subscriptions" s ON pf."subscriptionId" = s.id
      JOIN "users" f ON s."fanId" = f.id
      JOIN "tiers" t ON s."tierId" = t.id
      JOIN "users" a ON t."artistId" = a.id
      WHERE pf."isResolved" = false
      AND pf."nextRetryAt" <= ${now}
    ` as any[];

    for (const failure of failuresToRetry) {
      try {
        // Get the latest invoice from Stripe
        const invoice = await stripe.invoices.retrieve(failure.stripeInvoiceId);

        if (invoice.status === 'paid') {
          // Payment was successful, mark as resolved
          await prisma.$executeRaw`
            UPDATE "payment_failures"
            SET "isResolved" = true,
                "updatedAt" = ${new Date()}
            WHERE "id" = ${failure.id}
          `;

          // Update subscription status
          await prisma.subscription.update({
            where: { id: failure.subscriptionId },
            data: { status: 'ACTIVE' }
          });

          events.push({
            type: 'retry',
            subscriptionId: failure.subscriptionId,
            amount: parseFloat(failure.amount.toString()),
            timestamp: new Date(),
            metadata: {
              resolved: true,
              attemptCount: failure.attemptCount
            }
          });
        } else if (invoice.attempt_count && invoice.attempt_count >= 3) {
          // Max attempts reached, cancel subscription
          await stripe.subscriptions.cancel(failure.stripeSubscriptionId);

          await prisma.subscription.update({
            where: { id: failure.subscriptionId },
            data: { status: 'CANCELED' }
          });

          // Send cancellation notification
          if (failure.fanEmail) {
            await sendEmail({
              to: failure.fanEmail,
              subject: `Subscription Canceled - Payment Failed`,
              html: `
                <h1>Subscription Canceled</h1>
                <p>Your subscription to ${failure.artistDisplayName}'s ${failure.tierName} tier has been canceled due to repeated payment failures.</p>
                <p>You can resubscribe at any time by visiting the artist's page.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/artist/${failure.artistId}">Visit ${failure.artistDisplayName}'s page</a></p>
              `,
              text: `Subscription Canceled\n\nYour subscription to ${failure.artistDisplayName}'s ${failure.tierName} tier has been canceled due to repeated payment failures.\n\nYou can resubscribe at any time by visiting the artist's page.\n\nVisit ${failure.artistDisplayName}'s page: ${process.env.NEXT_PUBLIC_APP_URL}/artist/${failure.artistId}`
            });
          }

          events.push({
            type: 'cancellation',
            subscriptionId: failure.subscriptionId,
            amount: parseFloat(failure.amount.toString()),
            timestamp: new Date(),
            metadata: {
              reason: 'payment_failure',
              attemptCount: failure.attemptCount
            }
          });
        } else {
          // Update retry information
          const nextRetry = invoice.next_payment_attempt 
            ? new Date(invoice.next_payment_attempt * 1000)
            : new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours

          await prisma.$executeRaw`
            UPDATE "payment_failures"
            SET "attemptCount" = ${invoice.attempt_count || failure.attemptCount + 1},
                "nextRetryAt" = ${nextRetry},
                "updatedAt" = ${new Date()}
            WHERE "id" = ${failure.id}
          `;

          events.push({
            type: 'retry',
            subscriptionId: failure.subscriptionId,
            amount: parseFloat(failure.amount.toString()),
            timestamp: new Date(),
            metadata: {
              resolved: false,
              attemptCount: invoice.attempt_count || failure.attemptCount + 1,
              nextRetryAt: nextRetry
            }
          });
        }
      } catch (error) {
        console.error(`Error processing retry for payment failure ${failure.id}:`, error);
      }
    }

    return events;
  } catch (error) {
    console.error('Error processing failed payment retries:', error);
    throw new Error('Failed to process failed payment retries');
  }
}

/**
 * Send billing reminders for upcoming renewals
 */
export async function sendBillingReminders(): Promise<number> {
  try {
    let remindersSent = 0;
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Get subscriptions that will renew in 3 days
    const subscriptionsToRemind = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: twoDaysFromNow,
          lte: threeDaysFromNow
        }
      },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true
          }
        }
      }
    });

    for (const subscription of subscriptionsToRemind) {
      try {
        if (subscription.fan.email && subscription.fan.notificationPreferences) {
          const prefs = subscription.fan.notificationPreferences as any;
          if (prefs?.billing !== false) {
            await sendEmail({
              to: subscription.fan.email,
              subject: `Upcoming Renewal - ${subscription.tier.artist?.displayName}`,
              html: `
                <h1>Upcoming Subscription Renewal</h1>
                <p>Your subscription to ${subscription.tier.artist?.displayName}'s ${subscription.tier.name} tier will renew in 3 days.</p>
                <p>Amount: $${subscription.amount}</p>
                <p>Renewal date: ${subscription.currentPeriodEnd.toLocaleDateString()}</p>
                <p>If you need to make changes to your subscription, you can do so in your dashboard.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
              `,
              text: `Upcoming Subscription Renewal\n\nYour subscription to ${subscription.tier.artist?.displayName}'s ${subscription.tier.name} tier will renew in 3 days.\n\nAmount: $${subscription.amount}\nRenewal date: ${subscription.currentPeriodEnd.toLocaleDateString()}\n\nIf you need to make changes to your subscription, you can do so in your dashboard.\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`
            });

            remindersSent++;
          }
        }
      } catch (error) {
        console.error(`Error sending reminder for subscription ${subscription.id}:`, error);
      }
    }

    return remindersSent;
  } catch (error) {
    console.error('Error sending billing reminders:', error);
    throw new Error('Failed to send billing reminders');
  }
}

/**
 * Get billing cycle statistics
 */
export async function getBillingCycleStats(): Promise<{
  activeSubscriptions: number;
  upcomingRenewals: number;
  failedPayments: number;
  totalMonthlyRevenue: number;
}> {
  try {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      activeSubscriptions,
      upcomingRenewals,
      failedPayments,
      revenueResult
    ] = await Promise.all([
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            gte: now,
            lte: nextWeek
          }
        }
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM "payment_failures" WHERE "isResolved" = false`.then((result: any) => parseInt(result[0].count)),
      prisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true }
      })
    ]);

    return {
      activeSubscriptions,
      upcomingRenewals,
      failedPayments,
      totalMonthlyRevenue: parseFloat(revenueResult._sum.amount?.toString() || '0')
    };
  } catch (error) {
    console.error('Error getting billing cycle stats:', error);
    throw new Error('Failed to get billing cycle statistics');
  }
}/**
 *
 Process scheduled tier changes that are due
 */
export async function processScheduledTierChanges(): Promise<BillingCycleEvent[]> {
  try {
    const events: BillingCycleEvent[] = [];
    const now = new Date();

    // Find all invoices with scheduled tier changes for the current period
    const scheduledChanges = await prisma.$queryRaw`
      SELECT i.*, s.id as "subscriptionId", s."tierId", s.amount, s."fanId", s."artistId",
             f.email, f."notificationPreferences",
             t.name as "tierName"
      FROM "invoices" i
      JOIN "subscriptions" s ON i."subscriptionId" = s.id
      JOIN "users" f ON s."fanId" = f.id
      JOIN "tiers" t ON s."tierId" = t.id
      WHERE i.status = 'PAID'
      AND i."periodEnd" <= ${now}
      AND i.items::jsonb ? 'scheduledTierChange'
    ` as any[];

    for (const invoice of scheduledChanges) {
      try {
        // Extract scheduled tier change details from invoice items
        const items = invoice.items as any;
        if (!items.scheduledTierChange) continue;
        
        const { newTierId, newAmount } = items.scheduledTierChange;
        
        // Get the new tier
        const newTier = await prisma.tier.findUnique({
          where: { id: newTierId }
        });
        
        if (!newTier) {
          console.error(`Scheduled tier ${newTierId} not found for invoice ${invoice.id}`);
          continue;
        }
        
        // Apply the tier change
        const subscription = invoice.subscription;
        const currentAmount = parseFloat(subscription.amount.toString());
        const isUpgrade = newAmount > currentAmount;
        
        // Update subscription in database
        await prisma.$transaction(async (tx) => {
          // Update subscription
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              tierId: newTierId,
              amount: new Decimal(newAmount)
            }
          });

          // Update tier subscriber counts
          await tx.tier.update({
            where: { id: subscription.tierId },
            data: { subscriberCount: { decrement: 1 } }
          });

          await tx.tier.update({
            where: { id: newTierId },
            data: { subscriberCount: { increment: 1 } }
          });
          
          // Update invoice to mark scheduled change as processed
          await tx.$executeRaw`
            UPDATE "invoices"
            SET "items" = ${JSON.stringify({
              ...items,
              scheduledTierChange: {
                ...items.scheduledTierChange,
                processed: true,
                processedAt: new Date()
              }
            })},
            "updatedAt" = NOW()
            WHERE "id" = ${invoice.id}
          `;
        });
        
        // Send notification to fan
        if (subscription.fan.email && subscription.fan.notificationPreferences) {
          const prefs = subscription.fan.notificationPreferences as any;
          if (prefs?.billing !== false) {
            await sendEmail({
              to: subscription.fan.email,
              subject: `Subscription Tier Changed - ${newTier.name}`,
              html: `
                <h1>Subscription Tier Changed</h1>
                <p>Your subscription has been changed to the ${newTier.name} tier as scheduled.</p>
                <p>New amount: ${newAmount.toFixed(2)}</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
              `,
              text: `Subscription Tier Changed\n\nYour subscription has been changed to the ${newTier.name} tier as scheduled.\n\nNew amount: ${newAmount.toFixed(2)}\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`
            });
          }
        }
        
        events.push({
          type: 'renewal',
          subscriptionId: subscription.id,
          amount: newAmount,
          timestamp: new Date(),
          metadata: {
            tierChange: {
              fromTierId: subscription.tierId,
              toTierId: newTierId,
              fromAmount: currentAmount,
              toAmount: newAmount,
              isUpgrade
            }
          }
        });
      } catch (error) {
        console.error(`Error processing scheduled tier change for invoice ${invoice.id}:`, error);
      }
    }
    
    return events;
  } catch (error) {
    console.error('Error processing scheduled tier changes:', error);
    throw new Error('Failed to process scheduled tier changes');
  }
}

/**
 * Create a payment failure record
 */
export async function recordPaymentFailure(
  subscriptionId: string,
  stripeInvoiceId: string,
  amount: number,
  failureReason: string
): Promise<void> {
  try {
    // Check if there's already a payment failure record for this invoice
    const existingFailure = await prisma.$queryRaw`
      SELECT * FROM "payment_failures" WHERE "stripeInvoiceId" = ${stripeInvoiceId}
    ` as any[];
    
    if (existingFailure && existingFailure.length > 0) {
      // Update existing record
      await prisma.$executeRaw`
        UPDATE "payment_failures"
        SET "attemptCount" = "attemptCount" + 1,
            "failureReason" = ${failureReason},
            "nextRetryAt" = ${new Date(Date.now() + 24 * 60 * 60 * 1000)},
            "updatedAt" = ${new Date()}
        WHERE "id" = ${existingFailure[0].id}
      `;
    } else {
      // Create new record
      await prisma.$executeRaw`
        INSERT INTO "payment_failures" (
          "id", "subscriptionId", "stripeInvoiceId", "amount", "failureReason", 
          "nextRetryAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${`pf_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 13)}`},
          ${subscriptionId},
          ${stripeInvoiceId},
          ${amount},
          ${failureReason},
          ${new Date(Date.now() + 24 * 60 * 60 * 1000)},
          ${new Date()},
          ${new Date()}
        )
      `;
    }
    
    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'PAST_DUE' }
    });
  } catch (error) {
    console.error('Error recording payment failure:', error);
    throw new Error('Failed to record payment failure');
  }
}

/**
 * Sync all invoices for a specific artist
 */
export async function syncArtistInvoices(artistId: string): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  try {
    let created = 0;
    let updated = 0;
    
    // Get all subscriptions for this artist
    const subscriptions = await prisma.subscription.findMany({
      where: { artistId }
    });
    
    // Process each subscription
    for (const subscription of subscriptions) {
      try {
        const result = await syncSubscriptionInvoices(subscription.id);
        created += result.created;
        updated += result.updated;
      } catch (error) {
        console.error(`Error syncing invoices for subscription ${subscription.id}:`, error);
        // Continue with other subscriptions
      }
    }
    
    return {
      created,
      updated,
      total: created + updated
    };
  } catch (error) {
    console.error('Error syncing artist invoices:', error);
    throw new Error('Failed to sync artist invoices');
  }
}

/**
 * Sync all invoices for a specific subscription
 */
export async function syncSubscriptionInvoices(subscriptionId: string): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
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
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });

      for (const invoice of stripeInvoices.data) {
        try {
          const invoiceData = await generateInvoiceData(invoice.id);
          
          // Check if invoice already exists
          const existingInvoice = await prisma.$queryRaw`
            SELECT * FROM "invoices" WHERE "stripeInvoiceId" = ${invoice.id}
          ` as any[];

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
            const prorationAmount = invoiceData.items.some(item => item.description.includes('Proration'))
              ? invoiceData.items
                  .filter(item => item.description.includes('Proration'))
                  .reduce((sum: number, item) => sum + item.amount, 0)
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
      total: created + updated
    };
  } catch (error) {
    console.error('Error syncing subscription invoices:', error);
    throw new Error('Failed to sync subscription invoices');
  }
}

/**
 * Get billing summary for a specific artist
 */
export async function getArtistBillingSummary(artistId: string): Promise<{
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  revenueChange: number;
  activeSubscriptions: number;
  upcomingRenewals: number;
  failedPayments: number;
  averageSubscriptionValue: number;
  topTiers: Array<{
    tierId: string;
    tierName: string;
    subscriberCount: number;
    revenue: number;
  }>;
}> {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Get current month revenue
    const currentMonthInvoices = await prisma.invoice.findMany({
      where: {
        subscription: {
          artistId
        },
        status: 'PAID',
        paidAt: {
          gte: currentMonthStart,
          lte: now
        }
      },
      select: {
        amount: true
      }
    });
    
    const currentMonthRevenue = currentMonthInvoices.reduce(
      (sum, invoice) => sum + parseFloat(invoice.amount.toString()),
      0
    );
    
    // Get previous month revenue
    const previousMonthInvoices = await prisma.invoice.findMany({
      where: {
        subscription: {
          artistId
        },
        status: 'PAID',
        paidAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd
        }
      },
      select: {
        amount: true
      }
    });
    
    const previousMonthRevenue = previousMonthInvoices.reduce(
      (sum, invoice) => sum + parseFloat(invoice.amount.toString()),
      0
    );
    
    // Calculate revenue change percentage
    const revenueChange = previousMonthRevenue === 0
      ? 100 // If previous month was 0, consider it 100% growth
      : ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
    
    // Get active subscriptions count
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        artistId,
        status: 'ACTIVE'
      }
    });
    
    // Get upcoming renewals
    const upcomingRenewals = await prisma.subscription.count({
      where: {
        artistId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: nextWeek
        }
      }
    });
    
    // Get failed payments
    const failedPayments = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "payment_failures" pf
      JOIN "subscriptions" s ON pf."subscriptionId" = s.id
      WHERE pf."isResolved" = false
      AND s."artistId" = ${artistId}
    `.then((result: any) => parseInt(result[0].count));
    
    // Calculate average subscription value
    const averageSubscriptionValue = activeSubscriptions > 0
      ? (await prisma.subscription.aggregate({
          where: {
            artistId,
            status: 'ACTIVE'
          },
          _avg: {
            amount: true
          }
        }))._avg.amount?.toNumber() || 0
      : 0;
    
    // Get top performing tiers
    const tiers = await prisma.tier.findMany({
      where: {
        artistId
      },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE'
          },
          select: {
            amount: true
          }
        }
      },
      orderBy: {
        subscriberCount: 'desc'
      },
      take: 5
    });
    
    const topTiers = tiers.map(tier => ({
      tierId: tier.id,
      tierName: tier.name,
      subscriberCount: tier.subscriberCount,
      revenue: tier.subscriptions.reduce(
        (sum, sub) => sum + parseFloat(sub.amount.toString()),
        0
      )
    }));
    
    return {
      currentMonthRevenue,
      previousMonthRevenue,
      revenueChange,
      activeSubscriptions,
      upcomingRenewals,
      failedPayments,
      averageSubscriptionValue,
      topTiers
    };
  } catch (error) {
    console.error('Error getting artist billing summary:', error);
    throw new Error('Failed to get artist billing summary');
  }
}

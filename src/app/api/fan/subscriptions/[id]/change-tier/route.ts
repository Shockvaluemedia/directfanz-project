import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calculateTierChangeProration,
  changeTier,
  scheduleTierChange,
  TierChangeOptions,
} from '@/lib/billing';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const changeTierSchema = z.object({
  newTierId: z.string().min(1),
  newAmount: z.number().min(0.01),
  effectiveDate: z.enum(['now', 'next_billing_cycle']).optional().default('now'),
  prorationBehavior: z.enum(['create_prorations', 'none']).optional().default('create_prorations'),
  sendNotification: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { newTierId, newAmount, effectiveDate, prorationBehavior, sendNotification } =
      changeTierSchema.parse(body);

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id,
      },
      include: {
        tiers: true,
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Can only change tiers for active subscriptions');
    }

    // Get new tier details
    const newTier = await prisma.tiers.findUnique({
      where: { id: newTierId },
    });

    if (!newTier) {
      return apiError('NOT_FOUND', 'New tier not found');
    }

    // Validate that the new tier belongs to the same artist
    if (newTier.artistId !== subscription.tiers.artistId) {
      return apiError('BAD_REQUEST', 'Cannot change to a tier from a different artist');
    }

    // Validate minimum amount
    if (newAmount < parseFloat(newTier.minimumPrice.toString())) {
      return apiError('BAD_REQUEST', 'Amount is below minimum price for the new tier');
    }

    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmount > currentAmount;

    try {
      const options: TierChangeOptions = {
        effectiveDate: effectiveDate as 'now' | 'next_billing_cycle',
        prorationBehavior: prorationBehavior as 'create_prorations' | 'none',
        sendNotification,
      };

      let result;
      if (effectiveDate === 'next_billing_cycle') {
        result = await scheduleTierChange(subscription.id, newTierId, newAmount);

        return apiSuccess({ message: `Subscription change scheduled for next billing cycle`,
          tierChange: {
            fromTier: subscription.tiers.name,
            toTier: newTier.name,
            fromAmount: currentAmount,
            toAmount: newAmount,
            scheduledDate: result.scheduledDate,
            isUpgrade,
          } });
      } else {
        result = await changeTier(subscription.id, newTierId, newAmount, options);

        return apiSuccess({ message: `Subscription ${isUpgrade ? 'upgraded' : 'downgraded'} successfully`,
          tierChange: {
            fromTier: subscription.tiers.name,
            toTier: newTier.name,
            fromAmount: currentAmount,
            toAmount: newAmount,
            prorationAmount: result.prorationAmount,
            invoiceId: result.invoiceId,
            effectiveDate: result.effectiveDate,
            isUpgrade,
          } });
      }
    } catch (error) {
      logger.error('Tier change error', {}, error as Error);
      return apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to change tier');
    }
  } catch (error) {
    logger.error('Change tier error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    return apiError('INTERNAL_ERROR', 'Failed to change subscription tier');
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const url = new URL(request.url);
    const newTierId = url.searchParams.get('newTierId');
    const newAmount = url.searchParams.get('newAmount');
    const effectiveDate = url.searchParams.get('effectiveDate') || 'now';

    if (!newTierId || !newAmount) {
      return apiError('BAD_REQUEST', 'Missing newTierId or newAmount parameters');
    }

    const newAmountNum = parseFloat(newAmount);
    if (isNaN(newAmountNum) || newAmountNum <= 0) {
      return apiError('BAD_REQUEST', 'Invalid amount');
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id,
      },
      include: {
        tiers: true,
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    // Get new tier details
    const newTier = await prisma.tiers.findUnique({
      where: { id: newTierId },
    });

    if (!newTier) {
      return apiError('NOT_FOUND', 'New tier not found');
    }

    // Calculate proration preview
    const effectiveDateObj =
      effectiveDate === 'next_billing_cycle' ? subscription.currentPeriodEnd : undefined;

    const prorationPreview = await calculateTierChangeProration(
      subscription.id,
      newTierId,
      newAmountNum,
      { effectiveDate: effectiveDateObj }
    );

    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmountNum > currentAmount;

    return apiSuccess({
      preview: {
        currentTier: subscription.tiers.name,
        newTier: newTier.name,
        currentAmount,
        newAmount: newAmountNum,
        isUpgrade,
        proration: prorationPreview,
        effectiveDate: effectiveDate,
      },
    });
  } catch (error) {
    logger.error('Get tier change preview error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to get tier change preview');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  calculateTierChangeProration, 
  changeTier, 
  scheduleTierChange,
  TierChangeOptions
} from '@/lib/billing';
import { z } from 'zod';

const changeTierSchema = z.object({
  newTierId: z.string().min(1),
  newAmount: z.number().min(0.01),
  effectiveDate: z.enum(['now', 'next_billing_cycle']).optional().default('now'),
  prorationBehavior: z.enum(['create_prorations', 'none']).optional().default('create_prorations'),
  sendNotification: z.boolean().optional().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      newTierId, 
      newAmount, 
      effectiveDate, 
      prorationBehavior, 
      sendNotification 
    } = changeTierSchema.parse(body);

    // Get subscription and verify ownership
    const subscription = await prisma.subscription.findUnique({
      where: { 
        id: params.id,
        fanId: session.user.id,
      },
      include: {
        tier: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Can only change tiers for active subscriptions' },
        { status: 400 }
      );
    }

    // Get new tier details
    const newTier = await prisma.tier.findUnique({
      where: { id: newTierId }
    });

    if (!newTier) {
      return NextResponse.json(
        { error: 'New tier not found' },
        { status: 404 }
      );
    }

    // Validate that the new tier belongs to the same artist
    if (newTier.artistId !== subscription.tier.artistId) {
      return NextResponse.json(
        { error: 'Cannot change to a tier from a different artist' },
        { status: 400 }
      );
    }

    // Validate minimum amount
    if (newAmount < parseFloat(newTier.minimumPrice.toString())) {
      return NextResponse.json(
        { error: 'Amount is below minimum price for the new tier' },
        { status: 400 }
      );
    }

    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmount > currentAmount;

    try {
      const options: TierChangeOptions = {
        effectiveDate: effectiveDate as 'now' | 'next_billing_cycle',
        prorationBehavior: prorationBehavior as 'create_prorations' | 'none',
        sendNotification
      };

      let result;
      if (effectiveDate === 'next_billing_cycle') {
        result = await scheduleTierChange(subscription.id, newTierId, newAmount);
        
        return NextResponse.json({
          success: true,
          message: `Subscription change scheduled for next billing cycle`,
          tierChange: {
            fromTier: subscription.tier.name,
            toTier: newTier.name,
            fromAmount: currentAmount,
            toAmount: newAmount,
            scheduledDate: result.scheduledDate,
            isUpgrade
          }
        });
      } else {
        result = await changeTier(subscription.id, newTierId, newAmount, options);
        
        return NextResponse.json({
          success: true,
          message: `Subscription ${isUpgrade ? 'upgraded' : 'downgraded'} successfully`,
          tierChange: {
            fromTier: subscription.tier.name,
            toTier: newTier.name,
            fromAmount: currentAmount,
            toAmount: newAmount,
            prorationAmount: result.prorationAmount,
            invoiceId: result.invoiceId,
            effectiveDate: result.effectiveDate,
            isUpgrade
          }
        });
      }
    } catch (error) {
      console.error('Tier change error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to change tier' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Change tier error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to change subscription tier' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const newTierId = url.searchParams.get('newTierId');
    const newAmount = url.searchParams.get('newAmount');
    const effectiveDate = url.searchParams.get('effectiveDate') || 'now';

    if (!newTierId || !newAmount) {
      return NextResponse.json(
        { error: 'Missing newTierId or newAmount parameters' },
        { status: 400 }
      );
    }

    const newAmountNum = parseFloat(newAmount);
    if (isNaN(newAmountNum) || newAmountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscription.findUnique({
      where: { 
        id: params.id,
        fanId: session.user.id,
      },
      include: {
        tier: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get new tier details
    const newTier = await prisma.tier.findUnique({
      where: { id: newTierId }
    });

    if (!newTier) {
      return NextResponse.json(
        { error: 'New tier not found' },
        { status: 404 }
      );
    }

    // Calculate proration preview
    const effectiveDateObj = effectiveDate === 'next_billing_cycle' 
      ? subscription.currentPeriodEnd 
      : undefined;
      
    const prorationPreview = await calculateTierChangeProration(
      subscription.id,
      newTierId,
      newAmountNum,
      { effectiveDate: effectiveDateObj }
    );

    const currentAmount = parseFloat(subscription.amount.toString());
    const isUpgrade = newAmountNum > currentAmount;

    return NextResponse.json({
      preview: {
        currentTier: subscription.tier.name,
        newTier: newTier.name,
        currentAmount,
        newAmount: newAmountNum,
        isUpgrade,
        proration: prorationPreview,
        effectiveDate: effectiveDate
      }
    });
  } catch (error) {
    console.error('Get tier change preview error:', error);
    return NextResponse.json(
      { error: 'Failed to get tier change preview' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';

/**
 * POST /api/artist/stripe/connect
 * Creates Stripe Connect account and returns onboarding URL
 * Used by StripeOnboardingModal
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { success: false, error: 'Only artists can connect Stripe' },
        { status: 403 }
      );
    }

    // Get user with artist profile
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { artists: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Check if already has Stripe account
    if (user.artists?.stripeAccountId) {
      // Check if onboarding is complete
      try {
        const account = await stripe.accounts.retrieve(user.artists.stripeAccountId);

        if (account.details_submitted) {
          return NextResponse.json({
            success: true,
            accountId: user.artists.stripeAccountId,
            alreadyConnected: true,
          });
        }

        // Onboarding not complete, generate new link
        const accountLink = await stripe.accountLinks.create({
          account: user.artists.stripeAccountId,
          refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/refresh`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/success`,
          type: 'account_onboarding',
        });

        return NextResponse.json({
          success: true,
          url: accountLink.url,
          accountId: user.artists.stripeAccountId,
        });
      } catch (error) {
        // Account doesn't exist anymore, create new one
        logger.warn('Stripe account not found, creating new one', {
          userId: user.id,
          oldAccountId: user.artists.stripeAccountId,
        });
      }
    }

    // Create new Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Could get from user profile
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/artist/${user.id}`,
        mcc: '8999', // Professional services
        product_description: 'Creator content and fan subscriptions',
      },
      metadata: {
        userId: user.id,
        displayName: user.displayName,
      },
    });

    // Save to database
    await prisma.artists.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeAccountId: account.id,
        isStripeOnboarded: false,
      },
      update: {
        stripeAccountId: account.id,
        isStripeOnboarded: false,
      },
    });

    // Update onboarding progress
    await prisma.onboarding_progress.upsert({
      where: { userId: user.id },
      update: {
        stripeConnected: true,
      },
      create: {
        userId: user.id,
        stripeConnected: true,
      },
    });

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/success`,
      type: 'account_onboarding',
    });

    logger.info('Stripe Connect account created', {
      userId: user.id,
      accountId: account.id,
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      accountId: account.id,
    });
  } catch (error: any) {
    logger.error('Failed to connect Stripe', { error: error.message });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to connect Stripe',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/artist/stripe/connect
 * Returns current Stripe connection status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { artists: true },
    });

    if (!user?.artists?.stripeAccountId) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          accountId: null,
        },
      });
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(user.artists.stripeAccountId);

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        accountId: user.artists.stripeAccountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get Stripe status', { error: error.message });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Stripe status',
      },
      { status: 500 }
    );
  }
}

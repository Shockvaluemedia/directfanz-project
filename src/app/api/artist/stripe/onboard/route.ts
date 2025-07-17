import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createStripeConnectAccount, createAccountLink } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is an artist
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { artistProfile: true },
    });

    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: 'Only artists can onboard with Stripe' },
        { status: 403 }
      );
    }

    // Check if artist already has a Stripe account
    if (user.artistProfile?.stripeAccountId) {
      return NextResponse.json(
        { error: 'Artist already has a Stripe account' },
        { status: 400 }
      );
    }

    // Create Stripe Connect account
    const stripeAccountId = await createStripeConnectAccount(
      user.email,
      user.displayName
    );

    // Update artist profile with Stripe account ID
    await prisma.artist.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeAccountId,
        isStripeOnboarded: false,
      },
      update: {
        stripeAccountId,
        isStripeOnboarded: false,
      },
    });

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/dashboard/artist/stripe/onboard`;
    const returnUrl = `${baseUrl}/dashboard/artist/stripe/complete`;

    const onboardingUrl = await createAccountLink(
      stripeAccountId,
      refreshUrl,
      returnUrl
    );

    return NextResponse.json({
      onboardingUrl,
      stripeAccountId,
    });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to start Stripe onboarding' },
      { status: 500 }
    );
  }
}
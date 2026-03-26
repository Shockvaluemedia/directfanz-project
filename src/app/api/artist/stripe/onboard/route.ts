import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createStripeConnectAccount, createAccountLink } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Verify user is an artist
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { artists: true },
    });

    if (!user || user.role !== 'ARTIST') {
      return apiError('FORBIDDEN', 'Only artists can onboard with Stripe');
    }

    // Check if artist already has a Stripe account
    if (user.artists?.stripeAccountId) {
      return apiError('BAD_REQUEST', 'Artist already has a Stripe account');
    }

    // Create Stripe Connect account
    const stripeAccountId = await createStripeConnectAccount(user.email, user.displayName);

    // Update artist profile with Stripe account ID
    await prisma.artists.upsert({
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

    const onboardingUrl = await createAccountLink(stripeAccountId, refreshUrl, returnUrl);

    return apiSuccess({
      onboardingUrl,
      stripeAccountId,
    });
  } catch (error) {
    logger.error('Stripe onboarding error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to start Stripe onboarding');
  }
}

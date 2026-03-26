import { NextRequest } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccountOnboardingStatus } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Get artist profile
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { artists: true },
    });

    if (!user || user.role !== 'ARTIST') {
      return apiError('FORBIDDEN', 'Only artists can check Stripe status');
    }

    if (!user.artists?.stripeAccountId) {
      return apiSuccess({
        isOnboarded: false,
        hasAccount: false,
      });
    }

    // Check onboarding status with Stripe
    const isOnboarded = await checkAccountOnboardingStatus(user.artists.stripeAccountId);

    // Update database if status changed
    if (isOnboarded !== user.artists.isStripeOnboarded) {
      await prisma.artists.update({
        where: { userId: user.id },
        data: { isStripeOnboarded: isOnboarded },
      });
    }

    return apiSuccess({
      isOnboarded,
      hasAccount: true,
      stripeAccountId: user.artists.stripeAccountId,
    });
  } catch (error) {
    logger.error('Stripe status check error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to check Stripe status');
  }
}

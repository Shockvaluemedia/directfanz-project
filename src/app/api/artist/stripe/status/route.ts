import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccountOnboardingStatus } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get artist profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { artistProfile: true },
    });

    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: 'Only artists can check Stripe status' },
        { status: 403 }
      );
    }

    if (!user.artistProfile?.stripeAccountId) {
      return NextResponse.json({
        isOnboarded: false,
        hasAccount: false,
      });
    }

    // Check onboarding status with Stripe
    const isOnboarded = await checkAccountOnboardingStatus(
      user.artistProfile.stripeAccountId
    );

    // Update database if status changed
    if (isOnboarded !== user.artistProfile.isStripeOnboarded) {
      await prisma.artist.update({
        where: { userId: user.id },
        data: { isStripeOnboarded: isOnboarded },
      });
    }

    return NextResponse.json({
      isOnboarded,
      hasAccount: true,
      stripeAccountId: user.artistProfile.stripeAccountId,
    });
  } catch (error) {
    console.error('Stripe status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check Stripe status' },
      { status: 500 }
    );
  }
}
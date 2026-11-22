import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createCustomerPortalSession, createOrRetrieveCustomer } from '@/lib/stripe';
import { getMemberPortalAccount, MembershipError } from '@/lib/membership';
import { z } from 'zod';

// The fan names the artist; the Stripe account comes from our database, so a
// request can't open a portal on someone else's account.
const portalSchema = z
  .object({
    artistId: z.string().min(1),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artistId } = portalSchema.parse(body);

    // Get user details
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can access customer portal' }, { status: 403 });
    }

    const stripeAccountId = await getMemberPortalAccount(user.id, artistId);

    // Create or retrieve customer
    const customerId = await createOrRetrieveCustomer(
      user.email,
      user.displayName,
      stripeAccountId
    );

    // Create portal session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/dashboard/fan/subscriptions`;

    const portalUrl = await createCustomerPortalSession(customerId, returnUrl, stripeAccountId);

    return NextResponse.json({
      portalUrl,
    });
  } catch (error) {
    if (error instanceof MembershipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Create portal session error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createCustomerPortalSession, createOrRetrieveCustomer } from '@/lib/stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const portalSchema = z.object({
  stripeAccountId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { stripeAccountId } = portalSchema.parse(body);

    // Get user details
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return apiError('FORBIDDEN', 'Only fans can access customer portal');
    }

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

    return apiSuccess({
      portalUrl,
    });
  } catch (error) {
    logger.error('Create portal session error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    return apiError('INTERNAL_ERROR', 'Failed to create portal session');
  }
}

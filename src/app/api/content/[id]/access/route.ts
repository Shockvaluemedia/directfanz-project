import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkContentAccess, generateAccessToken } from '@/lib/content-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// Generate access token for content
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const contentId = params.id;

    // Check if user has access to this content
    const accessResult = await checkContentAccess(session.user.id, contentId);

    if (!accessResult.hasAccess) {
      const errorMessages = {
        not_found: 'Content not found',
        no_subscription: 'Subscription required to access this content',
        invalid_tier: 'Your subscription tier does not include this content',
      };

      return apiError('FORBIDDEN', errorMessages[accessResult.reason as keyof typeof errorMessages] || 'Access denied',
          reason: accessResult.reason,);
    }

    // Generate access token
    const accessToken = generateAccessToken(session.user.id, contentId);

    // Get content metadata for response
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        fileSize: true,
        duration: true,
        format: true,
      },
    });

    return apiSuccess({
        accessToken,
        content,
        expiresIn: 3600, // 1 hour
        accessReason: accessResult.reason,
      });
  } catch (error) {
    logger.error('Access token generation error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to generate access token');
  }
}

// Check content access without generating token
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const contentId = params.id;

    // Check if user has access to this content
    const accessResult = await checkContentAccess(session.user.id, contentId);

    // Get content metadata
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        visibility: true,
        tiers: {
          select: {
            id: true,
            name: true,
            minimumPrice: true,
          },
        },
      },
    });

    return apiSuccess({
        hasAccess: accessResult.hasAccess,
        reason: accessResult.reason,
        content,
        subscription: accessResult.subscription,
      });
  } catch (error) {
    logger.error('Content access check error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to check content access');
  }
}

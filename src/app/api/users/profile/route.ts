import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { userProfileSchema, type UserProfileInput } from '@/lib/validations';
import { apiHandler, apiSuccess, apiError, parseAndValidate, requireAuth } from '@/lib/api-utils';

// GET /api/users/profile - Get current user's profile
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  try {
    const user = await db.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        bio: true,
        socialLinks: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        artists: {
          select: {
            id: true,
            stripeAccountId: true,
            isStripeOnboarded: true,
            totalEarnings: true,
            totalSubscribers: true,
          },
        },
        // Statistics
        _count: {
          select: {
            content: true,
            subscriptions: true,
            comments: true,
            playlists: true,
          },
        },
      },
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess(user);
  } catch (error) {
    console.error('Get profile error:', error);
    return apiError('Failed to get profile', 500);
  }
});

// PUT /api/users/profile - Update current user's profile
export const PUT = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const body = await parseAndValidate(request, userProfileSchema);
  const updateData = body as UserProfileInput;

  try {
    const updatedUser = await db.users.update({
      where: { id: session.user.id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        bio: true,
        socialLinks: true,
        updatedAt: true,
      },
    });

    return apiSuccess(updatedUser, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    return apiError('Failed to update profile', 500);
  }
});

export const OPTIONS = apiHandler(async () => {
  return apiSuccess(null, 'OK');
});

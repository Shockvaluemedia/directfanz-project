import { NextRequest } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getCurrentUser, updateUserProfile, updateProfileSchema } from '@/lib/auth-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required',);
    }

    // Return user profile without password
    const { password, ...userProfile } = user;

    return apiSuccess({
      user: userProfile,
    });
  } catch (error) {
    logger.error('Profile fetch error', {}, error as Error);

    return apiError('INTERNAL_ERROR', 'Internal server error',);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required',);
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateProfileSchema.parse(body);

    // Update user profile
    const updatedUser = await updateUserProfile(user.id, validatedData);

    // Return updated user data (without password)
    const { password, ...userProfile } = updatedUser;

    return apiSuccess({
      message: 'Profile updated successfully',
      user: userProfile,
    });
  } catch (error) {
    logger.error('Profile update error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiValidationError(error.errors);
    }

    if (error instanceof Error) {
      return apiError('BAD_REQUEST', error.message,);
    }

    return apiError('INTERNAL_ERROR', 'Internal server error',);
  }
}

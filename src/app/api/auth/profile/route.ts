import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getCurrentUser, updateUserProfile, updateProfileSchema } from '@/lib/auth-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Return user profile without password
    const { password, ...userProfile } = user;

    return NextResponse.json({
      user: userProfile,
    });
  } catch (error) {
    logger.error('Profile fetch error', {}, error as Error);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateProfileSchema.parse(body);

    // Update user profile
    const updatedUser = await updateUserProfile(user.id, validatedData);

    // Return updated user data (without password)
    const { password, ...userProfile } = updatedUser;

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: userProfile,
    });
  } catch (error) {
    logger.error('Profile update error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

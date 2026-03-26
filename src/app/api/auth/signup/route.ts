import { NextRequest } from 'next/server';
import { createUser, signUpSchema } from '@/lib/auth-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiCreated, apiError, apiValidationError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = signUpSchema.parse(body);

    // Create user
    const user = await createUser(validatedData);

    // Return user data (without password)
    const { password, ...userWithoutPassword } = user;

    return apiCreated({
        message: 'User created successfully',
        user: userWithoutPassword,
      });
  } catch (error) {
    logger.error('Signup error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiValidationError(error.errors);
    }

    if (error instanceof Error) {
      return apiError('BAD_REQUEST', error.message,);
    }

    return apiError('INTERNAL_ERROR', 'Internal server error',);
  }
}

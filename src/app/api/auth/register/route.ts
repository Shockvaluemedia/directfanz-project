import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { randomUUID } from 'crypto';
import {
  withApiHandler,
  ApiRequestContext,
  validateApiRequest
} from '@/lib/api-error-handler';
import { AppError, ErrorCode } from '@/lib/errors';

export const POST = withApiHandler(
  async (context: ApiRequestContext, request: NextRequest) => {
    // Parse and validate request body
    const body = await request.json();
    const { email, password, displayName, role = 'FAN' } = validateApiRequest(
      registerSchema,
      body,
      context
    ) as RegisterInput;

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(
        ErrorCode.ALREADY_EXISTS,
        'A user with this email already exists',
        409,
        { email },
        context.requestId
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        email,
        password: hashedPassword,
        displayName,
        role: role as 'ARTIST' | 'FAN',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // If user is an artist, create artist profile
    if (role === 'ARTIST') {
      await prisma.artists.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0,
        },
      });
    }

    // Return user data (without password)
    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      }
    };
  }
);

export const OPTIONS = withApiHandler(
  async (context: ApiRequestContext) => {
    return { message: 'OK' };
  }
);

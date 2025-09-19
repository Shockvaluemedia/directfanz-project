import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { apiHandler, apiSuccess, apiError, parseAndValidate } from '@/lib/api-utils';
import { randomUUID } from 'crypto';

export const POST = apiHandler(async (request: NextRequest) => {
  // Parse and validate request body
  const body = await parseAndValidate(request, registerSchema);
  const { email, password, displayName, role = 'FAN' } = body as RegisterInput;

  // Check if user already exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
  });

  if (existingUser) {
    return apiError('A user with this email already exists', 400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
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
    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    return apiSuccess(userData, 'User registered successfully');
  } catch (error) {
    console.error('Registration error:', error);
    return apiError('Failed to create user account', 500);
  }
});

export const OPTIONS = apiHandler(async () => {
  return apiSuccess(null, 'OK');
});

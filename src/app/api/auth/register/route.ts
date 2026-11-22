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
import { artistSignupIsOpen, InviteError, redeemArtistInvite } from '@/lib/artist-invites';

export const POST = withApiHandler(
  async (context: ApiRequestContext, request: NextRequest) => {
    // Parse and validate request body
    const body = await request.json();
    const { email, password, displayName, role = 'FAN', inviteCode } = validateApiRequest(
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

    // Artists join by invite; refuse early, before any work.
    if (role === 'ARTIST' && !artistSignupIsOpen() && !inviteCode) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Artist sign-up is by invite only',
        403,
        undefined,
        context.requestId
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user, and for an artist the profile and the used invite, together.
    let user;
    try {
      user = await prisma.$transaction(async tx => {
        const created = await tx.users.create({
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

        if (role === 'ARTIST') {
          const communityId = artistSignupIsOpen()
            ? null
            : await redeemArtistInvite(tx, inviteCode, email, created.id);
          await tx.artists.create({
            data: {
              id: randomUUID(),
              userId: created.id,
              isStripeOnboarded: false,
              totalEarnings: 0,
              totalSubscribers: 0,
              communityId,
            },
          });
        }
        return created;
      });
    } catch (error) {
      if (error instanceof InviteError) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          error.message,
          error.status,
          undefined,
          context.requestId
        );
      }
      throw error;
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

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { businessMetrics } from '@/lib/business-metrics';
import { userEngagementTracker } from '@/lib/user-engagement-tracking';
import { 
  withApiHandler, 
  ApiRequestContext, 
  validateApiRequest 
} from '@/lib/api-error-handler';
import { AppError, ErrorCode } from '@/lib/errors';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = withApiHandler(
  async (context: ApiRequestContext, request: NextRequest) => {
    // Validate request body
    const body = await request.json();
    const { email, password } = validateApiRequest(loginSchema, body, context);

    // Find user by email with timeout protection
    const user = await Promise.race([
      prisma.users.findUnique({
        where: { email: email.toLowerCase() },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new AppError(
          ErrorCode.REQUEST_TIMEOUT,
          'Database query timeout',
          408,
          undefined,
          context.requestId
        )), 10000)
      )
    ]) as any;

    if (!user || !user.password) {
      // Track failed login (non-blocking)
      businessMetrics.track({
        event: 'login_failed',
        properties: {
          reason: 'user_not_found',
          email,
        },
      }).catch?.(err => console.warn('Failed to track login failure:', err));

      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Invalid credentials',
        401,
        undefined,
        context.requestId
      );
    }

    // Compare password with timeout protection
    const isPasswordValid = await Promise.race([
      bcrypt.compare(password, user.password),
      new Promise((_, reject) => 
        setTimeout(() => reject(new AppError(
          ErrorCode.REQUEST_TIMEOUT,
          'Password comparison timeout',
          408,
          undefined,
          context.requestId
        )), 5000)
      )
    ]) as boolean;

    if (!isPasswordValid) {
      // Track failed login (non-blocking)
      businessMetrics.track({
        event: 'login_failed',
        userId: user.id,
        properties: {
          reason: 'invalid_password',
          email,
        },
      }).catch?.(err => console.warn('Failed to track login failure:', err));

      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Invalid credentials',
        401,
        undefined,
        context.requestId
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Track successful login (non-blocking)
    Promise.all([
      businessMetrics.track({
        event: 'user_login',
        userId: user.id,
        properties: {
          role: user.role,
          source: 'login_form',
        },
      }),
      userEngagementTracker.trackUserAuthentication(
        {
          userId: user.id,
          sessionId: 'session_' + Date.now(),
          action: 'login',
          method: 'email',
        },
        {
          source: 'web',
          platform: 'desktop',
        }
      )
    ]).catch(err => console.warn('Failed to track login success:', err));

    // Return success data (wrapper handles response structure)
    const { password: _, ...userWithoutPassword } = user;
    return {
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    };
  }
);

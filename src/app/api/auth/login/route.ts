import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { businessMetrics } from '@/lib/business-metrics';
import { userEngagementTracker } from '@/lib/user-engagement-tracking';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find user by email with timeout protection
    const user = await Promise.race([
      prisma.users.findUnique({
        where: { email: email.toLowerCase() },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
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
      }).catch(err => console.warn('Failed to track login failure:', err));

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare password with timeout protection
    const isPasswordValid = await Promise.race([
      bcrypt.compare(password, user.password),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password comparison timeout')), 5000)
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
      }).catch(err => console.warn('Failed to track login failure:', err));

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Return success immediately, track metrics async
    const { password: _, ...userWithoutPassword } = user;
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });

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

    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    if (error?.message?.includes('timeout')) {
      return NextResponse.json({ error: 'Login request timed out, please try again' }, { status: 408 });
    }
    
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}

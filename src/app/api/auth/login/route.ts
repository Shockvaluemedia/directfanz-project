import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { businessMetrics } from '@/lib/business-metrics';
import { userEngagementTracker } from '@/lib/user-engagement-tracking';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user || !user.password) {
      // Track failed login
      await businessMetrics.track({
        event: 'login_failed',
        properties: {
          reason: 'user_not_found',
          email,
        },
      });
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      // Track failed login
      await businessMetrics.track({
        event: 'login_failed',
        userId: user.id,
        properties: {
          reason: 'invalid_password',
          email,
        },
      });
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
    
    // Track successful login
    await businessMetrics.track({
      event: 'user_login',
      userId: user.id,
      properties: {
        role: user.role,
        source: 'login_form',
      },
    });
    
    await userEngagementTracker.trackUserAuthentication(
      {
        userId: user.id,
        sessionId: 'session_' + Date.now(), // Simple session ID
        action: 'login',
        method: 'email',
      },
      {
        source: 'web',
        platform: 'desktop', // Default platform
      }
    );
    
    // Return success with user data (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

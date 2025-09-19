import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint not available in production' },
      { status: 404 }
    );
  }

  try {
    const { email, password } = await request.json();

    console.log('🔍 Debug Auth - Testing credentials:', {
      email,
      passwordLength: password?.length,
    });

    // Check if user exists
    const user = await db.users.findUnique({
      where: { email },
      include: { artists: true },
    });

    console.log('🔍 Debug Auth - User found:', user ? 'YES' : 'NO');

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        debug: { email, userExists: false },
      });
    }

    console.log('🔍 Debug Auth - User data:', {
      id: user.id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      emailVerified: !!user.emailVerified,
    });

    if (!user.password) {
      return NextResponse.json({
        success: false,
        error: 'User has no password set',
        debug: { email, userExists: true, hasPassword: false },
      });
    }

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔍 Debug Auth - Password valid:', isPasswordValid);

    return NextResponse.json({
      success: isPasswordValid,
      debug: {
        email,
        userExists: true,
        hasPassword: true,
        passwordValid: isPasswordValid,
        userRole: user.role,
        emailVerified: !!user.emailVerified,
      },
    });
  } catch (error) {
    console.error('🔍 Debug Auth - Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        debug: { error: (error as Error).message },
      },
      { status: 500 }
    );
  }
}

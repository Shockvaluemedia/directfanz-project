import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing Server Session ===');
    
    // Log all cookies
    const cookies = request.headers.get('cookie') || '';
    console.log('Cookies received:', cookies.length > 0 ? 'Yes' : 'No');
    console.log('Cookie string length:', cookies.length);
    console.log('Cookie content:', cookies.substring(0, 200) + '...');
    
    // Test getServerSession
    const session = await getServerSession(authOptions);
    console.log('getServerSession result:', session ? 'Found' : 'Not found');
    
    if (session) {
      console.log('Session user:', {
        id: session.user?.id,
        email: session.user?.email,
        role: (session.user as any)?.role,
      });
    }

    return NextResponse.json({
      success: true,
      debug: {
        hasSession: !!session,
        hasCookies: cookies.length > 0,
        cookieLength: cookies.length,
        sessionData: session ? {
          userId: session.user?.id,
          userEmail: session.user?.email,
          userRole: (session.user as any)?.role,
        } : null,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Session test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Session test failed',
      timestamp: new Date().toISOString(),
    });
  }
}
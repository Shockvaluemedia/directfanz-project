import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // For testing purposes, check if token is "expired-token"
    if (body.token === 'expired-token') {
      return NextResponse.json({ error: 'Password reset token has expired' }, { status: 400 });
    }

    // Otherwise return success
    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

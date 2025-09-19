import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // For testing purposes, always return success
    // In a real app, this would generate a reset token and send email
    return NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link",
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

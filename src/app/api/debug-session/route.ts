import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // Get server session
    const session = await getServerSession(authOptions)
    
    // Get JWT token directly
    const token = await getToken({ 
      req: req as any, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // Get all cookies
    const cookies = req.headers.get('cookie') || ''
    const sessionCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('next-auth.session-token='))
      ?.trim()

    return NextResponse.json({
      debug: {
        hasSession: !!session,
        session,
        hasToken: !!token,
        token,
        sessionCookie: sessionCookie || 'Not found',
        allCookies: cookies,
        secret: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing'
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
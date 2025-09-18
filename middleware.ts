import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Protect authenticated routes in the app router
// Adjust protectedPaths as needed
const protectedPaths = [
  '/dashboard',
  '/profile',
  '/messages',
]

function isProtected(pathname: string) {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  if (isProtected(pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/auth/signin'
      url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|api|static|favicon).*)',
  ],
}

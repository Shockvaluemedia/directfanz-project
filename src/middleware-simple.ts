import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    // Simple middleware that just continues the request
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow all requests for debugging
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    // Skip authentication for these paths
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

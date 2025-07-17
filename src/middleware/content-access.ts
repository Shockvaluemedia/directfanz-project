import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkContentAccess, verifyAccessToken } from '@/lib/content-access'

// Middleware to verify content access
export async function withContentAccess(
  request: NextRequest,
  contentId: string,
  handler: (req: NextRequest & { userId: string }) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Check for access token in query params or headers
    const accessToken = request.nextUrl.searchParams.get('token') || 
                       request.headers.get('x-access-token')

    let userId: string

    if (accessToken) {
      // Verify access token
      const tokenData = verifyAccessToken(accessToken)
      if (!tokenData || tokenData.contentId !== contentId) {
        return NextResponse.json(
          { error: 'Invalid or expired access token' },
          { status: 401 }
        )
      }
      userId = tokenData.userId
    } else {
      // Fall back to session authentication
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      })

      if (!token?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      userId = token.id as string
    }

    // Check content access
    const accessResult = await checkContentAccess(userId, contentId)
    
    if (!accessResult.hasAccess) {
      const errorMessages = {
        'not_found': 'Content not found',
        'no_subscription': 'Subscription required to access this content',
        'invalid_tier': 'Your subscription tier does not include this content'
      }

      return NextResponse.json(
        { 
          error: errorMessages[accessResult.reason as keyof typeof errorMessages] || 'Access denied',
          reason: accessResult.reason
        },
        { status: 403 }
      )
    }

    // Attach userId to request and call handler
    const requestWithUser = request as NextRequest & { userId: string }
    requestWithUser.userId = userId

    return await handler(requestWithUser)
  } catch (error) {
    console.error('Content access middleware error:', error)
    return NextResponse.json(
      { error: 'Access verification failed' },
      { status: 500 }
    )
  }
}

// Middleware for streaming content access
export async function withStreamingAccess(
  request: NextRequest,
  contentId: string,
  handler: (req: NextRequest & { userId: string }) => Promise<Response>
): Promise<Response> {
  try {
    // Check for access token in query params or headers
    const accessToken = request.nextUrl.searchParams.get('token') || 
                       request.headers.get('x-access-token')

    let userId: string

    if (accessToken) {
      // Verify access token
      const tokenData = verifyAccessToken(accessToken)
      if (!tokenData || tokenData.contentId !== contentId) {
        return new Response('Invalid or expired access token', { status: 401 })
      }
      userId = tokenData.userId
    } else {
      // Fall back to session authentication
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      })

      if (!token?.id) {
        return new Response('Authentication required', { status: 401 })
      }
      userId = token.id as string
    }

    // Check content access
    const accessResult = await checkContentAccess(userId, contentId)
    
    if (!accessResult.hasAccess) {
      return new Response('Access denied', { status: 403 })
    }

    // Attach userId to request and call handler
    const requestWithUser = request as NextRequest & { userId: string }
    requestWithUser.userId = userId

    return await handler(requestWithUser)
  } catch (error) {
    console.error('Streaming access middleware error:', error)
    return new Response('Access verification failed', { status: 500 })
  }
}

// Helper to create content access middleware
export function createContentAccessMiddleware(contentIdExtractor: (req: NextRequest) => string) {
  return async function(
    request: NextRequest,
    handler: (req: NextRequest & { userId: string }) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const contentId = contentIdExtractor(request)
    return withContentAccess(request, contentId, handler)
  }
}

// Helper to create streaming access middleware
export function createStreamingAccessMiddleware(contentIdExtractor: (req: NextRequest) => string) {
  return async function(
    request: NextRequest,
    handler: (req: NextRequest & { userId: string }) => Promise<Response>
  ): Promise<Response> {
    const contentId = contentIdExtractor(request)
    return withStreamingAccess(request, contentId, handler)
  }
}
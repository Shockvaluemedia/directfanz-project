import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkContentAccess, verifyAccessToken } from '@/lib/content-access';

type RequestWithUser = NextRequest & { userId: string };

/**
 * Resolves who is asking: a content access token (`?token=` or
 * `x-access-token`) bound to this content, or the signed-in session.
 * getServerSession is used rather than next-auth's getToken because the app
 * signs its own HS256 session JWTs, which getToken cannot decode.
 */
async function resolveUserId(
  request: NextRequest,
  contentId: string
): Promise<{ userId: string } | { error: 'invalid_token' | 'unauthenticated' }> {
  const accessToken =
    new URL(request.url).searchParams.get('token') || request.headers.get('x-access-token');

  if (accessToken) {
    const tokenData = verifyAccessToken(accessToken);
    if (!tokenData || tokenData.contentId !== contentId) {
      return { error: 'invalid_token' };
    }
    return { userId: tokenData.userId };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: 'unauthenticated' };
  }
  return { userId: session.user.id as string };
}

const ACCESS_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Content not found',
  no_subscription: 'Subscription required to access this content',
  invalid_tier: 'Your subscription tier does not include this content',
};

// Middleware to verify content access (JSON responses)
export async function withContentAccess(
  request: NextRequest,
  contentId: string,
  handler: (req: RequestWithUser) => Promise<Response>
): Promise<Response> {
  try {
    const identity = await resolveUserId(request, contentId);
    if ('error' in identity) {
      return NextResponse.json(
        {
          error:
            identity.error === 'invalid_token'
              ? 'Invalid or expired access token'
              : 'Authentication required',
        },
        { status: 401 }
      );
    }

    const accessResult = await checkContentAccess(identity.userId, contentId);
    if (!accessResult.hasAccess) {
      const reason = accessResult.reason ?? 'no_subscription';
      return NextResponse.json(
        { error: ACCESS_ERROR_MESSAGES[reason] || 'Access denied', reason },
        { status: reason === 'not_found' ? 404 : 403 }
      );
    }

    const requestWithUser = request as RequestWithUser;
    requestWithUser.userId = identity.userId;
    return await handler(requestWithUser);
  } catch (error) {
    console.error('Content access middleware error:', error);
    return NextResponse.json({ error: 'Access verification failed' }, { status: 500 });
  }
}

// Middleware for streaming content access (plain-text responses)
export async function withStreamingAccess(
  request: NextRequest,
  contentId: string,
  handler: (req: RequestWithUser) => Promise<Response>
): Promise<Response> {
  try {
    const identity = await resolveUserId(request, contentId);
    if ('error' in identity) {
      return new Response(
        identity.error === 'invalid_token'
          ? 'Invalid or expired access token'
          : 'Authentication required',
        { status: 401 }
      );
    }

    const accessResult = await checkContentAccess(identity.userId, contentId);
    if (!accessResult.hasAccess) {
      return accessResult.reason === 'not_found'
        ? new Response('Content not found', { status: 404 })
        : new Response('Access denied', { status: 403 });
    }

    const requestWithUser = request as RequestWithUser;
    requestWithUser.userId = identity.userId;
    return await handler(requestWithUser);
  } catch (error) {
    console.error('Streaming access middleware error:', error);
    return new Response('Access verification failed', { status: 500 });
  }
}

// Helper to create content access middleware
export function createContentAccessMiddleware(contentIdExtractor: (req: NextRequest) => string) {
  return async function (
    request: NextRequest,
    handler: (req: RequestWithUser) => Promise<Response>
  ): Promise<Response> {
    const contentId = contentIdExtractor(request);
    return withContentAccess(request, contentId, handler);
  };
}

// Helper to create streaming access middleware
export function createStreamingAccessMiddleware(contentIdExtractor: (req: NextRequest) => string) {
  return async function (
    request: NextRequest,
    handler: (req: RequestWithUser) => Promise<Response>
  ): Promise<Response> {
    const contentId = contentIdExtractor(request);
    return withStreamingAccess(request, contentId, handler);
  };
}

/**
 * The content-access middleware gates /stream and /download. It must read the
 * session through getServerSession (next-auth's getToken cannot decode this
 * app's HS256 session JWTs, so it used to 401 every signed-in user), honour a
 * content-bound access token, and map access results to the right statuses.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/content-access', () => ({
  checkContentAccess: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

const { getServerSession } = require('next-auth');
const { checkContentAccess, verifyAccessToken } = require('@/lib/content-access');
const { withContentAccess, withStreamingAccess } = require('@/middleware/content-access');

const req = (url = 'http://localhost:3000/api/content/c1/stream', headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers });

describe('content-access middleware', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockReset();
    (checkContentAccess as jest.Mock).mockReset();
    (verifyAccessToken as jest.Mock).mockReset();
  });

  it('authenticates through the session and hands the handler the user id', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'subscription' });
    const handler = jest.fn(async (r: { userId: string }) => new Response(`ok:${r.userId}`, { status: 200 }));

    const response = await withStreamingAccess(req(), 'c1', handler);

    expect(checkContentAccess).toHaveBeenCalledWith('fan-1', 'c1');
    expect(response.status).toBe(200);
    expect(handler.mock.calls[0][0].userId).toBe('fan-1');
  });

  it('returns 401 when there is neither a session nor a token', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const handler = jest.fn();

    const streaming = await withStreamingAccess(req(), 'c1', handler);
    const json = await withContentAccess(req(), 'c1', handler);

    expect(streaming.status).toBe(401);
    expect(json.status).toBe(401);
    expect(await json.json()).toEqual({ error: 'Authentication required' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts a content-bound access token without consulting the session', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'fan-2', contentId: 'c1' });
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'subscription' });
    const handler = jest.fn(async () => new Response('ok'));

    const response = await withStreamingAccess(req('http://localhost:3000/api/content/c1/stream?token=t1'), 'c1', handler);

    expect(verifyAccessToken).toHaveBeenCalledWith('t1');
    expect(getServerSession).not.toHaveBeenCalled();
    expect(checkContentAccess).toHaveBeenCalledWith('fan-2', 'c1');
    expect(response.status).toBe(200);
  });

  it('rejects a token issued for different content', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'fan-2', contentId: 'other' });
    const handler = jest.fn();

    const response = await withContentAccess(req('http://localhost:3000/api/content/c1/download', { 'x-access-token': 't1' }), 'c1', handler);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid or expired access token' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 with the reason when access is denied', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'no_subscription' });

    const json = await withContentAccess(req(), 'c1', jest.fn());
    const streaming = await withStreamingAccess(req(), 'c1', jest.fn());

    expect(json.status).toBe(403);
    expect(await json.json()).toEqual({
      error: 'Subscription required to access this content',
      reason: 'no_subscription',
    });
    expect(streaming.status).toBe(403);
  });

  it('returns 404 rather than 403 for content that does not exist', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'not_found' });

    const json = await withContentAccess(req(), 'c1', jest.fn());
    const streaming = await withStreamingAccess(req(), 'c1', jest.fn());

    expect(json.status).toBe(404);
    expect(streaming.status).toBe(404);
  });
});

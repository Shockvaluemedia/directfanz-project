/**
 * Next invokes route handlers as `(request, { params })`, and the API wrappers
 * must hand that real request to the handler. Until Next 15's route typing
 * exposed it, they forwarded the route-context object in the request's place,
 * so a handler declared `(context, request)` received `{ params }` and
 * `request.json()` threw. These tests run the real wrappers, not the mocks the
 * route integration tests use.
 */
import { NextRequest } from 'next/server';
import { withApiHandler, withArtistApiHandler } from '@/lib/api-error-handler';
import { withErrorHandling } from '@/lib/error-handler';

const { getServerSession } = require('next-auth');

const postJson = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const routeContext = { params: Promise.resolve({ id: 'item-1' }) };

describe('API route wrappers pass the real request and route context', () => {
  it('withApiHandler gives the handler the request, then the route context', async () => {
    const handler = jest.fn(async (_context: unknown, request: NextRequest, ctx: typeof routeContext) => ({
      body: await request.json(),
      params: await ctx.params,
    }));
    const route = withApiHandler(handler);
    const request = postJson({ hello: 'world' });

    const response = await route(request, routeContext);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [, receivedRequest, receivedContext] = handler.mock.calls[0];
    expect(receivedRequest).toBe(request);
    expect(receivedContext).toBe(routeContext);
    await expect(handler.mock.results[0].value).resolves.toEqual({
      body: { hello: 'world' },
      params: { id: 'item-1' },
    });
  });

  it('withErrorHandling gives the handler the request, then the route context', async () => {
    const handler = jest.fn(async (_context: unknown, request: NextRequest) => ({
      body: await request.json(),
    }));
    const route = withErrorHandling(handler);
    const request = postJson({ report: 'csp' });

    const response = await route(request, routeContext);

    expect(response.status).toBe(200);
    const [, receivedRequest, receivedContext] = handler.mock.calls[0];
    expect(receivedRequest).toBe(request);
    expect(receivedContext).toBe(routeContext);
    await expect(handler.mock.results[0].value).resolves.toEqual({ body: { report: 'csp' } });
  });

  it('withArtistApiHandler threads the request through the role-scoped chain', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'artist-1', role: 'ARTIST' } });
    const handler = jest.fn(async () => ({ ok: true }));
    const route = withArtistApiHandler(handler);
    const request = postJson({ title: 'New track' });

    const response = await route(request, routeContext);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [, userId, receivedRequest, receivedContext] = handler.mock.calls[0];
    expect(userId).toBe('artist-1');
    expect(receivedRequest).toBe(request);
    expect(receivedContext).toBe(routeContext);
  });
});

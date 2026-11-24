/**
 * /api/content/[id]/stream must proxy the media bytes. It used to 302 to the
 * permanent public storage URL, which any subscriber could share.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));
jest.mock('@/lib/content-access', () => ({
  checkContentAccess: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

const { getServerSession } = require('next-auth');
const { checkContentAccess } = require('@/lib/content-access');
const { GET, HEAD } = require('@/app/api/content/[id]/stream/route');

const OWN_TOKEN = 'vercel_blob_rw_StoreAbc123_0123456789abcdef';
const BLOB_URL = 'https://storeabc123.public.blob.vercel-storage.com/content/u1/video/a.mp4';
const row = (overrides: Record<string, unknown> = {}) => ({
  fileUrl: BLOB_URL,
  format: 'video/mp4',
  type: 'VIDEO',
  title: 'A',
  ...overrides,
});

const call = (fn: typeof GET, headers: Record<string, string> = {}) =>
  fn(new NextRequest('http://localhost:3000/api/content/c1/stream', { headers }), {
    params: Promise.resolve({ id: 'c1' }),
  });

describe('GET /api/content/[id]/stream', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = OWN_TOKEN;
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    (getServerSession as jest.Mock).mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
    (checkContentAccess as jest.Mock).mockReset();
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'subscription' });
    (prisma.content.findUnique as jest.Mock).mockReset();
  });
  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('requires a session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await call(GET);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies subscribers without access', async () => {
    (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'no_subscription' });
    const response = await call(GET);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the content row is gone', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await call(GET);
    expect(response.status).toBe(404);
  });

  it('proxies the bytes with Range support instead of redirecting', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row());
    fetchMock.mockResolvedValue(
      new Response('chunk', {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-4/100', 'content-length': '5' },
      })
    );

    const response = await call(GET, { range: 'bytes=0-4' });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(BLOB_URL),
      expect.objectContaining({ headers: expect.objectContaining({ range: 'bytes=0-4' }) })
    );
    expect(response.status).toBe(206);
    expect(response.status).not.toBe(302);
    expect(response.headers.get('location')).toBeFalsy();
    expect(response.headers.get('content-range')).toBe('bytes 0-4/100');
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-security-policy')).toBe('sandbox');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.body).toBe('chunk');
  });

  it("never fetches a fileUrl outside this deployment's store, even another tenant's Blob host", async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(
      row({ fileUrl: 'https://someone-else.public.blob.vercel-storage.com/steal.mp4' })
    );
    const response = await call(GET);
    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to serve a stored HTML "format" inline', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row({ format: 'text/html', fileUrl: BLOB_URL.replace('a.mp4', 'evil.html') }));
    fetchMock.mockResolvedValue(new Response('<script>', { status: 200, headers: { 'content-type': 'text/html' } }));

    const response = await call(GET);

    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment/);
    expect(response.headers.get('content-security-policy')).toBe('sandbox');
  });

  it('answers HEAD with headers only', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue(row());
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { 'content-length': '100' } }));

    const response = await call(HEAD);

    expect(fetchMock.mock.calls[0][1].method).toBe('HEAD');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('100');
    expect(response.body).toBeNull();
  });
});

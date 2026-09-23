/**
 * /api/content/[id]/download must stream the file as an attachment. It used to
 * answer with JSON containing the raw storage URL.
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
const { logger } = require('@/lib/logger');
const { GET } = require('@/app/api/content/[id]/download/route');

const BLOB_URL = 'https://store.public.blob.vercel-storage.com/content/u1/audio/a.mp3';

const call = () =>
  GET(new NextRequest('http://localhost:3000/api/content/c1/download'), { params: Promise.resolve({ id: 'c1' }) });

describe('GET /api/content/[id]/download', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
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
  });

  it('requires a session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams the file as an attachment and never returns the storage URL', async () => {
    (prisma.content.findUnique as jest.Mock).mockResolvedValue({
      fileUrl: BLOB_URL,
      title: 'My Song!',
      format: 'audio/mpeg',
      users: { displayName: 'DJ Casey' },
    });
    fetchMock.mockResolvedValue(new Response('bytes', { status: 200, headers: { 'content-length': '5' } }));

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment; filename="DJ_Casey_My_Song_.mp3"');
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBeFalsy();
    // The body is the media itself, not a JSON envelope pointing at the blob.
    expect(response.body).toBe('bytes');
    expect(logger.info).toHaveBeenCalledWith('Content downloaded', { userId: 'fan-1', contentId: 'c1' });
  });
});

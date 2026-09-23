/**
 * /api/files/content/[filename] serves dev-uploaded files. A file that backs
 * gated content must require the same access as /stream (it used to be served
 * to anyone, cached as public and immutable); ungated files stay cacheable.
 */
import os from 'os';
import path from 'path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { Readable } from 'stream';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('fs/promises', () => jest.requireActual('fs/promises'));
jest.mock('@/lib/content-access', () => ({ checkContentAccess: jest.fn() }));

const { getServerSession } = require('next-auth');
const { checkContentAccess } = require('@/lib/content-access');
const { GET, HEAD } = require('@/app/api/files/content/[filename]/route');

async function readBody(body: unknown): Promise<string> {
  if (!body) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of Readable.fromWeb(body as any)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

const call = (fn: typeof GET, filename: string, headers: Record<string, string> = {}) =>
  fn(new NextRequest(`http://localhost:3000/api/files/content/${filename}`, { headers }), {
    params: Promise.resolve({ filename }),
  });

describe('/api/files/content/[filename]', () => {
  let dir: string;
  let cwdSpy: jest.SpyInstance;

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'files-route-'));
    mkdirSync(path.join(dir, 'uploads', 'content'), { recursive: true });
    writeFileSync(path.join(dir, 'uploads', 'content', 'paid.mp3'), 'abcdefghij');
    writeFileSync(path.join(dir, 'uploads', 'content', 'thumb-1.jpg'), 'jpeg');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  beforeEach(() => {
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(dir);
    (getServerSession as jest.Mock).mockReset();
    (checkContentAccess as jest.Mock).mockReset();
    (prisma.content.findFirst as jest.Mock).mockReset();
  });
  afterEach(() => cwdSpy.mockRestore());

  describe('a file that backs gated content', () => {
    beforeEach(() => {
      (prisma.content.findFirst as jest.Mock).mockResolvedValue({ id: 'c1', visibility: 'SUBSCRIBERS_ONLY' });
    });

    it('looks the owner up by the stored fileUrl', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      await call(GET, 'paid.mp3');
      expect(prisma.content.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fileUrl: { endsWith: '/api/files/content/paid.mp3' } } })
      );
    });

    it('requires a session', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const response = await call(GET, 'paid.mp3');
      expect(response.status).toBe(401);
    });

    it('denies users without access', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
      (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: false, reason: 'no_subscription' });
      const response = await call(GET, 'paid.mp3');
      expect(response.status).toBe(403);
      expect(checkContentAccess).toHaveBeenCalledWith('fan-1', 'c1');
    });

    it('serves entitled users privately, with Range support', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
      (checkContentAccess as jest.Mock).mockResolvedValue({ hasAccess: true, reason: 'subscription' });

      const response = await call(GET, 'paid.mp3', { range: 'bytes=0-3' });

      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 0-3/10');
      expect(response.headers.get('content-type')).toBe('audio/mpeg');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(readBody(response.body)).resolves.toBe('abcd');
    });
  });

  it('serves ungated files (thumbnails, public content) cacheably without a session', async () => {
    (prisma.content.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await call(GET, 'thumb-1.jpg');

    expect(getServerSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    await expect(readBody(response.body)).resolves.toBe('jpeg');
  });

  it('rejects an encoded path traversal before any lookup', async () => {
    (prisma.content.findFirst as jest.Mock).mockResolvedValue(null);
    // path.basename leaves "%2F" alone; the proxy decodes it, sees a nested
    // path, and refuses to map it onto the upload root.
    const response = await call(GET, '..%2F..%2Fthumb-1.jpg');
    expect(response.status).toBe(404);
    expect(prisma.content.findFirst).not.toHaveBeenCalled();
  });

  it('answers HEAD with headers only and 404 for a missing file', async () => {
    (prisma.content.findFirst as jest.Mock).mockResolvedValue(null);

    const head = await call(HEAD, 'thumb-1.jpg');
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('4');
    expect(head.body).toBeNull();

    const missing = await call(GET, 'nope.bin');
    expect(missing.status).toBe(404);
  });
});

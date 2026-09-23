/**
 * The media proxy is what keeps the raw storage URL off the wire: it must
 * refuse non-allowlisted hosts (artists control fileUrl, so a server-side
 * fetch is otherwise an SSRF primitive), confine local paths to the upload
 * roots, forward Range requests correctly, cap open-ended ranges, and never
 * redirect or cache.
 */
import os from 'os';
import path from 'path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { Readable } from 'stream';

// jest.setup mocks fs/promises globally; the disk cases below need the real one.
jest.mock('fs/promises', () => jest.requireActual('fs/promises'));

import {
  MAX_CHUNK_BYTES,
  capOpenEndedRange,
  extensionFor,
  isAllowedRemoteHost,
  mimeFor,
  parseRange,
  proxyMedia,
  resolveMediaSource,
} from '@/lib/media-proxy';

const request = (headers: Record<string, string> = {}) => ({
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

async function readBody(body: unknown): Promise<string> {
  if (!body) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of Readable.fromWeb(body as any)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

const BLOB_URL = 'https://store.public.blob.vercel-storage.com/content/u1/video/a.mp4';

describe('resolveMediaSource', () => {
  let cwdSpy: jest.SpyInstance;
  beforeEach(() => {
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/srv/app');
    delete process.env.MEDIA_PROXY_ALLOWED_HOSTS;
    delete process.env.STORAGE_DIR;
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });
  afterEach(() => cwdSpy.mockRestore());

  it('accepts https Vercel Blob URLs as remote sources', () => {
    expect(resolveMediaSource(BLOB_URL)).toEqual({ kind: 'remote', url: new URL(BLOB_URL) });
  });

  it('refuses http, foreign hosts, and link-local metadata addresses', () => {
    expect(resolveMediaSource('http://store.public.blob.vercel-storage.com/a.mp4')).toBeNull();
    expect(resolveMediaSource('https://evil.example.com/a.mp4')).toBeNull();
    expect(resolveMediaSource('http://169.254.169.254/latest/meta-data/')).toBeNull();
    expect(resolveMediaSource('https://169.254.169.254/latest/meta-data/')).toBeNull();
    expect(isAllowedRemoteHost(new URL('https://public.blob.vercel-storage.com.evil.com/x'))).toBe(false);
  });

  it('honours MEDIA_PROXY_ALLOWED_HOSTS for additional https hosts', () => {
    process.env.MEDIA_PROXY_ALLOWED_HOSTS = 'cdn.example.com, media.example.org';
    expect(resolveMediaSource('https://cdn.example.com/a.mp4')?.kind).toBe('remote');
    expect(resolveMediaSource('https://MEDIA.example.org/a.mp4')?.kind).toBe('remote');
    expect(resolveMediaSource('http://cdn.example.com/a.mp4')).toBeNull();
  });

  it('maps /api/files/content/<name> onto the uploads/content root, by basename only', () => {
    expect(resolveMediaSource('/api/files/content/song.mp3')).toEqual({
      kind: 'local',
      filePath: path.resolve('/srv/app', 'uploads', 'content', 'song.mp3'),
    });
    expect(resolveMediaSource('/api/files/content/../../etc/passwd')).toBeNull();
    expect(resolveMediaSource('/api/files/content/..%2F..%2Fetc%2Fpasswd')).toBeNull();
  });

  it('maps /uploads/<rest> onto STORAGE_DIR and rejects escapes', () => {
    expect(resolveMediaSource('/uploads/content/u1/audio/a.mp3')).toEqual({
      kind: 'local',
      filePath: path.resolve('/srv/app', 'public/uploads', 'content/u1/audio/a.mp3'),
    });
    expect(resolveMediaSource('/uploads/../../.env')).toBeNull();
    expect(resolveMediaSource('/uploads/')).toBeNull();

    process.env.STORAGE_DIR = 'var/media';
    expect(resolveMediaSource('/uploads/x.mp3')?.kind === 'local' && resolveMediaSource('/uploads/x.mp3')).toEqual({
      kind: 'local',
      filePath: path.resolve('/srv/app', 'var/media', 'x.mp3'),
    });
  });

  it('accepts absolute local-origin URLs for local files but not other origins', () => {
    expect(resolveMediaSource('http://localhost:3000/uploads/content/u1/a.mp3')?.kind).toBe('local');
    process.env.NEXT_PUBLIC_BASE_URL = 'https://dev.example.com';
    expect(resolveMediaSource('https://dev.example.com/uploads/content/u1/a.mp3')?.kind).toBe('local');
    expect(resolveMediaSource('https://other.example.com/uploads/content/u1/a.mp3')).toBeNull();
  });

  it('rejects anything else', () => {
    expect(resolveMediaSource('')).toBeNull();
    expect(resolveMediaSource('content/u1/a.mp3')).toBeNull();
    expect(resolveMediaSource('/etc/passwd')).toBeNull();
    expect(resolveMediaSource('file:///etc/passwd')).toBeNull();
  });
});

describe('parseRange', () => {
  it('handles the common forms', () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=990-', 1000)).toEqual({ start: 990, end: 999 });
    // An explicit end past the file is clamped.
    expect(parseRange('bytes=0-5000', 100)).toEqual({ start: 0, end: 99 });
  });

  it('caps open-ended ranges at MAX_CHUNK_BYTES', () => {
    const size = 50 * 1024 * 1024;
    expect(parseRange('bytes=0-', size)).toEqual({ start: 0, end: MAX_CHUNK_BYTES - 1 });
    expect(parseRange('bytes=100-', size)).toEqual({ start: 100, end: 100 + MAX_CHUNK_BYTES - 1 });
  });

  it('reports malformed and unsatisfiable ranges', () => {
    expect(parseRange('bytes=5-3', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=abc', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=-', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=0-4,6-9', 10)).toBe('unsatisfiable');
  });
});

describe('capOpenEndedRange', () => {
  it('bounds only the open-ended form', () => {
    expect(capOpenEndedRange('bytes=10-')).toBe(`bytes=10-${10 + MAX_CHUNK_BYTES - 1}`);
    expect(capOpenEndedRange('bytes=0-99')).toBe('bytes=0-99');
    expect(capOpenEndedRange('bytes=-500')).toBe('bytes=-500');
    expect(capOpenEndedRange(null)).toBeNull();
  });
});

describe('mime helpers', () => {
  it('derives content types and extensions from either a MIME type or a bare extension', () => {
    expect(mimeFor('video/mp4', 'x')).toBe('video/mp4');
    expect(mimeFor('mp3', 'x')).toBe('audio/mpeg');
    expect(mimeFor(null, 'https://b/a.webm?x=1')).toBe('video/webm');
    expect(mimeFor('zzz', 'https://b/a.unknown')).toBe('application/octet-stream');
    expect(extensionFor('video/mp4', 'x')).toBe('mp4');
    expect(extensionFor('MP3', 'x')).toBe('mp3');
    expect(extensionFor(null, 'https://b/a.wav')).toBe('wav');
    expect(extensionFor(null, 'https://b/noext')).toBe('bin');
  });
});

describe('proxyMedia (remote)', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  const source = { kind: 'remote' as const, url: new URL(BLOB_URL) };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('forwards a capped Range upstream and passes the 206 through without redirecting', async () => {
    fetchMock.mockResolvedValue(
      new Response('chunk', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '5',
          'content-range': 'bytes 0-4/100',
          etag: '"abc"',
          'set-cookie': 'leak=1',
        },
      })
    );

    const response = await proxyMedia(request({ range: 'bytes=0-' }), source, { disposition: 'inline' });

    expect(fetchMock).toHaveBeenCalledWith(
      source.url,
      expect.objectContaining({
        method: 'GET',
        headers: { range: `bytes=0-${MAX_CHUNK_BYTES - 1}` },
        redirect: 'error',
        cache: 'no-store',
      })
    );
    expect(response.status).toBe(206);
    // Absent headers: real Headers.get gives null, the jest Map mock gives undefined.
    expect(response.headers.get('location')).toBeFalsy();
    expect(response.headers.get('content-range')).toBe('bytes 0-4/100');
    expect(response.headers.get('content-length')).toBe('5');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('set-cookie')).toBeFalsy();
    expect(response.body).toBe('chunk');
  });

  it('serves the full body when no Range is requested and never forwards credentials', async () => {
    fetchMock.mockResolvedValue(new Response('all', { status: 200, headers: { 'content-type': 'audio/mpeg' } }));

    const response = await proxyMedia(request(), source, { disposition: 'inline' });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
    expect(response.status).toBe(200);
    expect(response.body).toBe('all');
  });

  it('maps unexpected upstream statuses to 502', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const response = await proxyMedia(request(), source, { disposition: 'inline' });
    expect(response.status).toBe(502);
  });

  it('answers HEAD with headers only', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { 'content-length': '9' } }));
    const response = await proxyMedia(request(), source, { disposition: 'inline', head: true });
    expect(fetchMock.mock.calls[0][1].method).toBe('HEAD');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('9');
    expect(response.body).toBeNull();
  });

  it('builds an attachment disposition with a sanitised filename', async () => {
    fetchMock.mockResolvedValue(new Response('x', { status: 200 }));
    const response = await proxyMedia(request(), source, { disposition: { attachment: 'My Song (live).mp3' } });
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="My_Song__live_.mp3"; filename*=UTF-8''My%20Song%20(live).mp3`
    );
  });
});

describe('proxyMedia (local disk)', () => {
  let dir: string;
  let cwdSpy: jest.SpyInstance;
  const content = '0123456789';

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'media-proxy-'));
    mkdirSync(path.join(dir, 'uploads', 'content'), { recursive: true });
    writeFileSync(path.join(dir, 'uploads', 'content', 'clip.bin'), content);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(dir);
  });
  afterEach(() => cwdSpy.mockRestore());

  const source = () => resolveMediaSource('/api/files/content/clip.bin')!;

  it('serves the whole file with a 200 when no Range is requested', async () => {
    const response = await proxyMedia(request(), source(), { disposition: 'inline' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('etag')).toMatch(/^W\/"10-\d+"$/);
    await expect(readBody(response.body)).resolves.toBe(content);
  });

  it('serves exact byte ranges, including suffix ranges', async () => {
    const mid = await proxyMedia(request({ range: 'bytes=2-5' }), source(), { disposition: 'inline' });
    expect(mid.status).toBe(206);
    expect(mid.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(mid.headers.get('content-length')).toBe('4');
    await expect(readBody(mid.body)).resolves.toBe('2345');

    const tail = await proxyMedia(request({ range: 'bytes=-3' }), source(), { disposition: 'inline' });
    expect(tail.status).toBe(206);
    expect(tail.headers.get('content-range')).toBe('bytes 7-9/10');
    await expect(readBody(tail.body)).resolves.toBe('789');
  });

  it('answers an unsatisfiable range with 416 and the file size', async () => {
    const response = await proxyMedia(request({ range: 'bytes=10-' }), source(), { disposition: 'inline' });
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */10');
    expect(response.body).toBeNull();
  });

  it('answers HEAD with headers only and 404 for a missing file', async () => {
    const head = await proxyMedia(request(), source(), { disposition: 'inline', head: true });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('10');
    expect(head.body).toBeNull();

    const missing = await proxyMedia(request(), resolveMediaSource('/api/files/content/nope.bin')!, {
      disposition: 'inline',
    });
    expect(missing.status).toBe(404);
  });

  it('lets ungated files opt into caching', async () => {
    const response = await proxyMedia(request(), source(), {
      disposition: 'inline',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});

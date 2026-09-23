import { createReadStream, type Stats } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

/**
 * Serves paywalled media through the app instead of handing clients the raw
 * storage URL, which is permanent, public, and shareable.
 *
 * A stored `fileUrl` is either a public Vercel Blob URL (proxied with a
 * server-side fetch that forwards Range requests) or a local-disk path written
 * by the dev uploaders (read from disk with Range support). Artists control
 * `fileUrl` and `format`, so:
 * - remote hosts are pinned to this deployment's own Blob store (derived from
 *   BLOB_READ_WRITE_TOKEN) plus MEDIA_PROXY_ALLOWED_HOSTS, never a shared
 *   suffix that any tenant can obtain, and never http;
 * - local paths are confined to the upload roots;
 * - the Content-Type is derived only from a safe audio/video/image table,
 *   never from a database MIME string or the upstream response, and anything
 *   else is served as an opaque attachment under a sandbox CSP so uploaded
 *   HTML/SVG can never execute on the app origin.
 */

/** Open-ended ranges are capped so one request never streams a whole file. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';
const OPAQUE_TYPE = 'application/octet-stream';

/**
 * Media types served inline. This table is the security boundary for what the
 * browser may interpret from the app origin, so it holds only audio, video and
 * raster image types (no SVG, HTML, PDF or office documents).
 */
const SAFE_MEDIA_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
};
const SAFE_MEDIA_TYPES = new Set(Object.values(SAFE_MEDIA_BY_EXT));

export type MediaSource = { kind: 'remote'; url: URL } | { kind: 'local'; filePath: string };

export interface ProxyOptions {
  /** Preferred Content-Type; only honoured if it is on the safe media list. */
  contentType?: string | null;
  disposition: 'inline' | { attachment: string };
  /** Answer a HEAD request: headers only, no body. */
  head?: boolean;
  /** Defaults to `private, no-store`; ungated files may opt into caching. */
  cacheControl?: string;
}

/** Enough of a request for the proxy: Range header and an optional abort signal. */
export interface ProxyRequest {
  headers: { get(name: string): string | null };
  signal?: AbortSignal;
}

function extensionOf(name: string): string {
  return path.extname(name.split('?')[0]).slice(1).toLowerCase();
}

/** Extension-derived type, or octet-stream for anything off the safe list. */
export function mimeFromExtension(fileName: string): string {
  return SAFE_MEDIA_BY_EXT[extensionOf(fileName)] ?? OPAQUE_TYPE;
}

/**
 * `content.format` is sometimes a MIME type and sometimes a bare extension.
 * Either is only trusted when it maps onto the safe list; otherwise the URL's
 * extension is consulted, and failing that the type is opaque.
 */
export function mimeFor(format: string | null | undefined, fileUrl: string): string {
  if (format) {
    const normalised = format.trim().toLowerCase();
    if (normalised.includes('/')) {
      if (SAFE_MEDIA_TYPES.has(normalised)) return normalised;
    } else {
      const byExt = SAFE_MEDIA_BY_EXT[normalised.replace(/^\./, '')];
      if (byExt) return byExt;
    }
  }
  return mimeFromExtension(fileUrl);
}

export function extensionFor(format: string | null | undefined, fileUrl: string): string {
  if (format) {
    const normalised = format.trim().toLowerCase();
    if (!normalised.includes('/')) {
      const bare = normalised.replace(/^\./, '');
      if (/^[a-z0-9]{1,8}$/.test(bare)) return bare;
    } else {
      const match = Object.entries(SAFE_MEDIA_BY_EXT).find(([, mime]) => mime === normalised);
      if (match) return match[0];
    }
  }
  const fromUrl = extensionOf(fileUrl);
  return /^[a-z0-9]{1,8}$/.test(fromUrl) ? fromUrl : 'bin';
}

function allowedRemoteHosts(): string[] {
  return (process.env.MEDIA_PROXY_ALLOWED_HOSTS ?? '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The Blob store this deployment writes to. Tokens look like
 * `vercel_blob_rw_<STORE_ID>_<secret>` and the store's public host is
 * `<store_id>.public.blob.vercel-storage.com`.
 */
export function ownBlobStoreHost(): string | null {
  const match = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN ?? '');
  return match ? `${match[1].toLowerCase()}${BLOB_HOST_SUFFIX}` : null;
}

/**
 * Only https on this deployment's own Blob store or an explicitly configured
 * host may be fetched. The shared Blob suffix is deliberately not enough: any
 * account can obtain a host under it.
 */
export function isAllowedRemoteHost(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  const own = ownBlobStoreHost();
  return (own !== null && host === own) || allowedRemoteHosts().includes(host);
}

function isLocalOrigin(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return false;
  try {
    return new URL(base).hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

function containedPath(root: string, rest: string): string | null {
  const resolved = path.resolve(root, rest);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.includes('\0') ? null : decoded;
  } catch {
    return null;
  }
}

/**
 * Maps a stored fileUrl onto something the proxy may serve, or null when it is
 * neither an allowlisted remote URL nor a path inside a local upload root.
 */
export function resolveMediaSource(fileUrl: string): MediaSource | null {
  if (!fileUrl) return null;

  let pathname = fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) {
    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      return null;
    }
    if (isAllowedRemoteHost(url)) return { kind: 'remote', url };
    if (!isLocalOrigin(url)) return null;
    pathname = url.pathname;
  }

  if (!pathname.startsWith('/')) return null;
  const decoded = safeDecode(pathname);
  if (!decoded) return null;

  // /api/upload writes <cwd>/uploads/content/<name>, served at /api/files/content/<name>.
  const apiFile = /^\/api\/files\/content\/([^/]+)$/.exec(decoded);
  if (apiFile) {
    const root = path.resolve(process.cwd(), 'uploads', 'content');
    const filePath = containedPath(root, path.basename(apiFile[1]));
    return filePath ? { kind: 'local', filePath } : null;
  }

  // LocalFileUploader and /api/upload/local write under STORAGE_DIR (default
  // public/uploads), addressed as /uploads/<rest>. Note that in `next dev` that
  // directory is also served statically, so in development the proxy only
  // adds playback, not protection; production builds don't serve files added
  // after build time.
  if (decoded.startsWith('/uploads/')) {
    const root = path.resolve(process.cwd(), process.env.STORAGE_DIR || 'public/uploads');
    const filePath = containedPath(root, decoded.slice('/uploads/'.length));
    return filePath ? { kind: 'local', filePath } : null;
  }

  return null;
}

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single-range header against a known size. Returns null when there
 * is no header, and 'unsatisfiable' for anything malformed or out of bounds.
 * Open-ended ranges are capped at MAX_CHUNK_BYTES.
 */
export function parseRange(
  header: string | null,
  size: number
): ByteRange | null | 'unsatisfiable' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return 'unsatisfiable';
  const [, first, last] = match;
  if (first === '' && last === '') return 'unsatisfiable';

  let start: number;
  let end: number;
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    end = last === '' ? Math.min(size - 1, start + MAX_CHUNK_BYTES - 1) : Math.min(Number(last), size - 1);
  }

  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

/** Rewrites `bytes=N-` to a bounded range before forwarding it upstream. */
export function capOpenEndedRange(header: string | null): string | null {
  if (!header) return null;
  const match = /^bytes=(\d+)-$/.exec(header.trim());
  if (!match) return header;
  const start = Number(match[1]);
  return `bytes=${start}-${start + MAX_CHUNK_BYTES - 1}`;
}

function contentDisposition(disposition: ProxyOptions['disposition']): string {
  if (disposition === 'inline') return 'inline';
  const ascii = disposition.attachment.replace(/[^A-Za-z0-9._-]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(disposition.attachment)}`;
}

/**
 * Response headers common to every proxied response. Types off the safe list
 * become opaque attachments, and the sandbox CSP means that even a direct
 * navigation to a proxied URL can never run script on the app origin.
 */
function baseHeaders(options: ProxyOptions, requestedType: string | null | undefined) {
  const contentType = requestedType && SAFE_MEDIA_TYPES.has(requestedType) ? requestedType : OPAQUE_TYPE;
  const disposition =
    contentType === OPAQUE_TYPE && options.disposition === 'inline'
      ? { attachment: 'download.bin' }
      : options.disposition;
  const headers: Record<string, string> = {
    'content-type': contentType,
    'cache-control': options.cacheControl ?? 'private, no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': 'sandbox',
    'accept-ranges': 'bytes',
    'content-disposition': contentDisposition(disposition),
  };
  return headers;
}

const PASS_THROUGH_STATUSES = new Set([200, 206, 304, 416]);

async function proxyRemote(
  request: ProxyRequest,
  source: Extract<MediaSource, { kind: 'remote' }>,
  options: ProxyOptions
): Promise<Response> {
  // Identity encoding keeps the upstream Content-Length truthful for the bytes
  // we stream (fetch would otherwise transparently decompress the body).
  const headers: Record<string, string> = { 'accept-encoding': 'identity' };
  const range = capOpenEndedRange(request.headers.get('range'));
  if (range) headers.range = range;

  // Never forward cookies or authorization: the upstream is a public store.
  const upstream = await fetch(source.url, {
    method: options.head ? 'HEAD' : 'GET',
    headers,
    cache: 'no-store',
    redirect: 'error',
    signal: request.signal,
  });

  if (!PASS_THROUGH_STATUSES.has(upstream.status)) {
    return new Response('Upstream media unavailable', { status: 502 });
  }

  // The upstream Content-Type is untrusted; only the caller's safe type is used.
  const out = baseHeaders(options, options.contentType);
  const encoded = Boolean(upstream.headers.get('content-encoding'));
  for (const name of ['content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  const length = upstream.headers.get('content-length');
  if (length && !encoded) out['content-length'] = length;

  const body = options.head || upstream.status === 304 ? null : upstream.body;
  return new Response(body, { status: upstream.status, headers: out });
}

async function proxyLocal(
  request: ProxyRequest,
  source: Extract<MediaSource, { kind: 'local' }>,
  options: ProxyOptions
): Promise<Response> {
  let info: Stats;
  try {
    info = await stat(source.filePath);
  } catch {
    return new Response('Content not found', { status: 404 });
  }
  if (!info.isFile()) return new Response('Content not found', { status: 404 });

  const size = info.size;
  const out = baseHeaders(options, options.contentType || mimeFromExtension(source.filePath));
  out['last-modified'] = info.mtime.toUTCString();
  out.etag = `W/"${size}-${Math.floor(info.mtimeMs)}"`;

  const range = parseRange(request.headers.get('range'), size);
  if (range === 'unsatisfiable') {
    out['content-range'] = `bytes */${size}`;
    return new Response(null, { status: 416, headers: out });
  }

  let status = 200;
  let start = 0;
  let end = size - 1;
  if (range) {
    status = 206;
    start = range.start;
    end = range.end;
    out['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  out['content-length'] = String(size === 0 ? 0 : end - start + 1);

  if (options.head || size === 0) return new Response(null, { status, headers: out });

  const body = Readable.toWeb(createReadStream(source.filePath, { start, end })) as unknown as ReadableStream;
  return new Response(body, { status, headers: out });
}

/** Streams the media behind `source` to the client, honouring Range requests. */
export function proxyMedia(
  request: ProxyRequest,
  source: MediaSource,
  options: ProxyOptions
): Promise<Response> {
  return source.kind === 'remote'
    ? proxyRemote(request, source, options)
    : proxyLocal(request, source, options);
}

import { createHash } from 'crypto';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { mimeFromExtension, ownBlobStoreHost } from '@/lib/media-proxy';
import { isSafeKey, toMediaPath, toStorageRef, type KeyArea } from './refs';
import type { ObjectStorage } from './types';

/**
 * One-off move of files from Vercel Blob (public) into the private S3 bucket.
 *
 * It is driven by the database, not by a Blob listing: every column that may
 * hold a Blob URL is scanned, each distinct URL is copied once per storage
 * area, and every row is repointed at S3. After a clean run nothing in the
 * database refers to Blob, so Blob can be switched off. Nothing is deleted
 * from Blob; switching it off is a separate, later step.
 *
 * The default is a dry run, which makes no network calls and writes nothing.
 */

export interface MigrationColumn {
  model: string;
  column: string;
  /** Storage area the copy goes into, which decides who may read it. */
  area: KeyArea;
  /**
   * What the row stores afterwards: an s3:// reference for media that only
   * access-checked routes serve, or an /api/media/ path for files the browser
   * loads directly.
   */
  store: 'ref' | 'path';
}

export const MIGRATION_COLUMNS: MigrationColumn[] = [
  { model: 'content', column: 'fileUrl', area: 'content', store: 'ref' },
  { model: 'content', column: 'thumbnailUrl', area: 'content', store: 'path' },
  { model: 'live_streams', column: 'recordingUrl', area: 'content', store: 'ref' },
  { model: 'stream_recordings', column: 'videoUrl', area: 'content', store: 'ref' },
  { model: 'stream_recordings', column: 'audioUrl', area: 'content', store: 'ref' },
  { model: 'live_streams', column: 'thumbnailUrl', area: 'public', store: 'path' },
  { model: 'stream_recordings', column: 'thumbnailUrl', area: 'public', store: 'path' },
  { model: 'challenge_submissions', column: 'contentUrl', area: 'public', store: 'path' },
  { model: 'challenge_submissions', column: 'thumbnailUrl', area: 'public', store: 'path' },
  { model: 'campaigns', column: 'bannerImage', area: 'public', store: 'path' },
  { model: 'playlists', column: 'coverImage', area: 'public', store: 'path' },
  { model: 'users', column: 'avatar', area: 'public', store: 'path' },
  { model: 'users', column: 'image', area: 'public', store: 'path' },
  { model: 'messages', column: 'attachmentUrl', area: 'private', store: 'path' },
];

/** The slice of a Prisma model delegate the migration uses. */
export interface MigrationModel {
  findMany(args: {
    where: Record<string, unknown>;
    select: Record<string, boolean>;
    orderBy: { id: 'asc' };
    take: number;
    cursor?: { id: string };
    skip?: number;
  }): Promise<Array<Record<string, unknown>>>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
}

export type MigrationDb = Record<string, MigrationModel | undefined>;

export interface MigrationOptions {
  db: MigrationDb;
  /** Required when applying; ignored in a dry run. */
  storage?: ObjectStorage | null;
  apply: boolean;
  /** Extra Blob hosts to accept besides this deployment's own store. */
  sourceHosts?: string[];
  fetchImpl?: typeof fetch;
  concurrency?: number;
  log?: (line: string) => void;
}

export interface PlannedFile {
  url: string;
  area: KeyArea;
  key: string;
  references: { model: string; column: string; store: 'ref' | 'path'; rows: number }[];
}

export interface MigrationReport {
  dryRun: boolean;
  bucket: string | null;
  files: PlannedFile[];
  skipped: { url: string; reason: string; model: string; column: string }[];
  copied: number;
  alreadyPresent: number;
  failed: { url: string; error: string }[];
  rowsRewritten: number;
}

const PAGE = 500;
const BLOB_SUFFIX = '.public.blob.vercel-storage.com';

function allowedSourceHosts(extra: string[] = []): Set<string> {
  const hosts = new Set(extra.map(host => host.trim().toLowerCase()).filter(Boolean));
  const own = ownBlobStoreHost();
  if (own) hosts.add(own);
  return hosts;
}

/** Why a value is not migrated, or null when it is a Blob URL we may copy. */
export function blobUrlProblem(value: string, hosts: Set<string>): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'not a URL';
  }
  if (url.protocol !== 'https:') return 'not https';
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(BLOB_SUFFIX)) return 'not a Vercel Blob URL';
  if (!hosts.has(host)) return 'Blob host is not this deployment’s store';
  return null;
}

/**
 * The S3 key for a Blob URL in a storage area. Content files keep their Blob
 * pathname when it is a content/<userId>/ key the app wrote (so ownership
 * checks still hold); everything else gets a stable hashed name under
 * <area>/migrated/, which no user owns.
 */
export function keyForBlobUrl(value: string, area: KeyArea = 'content'): string {
  const url = new URL(value);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    pathname = '';
  }
  if (area === 'content' && pathname.startsWith('content/') && isSafeKey(pathname)) return pathname;
  const ext = (pathname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? 'bin').toLowerCase();
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `${area}/migrated/${digest}.${ext}`;
}

async function scanColumn(
  model: MigrationModel,
  column: string
): Promise<Array<{ id: string; value: string }>> {
  const rows: Array<{ id: string; value: string }> = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await model.findMany({
      where: { [column]: { contains: 'blob.vercel-storage.com' } },
      select: { id: true, [column]: true },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of page) {
      const value = row[column];
      if (typeof value === 'string') rows.push({ id: String(row.id), value });
    }
    if (page.length < PAGE) break;
    cursor = String(page[page.length - 1].id);
  }
  return rows;
}

async function copyOne(
  file: PlannedFile,
  storage: ObjectStorage,
  fetchImpl: typeof fetch
): Promise<'copied' | 'present'> {
  const source = await fetchImpl(file.url, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    headers: { 'accept-encoding': 'identity' },
  });
  if (source.status !== 200 || !source.body) {
    throw new Error(`source answered HTTP ${source.status}`);
  }
  const length = Number(source.headers.get('content-length'));
  if (!Number.isFinite(length) || length < 0) throw new Error('source sent no Content-Length');

  const existing = await storage.headObject(file.key);
  if (existing && existing.size === length) {
    await source.body.cancel().catch(() => undefined);
    return 'present';
  }

  const body = Readable.fromWeb(source.body as unknown as WebReadableStream<Uint8Array>);
  await storage.putObject(file.key, body, { contentType: mimeFromExtension(file.key), contentLength: length });

  const stored = await storage.headObject(file.key);
  if (!stored || stored.size !== length) {
    throw new Error(`size check failed after copy (expected ${length}, got ${stored?.size ?? 'none'})`);
  }
  return 'copied';
}

export async function migrateBlobToS3(options: MigrationOptions): Promise<MigrationReport> {
  const log = options.log ?? (() => undefined);
  const hosts = allowedSourceHosts(options.sourceHosts);
  const storage = options.storage ?? null;
  if (options.apply && !storage) throw new Error('Applying needs S3 storage (AWS_S3_BUCKET_NAME and AWS_REGION)');

  const report: MigrationReport = {
    dryRun: !options.apply,
    bucket: storage?.bucket ?? null,
    files: [],
    skipped: [],
    copied: 0,
    alreadyPresent: 0,
    failed: [],
    rowsRewritten: 0,
  };

  // 1. Plan: every distinct Blob URL per storage area, and where it is referenced.
  const byUrl = new Map<string, PlannedFile>();
  for (const { model: modelName, column, area, store } of MIGRATION_COLUMNS) {
    const model = options.db[modelName];
    if (!model) {
      log(`skip ${modelName}.${column}: model not available`);
      continue;
    }
    const rows = await scanColumn(model, column);
    for (const row of rows) {
      const problem = blobUrlProblem(row.value, hosts);
      if (problem) {
        report.skipped.push({ url: row.value, reason: problem, model: modelName, column });
        continue;
      }
      const id = `${area} ${row.value}`;
      const file = byUrl.get(id) ?? { url: row.value, area, key: keyForBlobUrl(row.value, area), references: [] };
      const ref = file.references.find(r => r.model === modelName && r.column === column);
      if (ref) ref.rows += 1;
      else file.references.push({ model: modelName, column, store, rows: 1 });
      byUrl.set(id, file);
    }
    log(`scanned ${modelName}.${column}: ${rows.length} Blob reference(s)`);
  }
  report.files = [...byUrl.values()];

  if (!options.apply || !storage) {
    for (const file of report.files) {
      for (const ref of file.references) report.rowsRewritten += ref.rows;
    }
    return report;
  }

  // 2. Copy each file once, then rewrite the rows that reference it.
  const fetchImpl = options.fetchImpl ?? fetch;
  const queue = [...report.files];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        const outcome = await copyOne(file, storage, fetchImpl);
        if (outcome === 'copied') report.copied += 1;
        else report.alreadyPresent += 1;
      } catch (error) {
        report.failed.push({ url: file.url, error: (error as Error).message });
        log(`FAILED ${file.key}: ${(error as Error).message}`);
        continue;
      }

      for (const reference of file.references) {
        const value = reference.store === 'ref' ? toStorageRef(file.key, storage.bucket) : toMediaPath(file.key);
        const model = options.db[reference.model]!;
        const { count } = await model.updateMany({
          where: { [reference.column]: file.url },
          data: { [reference.column]: value },
        });
        report.rowsRewritten += count;
      }
      log(`ok ${file.key}`);
    }
  };
  const workers = Math.max(1, Math.min(options.concurrency ?? 4, 16));
  await Promise.all(Array.from({ length: workers }, worker));
  return report;
}

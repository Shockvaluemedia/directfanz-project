import { createHash } from 'crypto';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { mimeFromExtension, ownBlobStoreHost } from '@/lib/media-proxy';
import { isSafeKey, toStorageRef } from './refs';
import type { ObjectStorage } from './types';

/**
 * One-off move of files from Vercel Blob (public) into the private S3 bucket.
 *
 * It is driven by the database, not by a Blob listing: every column that may
 * hold a Blob URL is scanned, each distinct URL is copied once, and the
 * columns the app can serve from S3 are rewritten to the storage reference.
 * Nothing is deleted from Blob; switching Blob off is a separate, later step.
 *
 * The default is a dry run, which makes no network calls and writes nothing.
 */

export interface MigrationColumn {
  model: string;
  column: string;
  /**
   * True when the app serves this column from S3 references (through an
   * access-checked route). Other columns are copied but left pointing at Blob,
   * because the browser loads them directly and has no route for S3 yet.
   */
  rewrite: boolean;
}

export const MIGRATION_COLUMNS: MigrationColumn[] = [
  { model: 'content', column: 'fileUrl', rewrite: true },
  { model: 'content', column: 'thumbnailUrl', rewrite: true },
  { model: 'live_streams', column: 'recordingUrl', rewrite: true },
  { model: 'live_streams', column: 'thumbnailUrl', rewrite: false },
  { model: 'stream_recordings', column: 'videoUrl', rewrite: false },
  { model: 'stream_recordings', column: 'audioUrl', rewrite: false },
  { model: 'stream_recordings', column: 'thumbnailUrl', rewrite: false },
  { model: 'challenge_submissions', column: 'contentUrl', rewrite: false },
  { model: 'challenge_submissions', column: 'thumbnailUrl', rewrite: false },
  { model: 'messages', column: 'attachmentUrl', rewrite: false },
  { model: 'campaigns', column: 'bannerImage', rewrite: false },
  { model: 'playlists', column: 'coverImage', rewrite: false },
  { model: 'users', column: 'avatar', rewrite: false },
  { model: 'users', column: 'image', rewrite: false },
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
  key: string;
  references: { model: string; column: string; rewrite: boolean; rows: number }[];
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
  /** Copied but still pointing at Blob (no S3 route for that column yet). */
  rowsLeftOnBlob: number;
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
 * The S3 key for a Blob URL: the Blob pathname when it is a key the app could
 * have written (uploads keep their content/<userId>/ prefix, so ownership
 * checks still hold), otherwise a stable hashed name under migrated/.
 */
export function keyForBlobUrl(value: string): string {
  const url = new URL(value);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    pathname = '';
  }
  if (isSafeKey(pathname)) return pathname;
  const ext = (pathname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? 'bin').toLowerCase();
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `migrated/${digest}.${ext}`;
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
    rowsLeftOnBlob: 0,
  };

  // 1. Plan: every distinct Blob URL and where it is referenced.
  const byUrl = new Map<string, PlannedFile>();
  for (const { model: modelName, column, rewrite } of MIGRATION_COLUMNS) {
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
      const file = byUrl.get(row.value) ?? { url: row.value, key: keyForBlobUrl(row.value), references: [] };
      const ref = file.references.find(r => r.model === modelName && r.column === column);
      if (ref) ref.rows += 1;
      else file.references.push({ model: modelName, column, rewrite, rows: 1 });
      byUrl.set(row.value, file);
    }
    log(`scanned ${modelName}.${column}: ${rows.length} Blob reference(s)`);
  }
  report.files = [...byUrl.values()];

  if (!options.apply || !storage) {
    for (const file of report.files) {
      for (const ref of file.references) {
        if (ref.rewrite) report.rowsRewritten += ref.rows;
        else report.rowsLeftOnBlob += ref.rows;
      }
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

      const ref = toStorageRef(file.key, storage.bucket);
      for (const reference of file.references) {
        if (!reference.rewrite) {
          report.rowsLeftOnBlob += reference.rows;
          continue;
        }
        const model = options.db[reference.model]!;
        const { count } = await model.updateMany({
          where: { [reference.column]: file.url },
          data: { [reference.column]: ref },
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

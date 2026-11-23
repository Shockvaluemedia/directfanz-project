/**
 * @jest-environment node
 */
import { Readable } from 'stream';
import { MemoryObjectStorage } from '@/lib/storage';
import { blobUrlProblem, keyForBlobUrl, migrateBlobToS3, type MigrationDb } from '@/lib/storage/blob-migration';

const BUCKET = 'df-media-test';
const OWN = 'abc123.public.blob.vercel-storage.com';

/** A tiny in-memory stand-in for the Prisma delegates the migration touches. */
function fakeDb(tables: Record<string, Array<Record<string, unknown>>>): MigrationDb {
  const db: MigrationDb = {};
  for (const [name, rows] of Object.entries(tables)) {
    db[name] = {
      async findMany({ where, take, cursor }) {
        const [column, cond] = Object.entries(where)[0] as [string, { contains: string }];
        const sorted = rows
          .filter(r => typeof r[column] === 'string' && (r[column] as string).includes(cond.contains))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const start = cursor ? sorted.findIndex(r => r.id === cursor.id) + 1 : 0;
        return sorted.slice(start, start + take);
      },
      async updateMany({ where, data }) {
        const [column, value] = Object.entries(where)[0];
        let count = 0;
        for (const row of rows) {
          if (row[column] === value) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      },
    };
  }
  return db;
}

function fakeFetch(files: Record<string, string>) {
  return jest.fn(async (url: string | URL) => {
    const body = files[String(url)];
    // A minimal fetch response (jest's global Response is mocked in setup).
    if (body === undefined) return { status: 404, body: null, headers: new Headers() };
    return {
      status: 200,
      headers: new Headers({ 'content-length': String(Buffer.byteLength(body)) }),
      body: Readable.toWeb(Readable.from([Buffer.from(body)])),
    };
  }) as unknown as typeof fetch & jest.Mock;
}

describe('Blob to S3 migration', () => {
  const ownFile = `https://${OWN}/content/a1/audio/song.mp3`;
  const thumb = `https://${OWN}/thumbs/cover%20art.jpg`;
  const avatar = `https://${OWN}/avatars/u1.png`;
  const foreign = 'https://zzz999.public.blob.vercel-storage.com/content/a1/x.mp3';

  let tables: Record<string, Array<Record<string, unknown>>>;
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_abc123_notarealtoken';
    tables = {
      content: [
        { id: 'c1', fileUrl: ownFile, thumbnailUrl: thumb },
        { id: 'c2', fileUrl: ownFile, thumbnailUrl: null },
        { id: 'c3', fileUrl: foreign, thumbnailUrl: null },
      ],
      users: [{ id: 'u1', avatar, image: null }],
    };
  });
  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('only accepts this deployment’s own Blob store over https', () => {
    const hosts = new Set([OWN]);
    expect(blobUrlProblem(ownFile, hosts)).toBeNull();
    expect(blobUrlProblem(foreign, hosts)).toMatch(/not this deployment/);
    expect(blobUrlProblem(ownFile.replace('https', 'http'), hosts)).toBe('not https');
    expect(blobUrlProblem('https://evil.example/x.mp3', hosts)).toBe('not a Vercel Blob URL');
  });

  it('keeps safe Blob paths as keys and hashes the rest', () => {
    expect(keyForBlobUrl(ownFile)).toBe('content/a1/audio/song.mp3');
    expect(keyForBlobUrl(thumb)).toMatch(/^migrated\/[0-9a-f]{32}\.jpg$/);
  });

  it('dry run plans without fetching or writing', async () => {
    const fetchImpl = fakeFetch({});
    const report = await migrateBlobToS3({ db: fakeDb(tables), apply: false, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(report.dryRun).toBe(true);
    expect(report.files.map(f => f.url).sort()).toEqual([avatar, ownFile, thumb].sort());
    expect(report.rowsRewritten).toBe(3); // two fileUrl rows + one thumbnail
    expect(report.rowsLeftOnBlob).toBe(1); // the avatar
    expect(report.skipped).toEqual([expect.objectContaining({ url: foreign })]);
    expect(tables.content[0].fileUrl).toBe(ownFile);
  });

  it('copies each file once, rewrites only served columns, and is safe to rerun', async () => {
    const storage = new MemoryObjectStorage(BUCKET);
    const fetchImpl = fakeFetch({ [ownFile]: 'song-bytes', [thumb]: 'jpg', [avatar]: 'png' });

    const first = await migrateBlobToS3({ db: fakeDb(tables), storage, apply: true, fetchImpl });
    expect(first.failed).toEqual([]);
    expect(first.copied).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(tables.content[0].fileUrl).toBe(`s3://${BUCKET}/content/a1/audio/song.mp3`);
    expect(tables.content[1].fileUrl).toBe(`s3://${BUCKET}/content/a1/audio/song.mp3`);
    expect(String(tables.content[0].thumbnailUrl)).toMatch(new RegExp(`^s3://${BUCKET}/migrated/`));
    expect(tables.content[2].fileUrl).toBe(foreign);
    expect(tables.users[0].avatar).toBe(avatar);
    expect((await storage.headObject('content/a1/audio/song.mp3'))?.size).toBe(10);

    // Rerun: content rows already point at S3; the avatar is still on Blob and already copied.
    const second = await migrateBlobToS3({ db: fakeDb(tables), storage, apply: true, fetchImpl });
    expect(second.files.map(f => f.url)).toEqual([avatar]);
    expect(second.copied).toBe(0);
    expect(second.alreadyPresent).toBe(1);
  });

  it('records a failed copy and leaves its rows alone', async () => {
    const storage = new MemoryObjectStorage(BUCKET);
    const fetchImpl = fakeFetch({ [thumb]: 'jpg', [avatar]: 'png' });
    const report = await migrateBlobToS3({ db: fakeDb(tables), storage, apply: true, fetchImpl });
    expect(report.failed).toEqual([expect.objectContaining({ url: ownFile })]);
    expect(tables.content[0].fileUrl).toBe(ownFile);
  });

  it('refuses to apply without storage', async () => {
    await expect(migrateBlobToS3({ db: fakeDb(tables), apply: true })).rejects.toThrow(/needs S3 storage/);
  });
});

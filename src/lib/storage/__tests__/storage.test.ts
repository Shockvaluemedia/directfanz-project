/**
 * @jest-environment node
 */
import { S3Client } from '@aws-sdk/client-s3';
import {
  MemoryObjectStorage,
  asMediaPath,
  deleteStoredFile,
  keyFromMediaPath,
  toMediaPath,
  isKeyOwnedBy,
  isSafeKey,
  keyFromStorageRef,
  setObjectStorageForTests,
  storageOrigin,
  storageRefOwnershipError,
  toStorageRef,
} from '@/lib/storage';
import { S3ObjectStorage } from '@/lib/storage/s3-storage';
import { confirmDirectUpload, createDirectUpload, newUploadKey } from '@/lib/storage/uploads';
import { MULTIPART_PART_BYTES, MULTIPART_THRESHOLD_BYTES } from '@/lib/upload-policy';

const BUCKET = 'df-media-test';
const MB = 1024 * 1024;

describe('storage references', () => {
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
    process.env.AWS_REGION = 'us-east-1';
  });
  afterEach(() => {
    delete process.env.AWS_S3_BUCKET_NAME;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.AWS_REGION;
    delete process.env.S3_MEDIA_ENDPOINT;
  });

  it('round-trips keys and pins them to the configured bucket', () => {
    const ref = toStorageRef('content/u1/audio/a.mp3');
    expect(ref).toBe(`s3://${BUCKET}/content/u1/audio/a.mp3`);
    expect(keyFromStorageRef(ref)).toBe('content/u1/audio/a.mp3');
    expect(keyFromStorageRef('s3://someone-else/content/u1/audio/a.mp3')).toBeNull();
    expect(keyFromStorageRef('https://example.com/a.mp3')).toBeNull();
  });

  it('accepts S3_BUCKET_NAME as the same setting', () => {
    delete process.env.AWS_S3_BUCKET_NAME;
    process.env.S3_BUCKET_NAME = 'other-name';
    expect(keyFromStorageRef('s3://other-name/content/u1/x.mp3')).toBe('content/u1/x.mp3');
  });

  it('rejects keys with traversal or odd characters', () => {
    expect(isSafeKey('content/u1/a.mp3')).toBe(true);
    expect(isSafeKey('content/../u2/a.mp3')).toBe(false);
    expect(isSafeKey('/content/u1/a.mp3')).toBe(false);
    expect(isSafeKey('content//a.mp3')).toBe(false);
    expect(isSafeKey('content/u1/a b.mp3')).toBe(false);
    expect(keyFromStorageRef(`s3://${BUCKET}/content/../secret`)).toBeNull();
  });

  it('only lets artists reference their own uploads', () => {
    expect(isKeyOwnedBy('content/u1/audio/a.mp3', 'u1')).toBe(true);
    expect(isKeyOwnedBy('content/u10/audio/a.mp3', 'u1')).toBe(false);
    expect(storageRefOwnershipError(`s3://${BUCKET}/content/u1/a.mp3`, 'u1')).toBeNull();
    expect(storageRefOwnershipError(`s3://${BUCKET}/content/u2/a.mp3`, 'u1')).toMatch(/another account/);
    expect(storageRefOwnershipError('s3://elsewhere/content/u1/a.mp3', 'u1')).toMatch(/storage/);
    // Non-storage values are left to the route's existing validation.
    expect(storageRefOwnershipError('https://x.example/a.mp3', 'u1')).toBeNull();
    expect(storageRefOwnershipError(undefined, 'u1')).toBeNull();
  });

  it('turns keys into media paths and back, only for known areas', () => {
    expect(toMediaPath('public/u1/image/a.png')).toBe('/api/media/public/u1/image/a.png');
    expect(keyFromMediaPath('/api/media/private/u1/audio/a.mp3')).toBe('private/u1/audio/a.mp3');
    expect(keyFromMediaPath('/api/media/other/u1/a.mp3')).toBeNull();
    expect(keyFromMediaPath('/api/media/public/../x')).toBeNull();
    expect(asMediaPath(`s3://${BUCKET}/content/u1/image/t.jpg`)).toBe('/api/media/content/u1/image/t.jpg');
    expect(asMediaPath('https://x.example/t.jpg')).toBe('https://x.example/t.jpg');
  });

  it('checks ownership of media paths, except public ones', () => {
    expect(storageRefOwnershipError('/api/media/private/u2/audio/a.mp3', 'u1')).toMatch(/another account/);
    expect(storageRefOwnershipError('/api/media/content/u2/image/t.jpg', 'u1')).toMatch(/another account/);
    expect(storageRefOwnershipError('/api/media/private/u1/audio/a.mp3', 'u1')).toBeNull();
    expect(storageRefOwnershipError('/api/media/public/u2/image/a.png', 'u1')).toBeNull();
    expect(storageRefOwnershipError('/api/media/nowhere/u1/a.png', 'u1')).toMatch(/storage/);
  });

  it('derives the bucket origin for the CSP', () => {
    expect(storageOrigin()).toBe(`https://${BUCKET}.s3.us-east-1.amazonaws.com`);
    process.env.S3_MEDIA_ENDPOINT = 'http://localhost:9000';
    expect(storageOrigin()).toBe('http://localhost:9000');
  });
});

describe('direct uploads', () => {
  let storage: MemoryObjectStorage;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
    storage = new MemoryObjectStorage(BUCKET);
    setObjectStorageForTests(storage);
  });
  afterEach(() => {
    setObjectStorageForTests(undefined);
    delete process.env.AWS_S3_BUCKET_NAME;
  });

  it('gives small files one signed PUT under the artist prefix, extension from the type', async () => {
    const plan = await createDirectUpload({
      fileName: '../../evil.html',
      fileType: 'audio/mpeg',
      fileSize: 5 * MB,
      artistId: 'artist-1',
    });
    expect(plan.key).toMatch(/^content\/artist-1\/audio\/\d+-[0-9a-f-]{36}\.mp3$/);
    expect(plan.fileUrl).toBe(`s3://${BUCKET}/${plan.key}`);
    expect(plan.multipart).toBeUndefined();
    const url = new URL(plan.uploadUrl);
    expect(url.searchParams.get('contentType')).toBe('audio/mpeg');
    expect(url.searchParams.get('contentLength')).toBe(String(5 * MB));
  });

  it('splits large files into signed parts', async () => {
    const size = MULTIPART_THRESHOLD_BYTES + 3 * MB;
    const plan = await createDirectUpload({ fileName: 'v.mp4', fileType: 'video/mp4', fileSize: size, artistId: 'a1' });
    expect(plan.uploadUrl).toBe('');
    expect(plan.multipart?.partSize).toBe(MULTIPART_PART_BYTES);
    expect(plan.multipart?.parts).toHaveLength(Math.ceil(size / MULTIPART_PART_BYTES));
    expect(plan.multipart?.parts[0].partNumber).toBe(1);
  });

  it('refuses unsupported types and oversize files before signing anything', async () => {
    await expect(
      createDirectUpload({ fileName: 'x.html', fileType: 'text/html', fileSize: 10, artistId: 'a1' })
    ).rejects.toThrow(/Unsupported/);
    await expect(
      createDirectUpload({ fileName: 'x.jpg', fileType: 'image/jpeg', fileSize: 11 * MB, artistId: 'a1' })
    ).rejects.toThrow(/limit/);
  });

  it('confirms an uploaded object and returns its reference', async () => {
    const key = newUploadKey('a1', 'audio/mpeg');
    await storage.putObject(key, Buffer.alloc(1000), { contentType: 'audio/mpeg' });
    const confirmed = await confirmDirectUpload({ userId: 'a1', key, fileType: 'audio/mpeg', isArtist: true });
    expect(confirmed.fileUrl).toBe(`s3://${BUCKET}/${key}`);
    expect(confirmed.fileSize).toBe(1000);
  });

  it("refuses to confirm another artist's key", async () => {
    const key = newUploadKey('a2', 'audio/mpeg');
    await storage.putObject(key, Buffer.alloc(10), { contentType: 'audio/mpeg' });
    await expect(confirmDirectUpload({ userId: 'a1', key, fileType: 'audio/mpeg', isArtist: true })).rejects.toMatchObject({
      status: 403,
    });
    expect(await storage.headObject(key)).not.toBeNull();
  });

  it('deletes an object that is over the limit for its type', async () => {
    const key = newUploadKey('a1', 'image/jpeg');
    await storage.putObject(key, Buffer.alloc(11 * MB), { contentType: 'image/jpeg' });
    await expect(confirmDirectUpload({ userId: 'a1', key, fileType: 'image/jpeg', isArtist: true })).rejects.toThrow(/size limit/);
    expect(await storage.headObject(key)).toBeNull();
  });

  it('reports a missing object as 404', async () => {
    await expect(
      confirmDirectUpload({ userId: 'a1', key: newUploadKey('a1', 'audio/mpeg'), fileType: 'audio/mpeg', isArtist: true })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('completes a multipart upload from the parts the browser reports', async () => {
    const plan = await createDirectUpload({
      fileName: 'v.mp4',
      fileType: 'video/mp4',
      fileSize: MULTIPART_THRESHOLD_BYTES + 1,
      artistId: 'a1',
    });
    const uploadId = plan.multipart!.uploadId;
    const parts = plan.multipart!.parts.map(part => ({
      partNumber: part.partNumber,
      etag: storage.uploadPart(uploadId, part.partNumber, Buffer.alloc(part.partNumber === 1 ? 1000 : 10)),
    }));
    const confirmed = await confirmDirectUpload({
      userId: 'a1',
      key: plan.key,
      fileType: 'video/mp4',
      isArtist: true,
      multipart: { uploadId, parts },
    });
    expect(confirmed.fileSize).toBe(1000 + 10 * (parts.length - 1));
  });

  it('aborts a multipart upload with missing parts', async () => {
    const plan = await createDirectUpload({
      fileName: 'v.mp4',
      fileType: 'video/mp4',
      fileSize: MULTIPART_THRESHOLD_BYTES + 1,
      artistId: 'a1',
    });
    const uploadId = plan.multipart!.uploadId;
    await expect(
      confirmDirectUpload({
        userId: 'a1',
        key: plan.key,
        fileType: 'video/mp4',
        isArtist: true,
        multipart: { uploadId, parts: [{ partNumber: 2, etag: '"x"' }] },
      })
    ).rejects.toThrow(/incomplete/);
    expect(storage.multipart.has(uploadId)).toBe(false);
  });

  it('deletes stored files only inside the owner prefix', async () => {
    await storage.putObject('content/a1/x.mp3', Buffer.alloc(1), { contentType: 'audio/mpeg' });
    await storage.putObject('content/a2/y.mp3', Buffer.alloc(1), { contentType: 'audio/mpeg' });
    await deleteStoredFile(`s3://${BUCKET}/content/a2/y.mp3`, 'a1');
    await deleteStoredFile(`s3://${BUCKET}/content/a1/x.mp3`, 'a1');
    await deleteStoredFile('https://store.public.blob.vercel-storage.com/content/a1/x.mp3', 'a1');
    expect(await storage.headObject('content/a1/x.mp3')).toBeNull();
    expect(await storage.headObject('content/a2/y.mp3')).not.toBeNull();
  });

  it('stores avatars and other images as public media paths, for any signed-in user', async () => {
    const plan = await createDirectUpload({
      fileName: 'me.png',
      fileType: 'image/png',
      fileSize: 1000,
      artistId: 'fan-1',
      purpose: 'image',
    });
    expect(plan.key).toMatch(/^public\/fan-1\/image\//);
    expect(plan.fileUrl).toBe(`/api/media/${plan.key}`);
    await storage.putObject(plan.key, Buffer.alloc(1000), { contentType: 'image/png' });
    const confirmed = await confirmDirectUpload({ userId: 'fan-1', key: plan.key, fileType: 'image/png', isArtist: false });
    expect(confirmed.fileUrl).toBe(`/api/media/${plan.key}`);
  });

  it('keeps message attachments in the private area and limits their types', async () => {
    const plan = await createDirectUpload({
      fileName: 'a.mp3',
      fileType: 'audio/mpeg',
      fileSize: 10,
      artistId: 'fan-1',
      purpose: 'attachment',
    });
    expect(plan.key).toMatch(/^private\/fan-1\/audio\//);
    await expect(
      createDirectUpload({ fileName: 'v.mp4', fileType: 'video/mp4', fileSize: 10, artistId: 'fan-1', purpose: 'attachment' })
    ).rejects.toThrow(/does not accept/);
    await expect(
      createDirectUpload({ fileName: 'v.mp4', fileType: 'video/mp4', fileSize: 10, artistId: 'fan-1', purpose: 'image' })
    ).rejects.toThrow(/does not accept/);
  });

  it('only lets artists confirm paid content uploads', async () => {
    const key = newUploadKey('fan-1', 'audio/mpeg');
    await storage.putObject(key, Buffer.alloc(10), { contentType: 'audio/mpeg' });
    await expect(
      confirmDirectUpload({ userId: 'fan-1', key, fileType: 'audio/mpeg', isArtist: false })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reports storage as not configured when there is none', async () => {
    setObjectStorageForTests(null);
    await expect(
      createDirectUpload({ fileName: 'a.mp3', fileType: 'audio/mpeg', fileSize: 10, artistId: 'a1' })
    ).rejects.toThrow(/not configured/);
  });
});

describe('S3 adapter link signing (no network)', () => {
  const client = new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'test-secret' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const s3 = new S3ObjectStorage({ bucket: BUCKET, region: 'us-east-1' }, client);

  it('signs the content type and exact length into upload links, with no checksum', async () => {
    const url = new URL(
      await s3.presignPut('content/a1/x.mp3', { contentType: 'audio/mpeg', contentLength: 1234, expiresIn: 900 })
    );
    expect(url.host).toBe(`${BUCKET}.s3.us-east-1.amazonaws.com`);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect([...url.searchParams.keys()].some(k => k.toLowerCase().includes('checksum'))).toBe(false);
  });

  it('pins response type, disposition and cache control into download links', async () => {
    const url = new URL(
      await s3.presignGet('content/a1/x.mp3', {
        expiresIn: 300,
        contentType: 'audio/mpeg',
        contentDisposition: 'attachment; filename="x.mp3"',
        cacheControl: 'private, no-store',
      })
    );
    expect(url.searchParams.get('response-content-type')).toBe('audio/mpeg');
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="x.mp3"');
    expect(url.searchParams.get('response-cache-control')).toBe('private, no-store');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
  });

  it('builds its own client without static keys in the default case', () => {
    // Constructing must not need credentials; they come from the task role at call time.
    expect(() => new S3ObjectStorage({ bucket: BUCKET, region: 'us-east-1' })).not.toThrow();
  });
});

describe('client media URLs for S3-backed rows', () => {
  const { withClientMediaUrls } = require('@/lib/content-access');
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
  });
  afterEach(() => {
    delete process.env.AWS_S3_BUCKET_NAME;
  });

  it('never hands storage references to the browser', () => {
    const row = {
      id: 'c1',
      artistId: 'a1',
      visibility: 'PUBLIC',
      fileUrl: `s3://${BUCKET}/content/a1/audio/x.mp3`,
      thumbnailUrl: `s3://${BUCKET}/content/a1/image/t.jpg`,
    };
    const out = withClientMediaUrls(row, null);
    expect(out.fileUrl).toBe('/api/content/c1/stream');
    expect(out.thumbnailUrl).toBe('/api/content/c1/thumbnail');
    expect(JSON.stringify(out)).not.toContain('s3://');
  });
});

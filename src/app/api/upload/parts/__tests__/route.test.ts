/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { MemoryObjectStorage, setObjectStorageForTests } from '@/lib/storage';
import { createDirectUpload } from '@/lib/storage/uploads';
import { MULTIPART_THRESHOLD_BYTES } from '@/lib/upload-policy';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { POST } = require('@/app/api/upload/parts/route');

const BUCKET = 'df-media-test';

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/upload/parts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload/parts', () => {
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
    setObjectStorageForTests(new MemoryObjectStorage(BUCKET));
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'artist-1', role: 'ARTIST' } });
  });
  afterEach(() => {
    setObjectStorageForTests(undefined);
    delete process.env.AWS_S3_BUCKET_NAME;
  });

  async function openUpload() {
    return createDirectUpload({
      fileName: 'film.mp4',
      fileType: 'video/mp4',
      fileSize: MULTIPART_THRESHOLD_BYTES * 2,
      artistId: 'artist-1',
    });
  }

  it('returns fresh links for the parts asked for', async () => {
    const plan = await openUpload();
    const response = await POST(
      request({ key: plan.key, fileType: 'video/mp4', uploadId: plan.multipart!.uploadId, partNumbers: [3, 4] })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.parts.map((p: any) => p.partNumber)).toEqual([3, 4]);
  });

  it('needs a signed-in user', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await POST(request({ key: 'k', fileType: 'video/mp4', uploadId: 'u', partNumbers: [1] }));
    expect(response.status).toBe(401);
  });

  it("refuses another account's upload", async () => {
    const plan = await openUpload();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'artist-2', role: 'ARTIST' } });
    const response = await POST(
      request({ key: plan.key, fileType: 'video/mp4', uploadId: plan.multipart!.uploadId, partNumbers: [1] })
    );
    expect(response.status).toBe(403);
  });

  it('rejects malformed requests and too many parts at once', async () => {
    expect((await POST(request({ key: 'k' }))).status).toBe(400);
    const plan = await openUpload();
    const many = Array.from({ length: 51 }, (_, i) => i + 1);
    const response = await POST(
      request({ key: plan.key, fileType: 'video/mp4', uploadId: plan.multipart!.uploadId, partNumbers: many })
    );
    expect(response.status).toBe(400);
  });
});

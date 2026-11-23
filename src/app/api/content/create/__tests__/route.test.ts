/**
 * @jest-environment node
 *
 * POST /api/content/create: video releases keep their kind (short,
 * documentary, film...), whole-second runtime and poster, and tags are stored
 * as the JSON array every reader parses.
 */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn(), apiError: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { POST } = require('@/app/api/content/create/route');

const BUCKET = 'df-media-test';

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/content/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const video = {
  title: 'The Making of Nahvee',
  type: 'VIDEO',
  fileUrl: `s3://${BUCKET}/content/artist-1/video/1-abc.mp4`,
  thumbnailUrl: `s3://${BUCKET}/content/artist-1/image/1-poster.jpg`,
  fileSize: 1_500_000_000,
  duration: 3725.4,
  format: 'video/mp4',
  tags: 'doc, behind the music',
  kind: 'DOCUMENTARY',
};

describe('POST /api/content/create', () => {
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'artist-1', role: 'ARTIST' } });
    (prisma.content.create as jest.Mock).mockReset().mockImplementation(async ({ data }: any) => data);
  });
  afterEach(() => {
    delete process.env.AWS_S3_BUCKET_NAME;
  });

  it('saves a documentary with its kind, whole-second runtime and poster', async () => {
    const response = await POST(request(video));
    expect(response.status).toBe(200);
    const data = (prisma.content.create as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBe('VIDEO');
    expect(data.duration).toBe(3725);
    expect(JSON.parse(data.metadata)).toEqual({ kind: 'DOCUMENTARY' });
    expect(data.thumbnailUrl).toBe('/api/media/content/artist-1/image/1-poster.jpg');
    expect(JSON.parse(data.tags)).toEqual(['doc', 'behind the music']);
    const body = await response.json();
    expect(body.data.kind).toBe('DOCUMENTARY');
  });

  it('refuses a kind that does not fit the file type', async () => {
    const response = await POST(request({ ...video, kind: 'SINGLE' }));
    expect(response.status).toBe(400);
    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('stores an empty tag list as [] so the content page can be read', async () => {
    await POST(request({ ...video, tags: '', kind: undefined }));
    const data = (prisma.content.create as jest.Mock).mock.calls[0][0].data;
    expect(data.tags).toBe('[]');
    expect(data.metadata).toBeNull();
  });

  it("refuses another artist's poster", async () => {
    const response = await POST(
      request({ ...video, thumbnailUrl: `s3://${BUCKET}/content/artist-2/image/1-poster.jpg` })
    );
    expect(response.status).toBe(400);
  });
});

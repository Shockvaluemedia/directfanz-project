/**
 * /api/media/<key> is how the browser loads avatars, covers, thumbnails and
 * message attachments from the private bucket. Access depends on the key's
 * area: public is open, a content thumbnail follows its row's rules, and a
 * private attachment is only for its uploader and that conversation.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MemoryObjectStorage, setObjectStorageForTests } from '@/lib/storage';

jest.mock('@/lib/content-access', () => ({ checkContentAccess: jest.fn(), verifyAccessToken: jest.fn() }));

const { getServerSession } = require('next-auth');
const { checkContentAccess } = require('@/lib/content-access');
const { GET } = require('@/app/api/media/[...key]/route');

const BUCKET = 'df-media-test';
const call = (key: string) =>
  GET(new NextRequest(`http://localhost:3000/api/media/${key}`), {
    params: Promise.resolve({ key: key.split('/') }),
  });

describe('/api/media/[...key]', () => {
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = BUCKET;
    setObjectStorageForTests(new MemoryObjectStorage(BUCKET));
    (getServerSession as jest.Mock).mockReset();
    (checkContentAccess as jest.Mock).mockReset();
    (prisma.content.findFirst as jest.Mock).mockReset();
    (prisma.messages.findFirst as jest.Mock).mockReset();
  });
  afterEach(() => {
    setObjectStorageForTests(undefined);
    delete process.env.AWS_S3_BUCKET_NAME;
  });

  it('redirects anyone to a signed link for a public image', async () => {
    const res = await call('public/u1/image/a.png');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe(`/${BUCKET}/public/u1/image/a.png`);
    expect(location.searchParams.get('contentType')).toBe('image/png');
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it('refuses unknown areas and unsafe keys', async () => {
    expect((await call('other/u1/a.png')).status).toBe(404);
    expect((await call('public/../private/u2/a.png')).status).toBe(404);
  });

  it('serves a content thumbnail only when a row uses it, with that row’s rules', async () => {
    (prisma.content.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect((await call('content/a1/audio/song.mp3')).status).toBe(404);

    // Cover art for gated audio is marketing: open.
    (prisma.content.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'c1', type: 'AUDIO', visibility: 'SUBSCRIBERS_ONLY' });
    expect((await call('content/a1/image/cover.jpg')).status).toBe(302);
    expect(prisma.content.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { thumbnailUrl: '/api/media/content/a1/image/cover.jpg' } })
    );

    // A gated image's thumbnail needs content access.
    (prisma.content.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'c2', type: 'IMAGE', visibility: 'SUBSCRIBERS_ONLY' });
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
    (checkContentAccess as jest.Mock).mockResolvedValueOnce({ hasAccess: false, reason: 'no_subscription' });
    const denied = await call('content/a1/image/t.jpg');
    expect(denied.status).toBe(403);
    expect(checkContentAccess).toHaveBeenCalledWith('fan-1', 'c2');
  });

  it('serves a private attachment to its uploader and to people in the conversation only', async () => {
    expect((await call('private/u1/audio/a.mp3')).status).toBe(401);

    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    expect((await call('private/u1/audio/a.mp3')).status).toBe(302);
    expect(prisma.messages.findFirst).not.toHaveBeenCalled();

    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u2' } });
    (prisma.messages.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'm1' });
    const shared = await call('private/u1/audio/a.mp3');
    expect(shared.status).toBe(302);
    expect(shared.headers.get('cache-control')).toBe('private, no-store');
    expect(prisma.messages.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { attachmentUrl: '/api/media/private/u1/audio/a.mp3', OR: [{ senderId: 'u2' }, { recipientId: 'u2' }] },
      })
    );

    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u3' } });
    (prisma.messages.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect((await call('private/u1/audio/a.mp3')).status).toBe(404);
  });
});

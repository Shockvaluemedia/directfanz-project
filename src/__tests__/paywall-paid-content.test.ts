/**
 * The paywall must cover every kind of paid content: drop files (bought at full
 * price or in a members' presale), membership content, and listening-party
 * recordings. Each is served only through an app route that checks access on
 * every request, and no response hands out a raw storage URL or stream key.
 *
 * Unlike the per-route tests, this runs the real access rules
 * (checkContentAccess, canViewStream) against mocked database rows.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), securityEvent: jest.fn() },
  generateRequestId: jest.fn(() => 'req-test'),
}));

const { getServerSession } = require('next-auth');
const streamContent = require('@/app/api/content/[id]/stream/route');
const recording = require('@/app/api/livestream/[streamId]/recording/route');
const streamingList = require('@/app/api/streaming/route');
const streamingDetail = require('@/app/api/streaming/[streamId]/route');

const OWN_TOKEN = 'vercel_blob_rw_StoreAbc123_0123456789abcdef';
const BLOB = 'https://storeabc123.public.blob.vercel-storage.com';
const db = prisma as any;

const signedInAs = (id: string | null) =>
  (getServerSession as jest.Mock).mockResolvedValue(id ? { user: { id } } : null);

const okBytes = () =>
  new Response('bytes', { status: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': '5' } });

describe('paywall on paid content', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = OWN_TOKEN;
    fetchMock = jest.fn().mockImplementation(async () => okBytes());
    global.fetch = fetchMock as any;
    (getServerSession as jest.Mock).mockReset();
    db.content.findUnique.mockReset();
    db.purchases.findFirst.mockReset().mockResolvedValue(null);
    db.subscriptions.findFirst.mockReset().mockResolvedValue(null);
    db.live_streams.findUnique.mockReset();
    db.live_streams.findMany.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  describe('drop files', () => {
    const fileUrl = `${BLOB}/content/artist-1/audio/single.mp3`;
    // checkContentAccess loads the row with its drops and tiers; the stream
    // route then loads the file fields. One row serves both lookups.
    const dropTrack = {
      id: 'track-1',
      artistId: 'artist-1',
      visibility: 'PRIVATE',
      fileUrl,
      format: 'audio/mpeg',
      type: 'AUDIO',
      title: 'Single',
      users: { id: 'artist-1', displayName: 'Nahvee' },
      drop_content: [{ dropId: 'drop-1' }],
      tiers: [],
    };

    const play = () =>
      streamContent.GET(new NextRequest('http://localhost:3000/api/content/track-1/stream'), {
        params: Promise.resolve({ id: 'track-1' }),
      });

    it('plays for a fan with a paid purchase of the drop (full price or presale)', async () => {
      signedInAs('fan-1');
      db.content.findUnique.mockResolvedValue(dropTrack);
      db.purchases.findFirst.mockResolvedValue({ id: 'purchase-1' });

      const response = await play();

      expect(response.status).toBe(200);
      expect(db.purchases.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fanId: 'fan-1', itemType: 'DROP', status: 'PAID' }),
        })
      );
      // Bytes come through the app; the storage URL never reaches the browser.
      expect(response.headers.get('location')).toBeFalsy();
      expect(fetchMock).toHaveBeenCalledWith(new URL(fileUrl), expect.anything());
    });

    it('refuses a signed-in fan who has not bought it', async () => {
      signedInAs('fan-2');
      db.content.findUnique.mockResolvedValue(dropTrack);

      expect((await play()).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a shared link opened while signed out', async () => {
      signedInAs(null);
      db.content.findUnique.mockResolvedValue(dropTrack);

      expect((await play()).status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('membership content', () => {
    const memberPost = (subscriptions: unknown[]) => ({
      id: 'post-1',
      artistId: 'artist-1',
      visibility: 'TIER_LOCKED',
      fileUrl: `${BLOB}/content/artist-1/video/bts.mp4`,
      format: 'video/mp4',
      type: 'VIDEO',
      title: 'Behind the scenes',
      users: { id: 'artist-1', displayName: 'Nahvee' },
      drop_content: [],
      tiers: [{ id: 'tier-1', name: 'Members', minimumPrice: 3, isActive: true, subscriptions }],
    });

    const play = () =>
      streamContent.GET(new NextRequest('http://localhost:3000/api/content/post-1/stream'), {
        params: Promise.resolve({ id: 'post-1' }),
      });

    it('plays for an active member', async () => {
      signedInAs('fan-1');
      db.content.findUnique.mockResolvedValue(
        memberPost([{ id: 'sub-1', tierId: 'tier-1', amount: 3, status: 'ACTIVE' }])
      );
      expect((await play()).status).toBe(200);
    });

    it('refuses a fan without a membership', async () => {
      signedInAs('fan-2');
      db.content.findUnique.mockResolvedValue(memberPost([]));
      expect((await play()).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('listening-party recordings', () => {
    const party = {
      id: 'party-1',
      artistId: 'artist-1',
      isPublic: true, // ticketed parties stay gated even when listed publicly
      tierIds: '[]',
      requiresPayment: true,
      paymentAmount: 5,
      streamKey: 'secret-stream-key',
      recordingUrl: `${BLOB}/recordings/party-1.mp4`,
      status: 'ENDED',
    };

    const watch = () =>
      recording.GET(new NextRequest('http://localhost:3000/api/livestream/party-1/recording'), {
        params: Promise.resolve({ streamId: 'party-1' }),
      });

    it('plays the recording for a ticket holder, through the app', async () => {
      signedInAs('fan-1');
      db.live_streams.findUnique.mockResolvedValue(party);
      db.purchases.findFirst.mockResolvedValue({ id: 'ticket-1' });

      const response = await watch();

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(new URL(party.recordingUrl), expect.anything());
      expect(response.headers.get('cache-control')).toContain('no-store');
    });

    it('refuses a fan without a ticket, and anyone signed out', async () => {
      db.live_streams.findUnique.mockResolvedValue(party);

      signedInAs('fan-2');
      expect((await watch()).status).toBe(403);
      signedInAs(null);
      expect((await watch()).status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 404 when there is no recording', async () => {
      signedInAs('artist-1');
      db.live_streams.findUnique.mockResolvedValue({ ...party, recordingUrl: null });
      expect((await watch()).status).toBe(404);
    });

    it('never lists a stream key or raw recording URL in the open stream list', async () => {
      db.live_streams.findMany.mockResolvedValue([
        { ...party, users: { id: 'artist-1' }, _count: { stream_viewers: 0, stream_chat_messages: 0 } },
      ]);

      const response = await streamingList.GET(new NextRequest('http://localhost:3000/api/streaming'));
      const body = await response.json();

      expect(body.streams[0].streamKey).toBeUndefined();
      expect(body.streams[0].recordingUrl).toBe('/api/livestream/party-1/recording');
    });

    it('keeps stream details from fans without a ticket, and secrets from fans with one', async () => {
      const detailRow = {
        ...party,
        users: { id: 'artist-1' },
        stream_viewers: [],
        stream_chat_messages: [],
        _count: { stream_viewers: 0, stream_chat_messages: 0, stream_tips: 0 },
      };
      db.live_streams.findUnique.mockResolvedValue(detailRow);
      const open = () =>
        streamingDetail.GET(new NextRequest('http://localhost:3000/api/streaming/party-1'), {
          params: Promise.resolve({ streamId: 'party-1' }),
        });

      signedInAs('fan-2');
      expect((await open()).status).toBe(403);

      signedInAs('fan-1');
      db.purchases.findFirst.mockResolvedValue({ id: 'ticket-1' });
      const body = await (await open()).json();
      expect(body.streamKey).toBeUndefined();
      expect(body.recordingUrl).toBe('/api/livestream/party-1/recording');
    });
  });
});

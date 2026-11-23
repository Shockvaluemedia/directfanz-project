jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
      status: init.status ?? 200,
      headers: init.headers ?? {},
      json: async () => data,
    }),
  },
  NextRequest: class {},
}));

jest.mock('@/lib/ivs', () => {
  const actual = jest.requireActual('@/lib/ivs');
  return {
    ...actual,
    isIvsEnabled: jest.fn(),
    createPlaybackToken: jest.fn(),
    getBroadcastDetails: jest.fn(),
  };
});

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { createPlaybackToken, getBroadcastDetails, isIvsEnabled, IvsNotConfiguredError } from '@/lib/ivs';
import { GET as playback } from '../[streamId]/playback/route';
import { POST as broadcast } from '../[streamId]/broadcast/route';

const db = prisma as any;
const session = getServerSession as jest.Mock;
const params = (streamId = 'stream_1') => ({ params: Promise.resolve({ streamId }) });

const party = {
  id: 'stream_1',
  artistId: 'artist_1',
  isPublic: true,
  tierIds: '[]',
  requiresPayment: true,
  paymentAmount: { toString: () => '8' },
  status: 'LIVE',
  ivsChannelArn: 'arn:aws:ivs:us-east-1:1:channel/abc',
  ivsPlaybackUrl: 'https://abc.playback.live-video.net/x.m3u8',
};

beforeEach(() => {
  jest.clearAllMocks();
  (isIvsEnabled as jest.Mock).mockReturnValue(true);
  (createPlaybackToken as jest.Mock).mockReturnValue({
    token: 'tok',
    expiresAt: new Date('2026-12-05T20:10:00Z'),
  });
  db.purchases.findFirst.mockResolvedValue(null);
  db.subscriptions.findFirst.mockResolvedValue(null);
});

describe('GET /api/livestream/:id/playback', () => {
  it('gives a ticket holder a signed playback URL that is never cached', async () => {
    session.mockResolvedValue({ user: { id: 'fan_1' } });
    db.live_streams.findUnique.mockResolvedValue(party);
    db.purchases.findFirst.mockResolvedValue({ id: 'pur_1' });

    const response: any = await playback({} as any, params());
    expect(response.status).toBe(200);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect((await response.json()).data).toEqual({
      status: 'LIVE',
      playbackUrl: 'https://abc.playback.live-video.net/x.m3u8?token=tok',
      expiresAt: '2026-12-05T20:10:00.000Z',
    });
    expect(createPlaybackToken).toHaveBeenCalledWith(party.ivsChannelArn);
  });

  it('gives a fan without a ticket nothing to play', async () => {
    session.mockResolvedValue({ user: { id: 'fan_2' } });
    db.live_streams.findUnique.mockResolvedValue(party);

    const response: any = await playback({} as any, params());
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty('data');
    expect(createPlaybackToken).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in', async () => {
    session.mockResolvedValue(null);
    db.live_streams.findUnique.mockResolvedValue(party);

    const response: any = await playback({} as any, params());
    expect(response.status).toBe(401);
    expect(createPlaybackToken).not.toHaveBeenCalled();
  });

  it('says there is nothing to play yet before the channel exists', async () => {
    session.mockResolvedValue({ user: { id: 'artist_1' } });
    db.live_streams.findUnique.mockResolvedValue({ ...party, ivsChannelArn: null, ivsPlaybackUrl: null });

    const response: any = await playback({} as any, params());
    expect((await response.json()).data).toEqual({ status: 'LIVE', playbackUrl: null });
  });

  it('issues no token once the party is over', async () => {
    session.mockResolvedValue({ user: { id: 'artist_1' } });
    db.live_streams.findUnique.mockResolvedValue({ ...party, status: 'ENDED' });

    const response: any = await playback({} as any, params());
    expect((await response.json()).data.playbackUrl).toBeNull();
    expect(createPlaybackToken).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown party', async () => {
    db.live_streams.findUnique.mockResolvedValue(null);
    const response: any = await playback({} as any, params('nope'));
    expect(response.status).toBe(404);
  });
});

describe('POST /api/livestream/:id/broadcast', () => {
  const details = {
    ingestEndpoint: 'abc.global-contribute.live-video.net',
    ingestServer: 'rtmps://abc.global-contribute.live-video.net:443/app/',
    streamKey: 'sk_secret',
  };

  it('gives the artist the ingest details and stream key', async () => {
    session.mockResolvedValue({ user: { id: 'artist_1' } });
    db.live_streams.findUnique.mockResolvedValue(party);
    (getBroadcastDetails as jest.Mock).mockResolvedValue(details);

    const response: any = await broadcast({} as any, params());
    expect(response.status).toBe(200);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect((await response.json()).data).toEqual(details);
  });

  it('hides the party from anyone but its artist', async () => {
    session.mockResolvedValue({ user: { id: 'fan_1' } });
    db.live_streams.findUnique.mockResolvedValue(party);

    const response: any = await broadcast({} as any, params());
    expect(response.status).toBe(404);
    expect(getBroadcastDetails).not.toHaveBeenCalled();
  });

  it('needs a signed-in user', async () => {
    session.mockResolvedValue(null);
    const response: any = await broadcast({} as any, params());
    expect(response.status).toBe(401);
  });

  it('says so when IVS is not set up yet', async () => {
    session.mockResolvedValue({ user: { id: 'artist_1' } });
    db.live_streams.findUnique.mockResolvedValue(party);
    (getBroadcastDetails as jest.Mock).mockRejectedValue(new IvsNotConfiguredError());

    const response: any = await broadcast({} as any, params());
    expect(response.status).toBe(503);
  });

  it('refuses a party that is over', async () => {
    session.mockResolvedValue({ user: { id: 'artist_1' } });
    db.live_streams.findUnique.mockResolvedValue({ ...party, status: 'ENDED' });

    const response: any = await broadcast({} as any, params());
    expect(response.status).toBe(409);
    expect(getBroadcastDetails).not.toHaveBeenCalled();
  });
});

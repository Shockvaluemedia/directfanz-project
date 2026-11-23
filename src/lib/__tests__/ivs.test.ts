const send = jest.fn();

jest.mock('@aws-sdk/client-ivs', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    IvsClient: jest.fn().mockImplementation(() => ({ send })),
    CreateChannelCommand: class CreateChannelCommand extends Command {},
    DeleteChannelCommand: class DeleteChannelCommand extends Command {},
    GetStreamKeyCommand: class GetStreamKeyCommand extends Command {},
  };
});

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import {
  applyIvsStreamEvent,
  channelNameFor,
  createPlaybackToken,
  ensurePartyChannel,
  getBroadcastDetails,
  hideIvsFields,
  IvsNotConfiguredError,
  isIvsEnabled,
  playbackOrigin,
  resetIvsClientForTests,
  signedPlaybackUrl,
} from '@/lib/ivs';

const db = prisma as any;
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'secp384r1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CHANNEL_ARN = 'arn:aws:ivs:us-east-1:111111111111:channel/abcDEF';
const KEY_ARN = 'arn:aws:ivs:us-east-1:111111111111:stream-key/xyz';
const createdChannel = {
  channel: {
    arn: CHANNEL_ARN,
    ingestEndpoint: 'abc.global-contribute.live-video.net',
    playbackUrl: 'https://abc.us-east-1.playback.live-video.net/api/video/v1/x.m3u8',
  },
  streamKey: { arn: KEY_ARN, value: 'sk_secret' },
};
const emptyRow = {
  id: 'stream_1',
  ivsChannelArn: null,
  ivsIngestEndpoint: null,
  ivsPlaybackUrl: null,
  ivsStreamKeyArn: null,
};
const savedRow = {
  id: 'stream_1',
  ivsChannelArn: CHANNEL_ARN,
  ivsIngestEndpoint: createdChannel.channel.ingestEndpoint,
  ivsPlaybackUrl: createdChannel.channel.playbackUrl,
  ivsStreamKeyArn: KEY_ARN,
};

const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  resetIvsClientForTests();
  process.env.IVS_PLAYBACK_PRIVATE_KEY = privateKey;
  delete process.env.IVS_CHANNEL_TYPE;
  process.env.NEXTAUTH_URL = 'https://directfanz.io';
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterAll(() => {
  process.env = savedEnv;
});

describe('settings', () => {
  it('is off without a playback key', () => {
    expect(isIvsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isIvsEnabled({ IVS_PLAYBACK_PRIVATE_KEY: 'pem' } as any)).toBe(true);
  });

  it('binds tokens to the site origin', () => {
    expect(playbackOrigin({ NEXTAUTH_URL: 'https://directfanz.io/path' } as any)).toBe(
      'https://directfanz.io'
    );
    expect(playbackOrigin({} as any)).toBe('*');
  });

  it('makes a valid IVS channel name', () => {
    expect(channelNameFor('ab:c/1')).toBe('directfanz-party-ab-c-1');
  });
});

describe('ensurePartyChannel', () => {
  it('creates a private low-latency channel and saves it on the party', async () => {
    send.mockResolvedValueOnce(createdChannel);
    db.live_streams.updateMany.mockResolvedValue({ count: 1 });

    await expect(ensurePartyChannel(emptyRow)).resolves.toEqual(savedRow);

    const command = send.mock.calls[0][0];
    expect(command.constructor.name).toBe('CreateChannelCommand');
    expect(command.input).toMatchObject({
      name: 'directfanz-party-stream_1',
      type: 'BASIC',
      latencyMode: 'LOW',
      authorized: true,
    });
    const saved = db.live_streams.updateMany.mock.calls[0][0];
    expect(saved.where).toEqual({ id: 'stream_1', ivsChannelArn: null });
    expect(saved.data).not.toHaveProperty('streamKey');
    expect(JSON.stringify(saved.data)).not.toContain('sk_secret');
  });

  it('reuses a channel the party already has', async () => {
    await expect(ensurePartyChannel(savedRow)).resolves.toBe(savedRow);
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes its own channel when another request saved one first', async () => {
    send.mockResolvedValueOnce(createdChannel).mockResolvedValueOnce({});
    db.live_streams.updateMany.mockResolvedValue({ count: 0 });
    const winner = { ...savedRow, ivsChannelArn: 'arn:aws:ivs:us-east-1:1:channel/winner' };
    db.live_streams.findUnique.mockResolvedValue(winner);

    await expect(ensurePartyChannel(emptyRow)).resolves.toEqual(winner);
    expect(send.mock.calls[1][0].constructor.name).toBe('DeleteChannelCommand');
    expect(send.mock.calls[1][0].input).toEqual({ arn: CHANNEL_ARN });
  });

  it('refuses when IVS is not configured', async () => {
    delete process.env.IVS_PLAYBACK_PRIVATE_KEY;
    await expect(ensurePartyChannel(emptyRow)).rejects.toBeInstanceOf(IvsNotConfiguredError);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('getBroadcastDetails', () => {
  it('reads the stream key from IVS for the artist', async () => {
    send.mockResolvedValueOnce({ streamKey: { arn: KEY_ARN, value: 'sk_secret' } });

    await expect(getBroadcastDetails(savedRow)).resolves.toEqual({
      ingestEndpoint: 'abc.global-contribute.live-video.net',
      ingestServer: 'rtmps://abc.global-contribute.live-video.net:443/app/',
      streamKey: 'sk_secret',
    });
    expect(send.mock.calls[0][0].input).toEqual({ arn: KEY_ARN });
  });
});

describe('playback tokens', () => {
  const now = new Date('2026-12-05T20:00:00Z');

  it('signs an ES384 token for one channel that IVS can verify', () => {
    const { token, expiresAt } = createPlaybackToken(CHANNEL_ARN, { now });

    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('ES384');
    const claims = jwt.verify(token, publicKey, { algorithms: ['ES384'], clockTimestamp: now.getTime() / 1000 }) as any;
    expect(claims['aws:channel-arn']).toBe(CHANNEL_ARN);
    expect(claims['aws:access-control-allow-origin']).toBe('https://directfanz.io');
    expect(claims.exp).toBe(now.getTime() / 1000 + 600);
    expect(expiresAt.toISOString()).toBe('2026-12-05T20:10:00.000Z');
  });

  it('accepts a key stored with escaped newlines', () => {
    const escaped = privateKey.replace(/\n/g, '\\n');
    const { token } = createPlaybackToken(CHANNEL_ARN, { now, privateKey: escaped });
    expect(() =>
      jwt.verify(token, publicKey, { algorithms: ['ES384'], clockTimestamp: now.getTime() / 1000 })
    ).not.toThrow();
  });

  it('refuses without a key', () => {
    delete process.env.IVS_PLAYBACK_PRIVATE_KEY;
    expect(() => createPlaybackToken(CHANNEL_ARN)).toThrow(IvsNotConfiguredError);
  });

  it('adds the token to the playback URL', () => {
    expect(signedPlaybackUrl('https://x.playback.live-video.net/a.m3u8', 'tok')).toBe(
      'https://x.playback.live-video.net/a.m3u8?token=tok'
    );
  });
});

describe('hideIvsFields', () => {
  it('keeps the channel details for the artist only', () => {
    expect(hideIvsFields({ artistId: 'artist_1' }, 'artist_1')).toEqual({});
    expect(hideIvsFields({ artistId: 'artist_1' }, 'fan_1')).toEqual({
      ivsChannelArn: undefined,
      ivsIngestEndpoint: undefined,
      ivsPlaybackUrl: undefined,
      ivsStreamKeyArn: undefined,
    });
    expect(hideIvsFields({ artistId: 'artist_1' }, null)).toHaveProperty('ivsChannelArn', undefined);
  });
});

describe('IVS stream events', () => {
  const now = new Date('2026-12-05T20:01:00Z');
  const event = (name: string, overrides: Record<string, unknown> = {}) => ({
    source: 'aws.ivs',
    'detail-type': 'IVS Stream State Change',
    resources: [CHANNEL_ARN],
    detail: { event_name: name },
    ...overrides,
  });

  it('marks the party live when the stream starts', async () => {
    db.live_streams.findUnique.mockResolvedValue({ id: 'stream_1', status: 'SCHEDULED', startedAt: null });

    await expect(applyIvsStreamEvent(event('Stream Start'), now)).resolves.toBe('live');
    expect(db.live_streams.findUnique).toHaveBeenCalledWith({
      where: { ivsChannelArn: CHANNEL_ARN },
      select: { id: true, status: true, startedAt: true },
    });
    expect(db.live_streams.update).toHaveBeenCalledWith({
      where: { id: 'stream_1' },
      data: { status: 'LIVE', startedAt: now, endedAt: null, updatedAt: now },
    });
  });

  it('keeps the first start time when the stream comes back', async () => {
    const started = new Date('2026-12-05T20:00:00Z');
    db.live_streams.findUnique.mockResolvedValue({ id: 'stream_1', status: 'ENDED', startedAt: started });

    await applyIvsStreamEvent(event('Stream Start'), now);
    expect(db.live_streams.update.mock.calls[0][0].data.startedAt).toBe(started);
  });

  it('marks the party over when the stream ends', async () => {
    db.live_streams.findUnique.mockResolvedValue({ id: 'stream_1', status: 'LIVE', startedAt: now });

    await expect(applyIvsStreamEvent(event('Stream End'), now)).resolves.toBe('ended');
    expect(db.live_streams.update.mock.calls[0][0].data).toEqual({
      status: 'ENDED',
      endedAt: now,
      updatedAt: now,
    });
  });

  it('leaves cancelled parties, other events and other sources alone', async () => {
    db.live_streams.findUnique.mockResolvedValue({ id: 'stream_1', status: 'CANCELLED', startedAt: null });
    await expect(applyIvsStreamEvent(event('Stream Start'), now)).resolves.toBe('ignored');
    await expect(applyIvsStreamEvent(event('Session Created'), now)).resolves.toBe('ignored');
    await expect(applyIvsStreamEvent(event('Stream Start', { source: 'evil' }), now)).resolves.toBe('ignored');
    expect(db.live_streams.update).not.toHaveBeenCalled();
  });

  it('reports a channel no party owns', async () => {
    db.live_streams.findUnique.mockResolvedValue(null);
    await expect(applyIvsStreamEvent(event('Stream End'), now)).resolves.toBe('unknown-channel');
  });
});

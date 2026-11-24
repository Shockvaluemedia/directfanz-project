import {
  CreateChannelCommand,
  DeleteChannelCommand,
  GetStreamKeyCommand,
  IvsClient,
  TagResourceCommand,
} from '@aws-sdk/client-ivs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Listening parties on Amazon IVS.
 *
 * Each party gets its own private ("authorized") low-latency IVS channel. The
 * artist broadcasts into it, from the browser broadcaster on the broadcast
 * page or from OBS, and fans play it with a short-lived signed playback token
 * that the app issues only after the same access check as everything else
 * (canViewStream: a paid ticket, or membership of a tier the party names).
 *
 * Settings (all read at call time):
 * - IVS_PLAYBACK_PRIVATE_KEY: the private half of the IVS playback key pair,
 *   PEM (ECDSA P-384). Injected from Secrets Manager. IVS is off without it,
 *   because a private channel nobody can be given a token for is useless.
 * - IVS_REGION: optional; falls back to AWS_REGION, then us-east-1.
 * - IVS_CHANNEL_TYPE: optional; BASIC (default) or STANDARD.
 * - IVS_EVENTS_SECRET: optional Bearer secret on the EventBridge API
 *   destination that posts IVS stream state changes to /api/webhooks/ivs.
 *   Falls back to CRON_SECRET, so the cron routes' EventBridge connection can
 *   be reused.
 * AWS credentials come from the task role, never from the app's settings. The
 * task role may only create and manage IVS resources tagged
 * Project=directfanz (infra/aws/app.tf), so every channel and stream key made
 * here carries that tag.
 */

/** The tag the task role's IVS permissions are scoped to. */
export const IVS_PROJECT_TAG = { Project: 'directfanz' } as const;

/** How long a playback token stays valid for starting playback. */
export const PLAYBACK_TOKEN_TTL_SECONDS = 10 * 60;

const CHANNEL_TYPES = ['BASIC', 'STANDARD'] as const;
type ChannelType = (typeof CHANNEL_TYPES)[number];

export function isIvsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.IVS_PLAYBACK_PRIVATE_KEY?.trim());
}

export function ivsRegion(env: NodeJS.ProcessEnv = process.env): string {
  return env.IVS_REGION || env.AWS_REGION || 'us-east-1';
}

function channelType(env: NodeJS.ProcessEnv = process.env): ChannelType {
  const value = (env.IVS_CHANNEL_TYPE || 'BASIC').toUpperCase();
  return (CHANNEL_TYPES as readonly string[]).includes(value) ? (value as ChannelType) : 'BASIC';
}

let client: IvsClient | null = null;
function ivsClient(): IvsClient {
  if (!client) client = new IvsClient({ region: ivsRegion() });
  return client;
}

/** For tests: drop the cached client so a new mock is picked up. */
export function resetIvsClientForTests() {
  client = null;
}

export class IvsNotConfiguredError extends Error {
  constructor() {
    super('Listening parties on Amazon IVS are not configured');
    this.name = 'IvsNotConfiguredError';
  }
}

/** The IVS fields of a live_streams row. */
export interface IvsChannelFields {
  id: string;
  ivsChannelArn: string | null;
  ivsIngestEndpoint: string | null;
  ivsPlaybackUrl: string | null;
  ivsStreamKeyArn: string | null;
}

export const IVS_CHANNEL_SELECT = {
  id: true,
  ivsChannelArn: true,
  ivsIngestEndpoint: true,
  ivsPlaybackUrl: true,
  ivsStreamKeyArn: true,
} as const;

/** IVS channel names allow letters, digits, - and _, up to 128 characters. */
export function channelNameFor(streamId: string): string {
  return `directfanz-party-${streamId}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 128);
}

/**
 * The party's IVS channel, created on first use. Safe to call twice at once:
 * the row is only claimed when it has no channel yet, and a channel that lost
 * the race is deleted again.
 */
export async function ensurePartyChannel(stream: IvsChannelFields): Promise<IvsChannelFields> {
  if (stream.ivsChannelArn && stream.ivsPlaybackUrl && stream.ivsStreamKeyArn) return stream;
  if (!isIvsEnabled()) throw new IvsNotConfiguredError();

  const created = await ivsClient().send(
    new CreateChannelCommand({
      name: channelNameFor(stream.id),
      type: channelType(),
      latencyMode: 'LOW',
      authorized: true,
      tags: { ...IVS_PROJECT_TAG, streamId: stream.id },
    })
  );

  const channel = created.channel;
  const streamKeyArn = created.streamKey?.arn;
  if (!channel?.arn || !channel.playbackUrl || !channel.ingestEndpoint || !streamKeyArn) {
    if (channel?.arn) await deletePartyChannel(channel.arn);
    throw new Error('IVS returned an incomplete channel');
  }

  // The stream key must carry the project tag too, or the task role may not
  // read it back for the artist.
  try {
    await ivsClient().send(
      new TagResourceCommand({ resourceArn: streamKeyArn, tags: { ...IVS_PROJECT_TAG } })
    );
  } catch (error) {
    await deletePartyChannel(channel.arn);
    throw error;
  }

  const fields = {
    ivsChannelArn: channel.arn,
    ivsIngestEndpoint: channel.ingestEndpoint,
    ivsPlaybackUrl: channel.playbackUrl,
    ivsStreamKeyArn: streamKeyArn,
  };

  const claimed = await prisma.live_streams.updateMany({
    where: { id: stream.id, ivsChannelArn: null },
    data: { ...fields, updatedAt: new Date() },
  });

  if (claimed.count === 1) {
    logger.info('IVS channel created for party', { streamId: stream.id });
    return { id: stream.id, ...fields };
  }

  // Another request saved a channel first: keep that one, delete ours.
  await deletePartyChannel(channel.arn);
  const current = await prisma.live_streams.findUnique({
    where: { id: stream.id },
    select: IVS_CHANNEL_SELECT,
  });
  if (!current?.ivsChannelArn) throw new Error('Party not found');
  return current;
}

/** Deletes a party's IVS channel (and its stream key). Never throws. */
export async function deletePartyChannel(channelArn: string | null | undefined): Promise<void> {
  if (!channelArn) return;
  try {
    await ivsClient().send(new DeleteChannelCommand({ arn: channelArn }));
  } catch (error) {
    logger.warn('Could not delete IVS channel', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface BroadcastDetails {
  /** For the browser broadcaster: the channel's ingest endpoint. */
  ingestEndpoint: string;
  /** For OBS: Server field. */
  ingestServer: string;
  /** Secret: lets whoever holds it broadcast as the artist. */
  streamKey: string;
}

/** What the artist needs to go live. Only ever return this to the artist. */
export async function getBroadcastDetails(stream: IvsChannelFields): Promise<BroadcastDetails> {
  const channel = await ensurePartyChannel(stream);
  const result = await ivsClient().send(new GetStreamKeyCommand({ arn: channel.ivsStreamKeyArn! }));
  const streamKey = result.streamKey?.value;
  if (!streamKey) throw new Error('IVS returned no stream key');
  return {
    ingestEndpoint: channel.ivsIngestEndpoint!,
    ingestServer: `rtmps://${channel.ivsIngestEndpoint}:443/app/`,
    streamKey,
  };
}

/** The site's origin, which playback tokens are bound to; '*' when unknown. */
export function playbackOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL;
  if (!base) return '*';
  try {
    return new URL(base).origin;
  } catch {
    return '*';
  }
}

/**
 * A signed IVS playback token for one channel (ES384, as IVS requires). Call
 * only after canViewStream said yes.
 */
export function createPlaybackToken(
  channelArn: string,
  options: { now?: Date; ttlSeconds?: number; privateKey?: string; origin?: string } = {}
): { token: string; expiresAt: Date } {
  const privateKey = (options.privateKey ?? process.env.IVS_PLAYBACK_PRIVATE_KEY ?? '').replace(
    /\\n/g,
    '\n'
  );
  if (!privateKey.trim()) throw new IvsNotConfiguredError();

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const exp = nowSeconds + (options.ttlSeconds ?? PLAYBACK_TOKEN_TTL_SECONDS);
  const token = jwt.sign(
    {
      'aws:channel-arn': channelArn,
      'aws:access-control-allow-origin': options.origin ?? playbackOrigin(),
      exp,
    },
    privateKey,
    { algorithm: 'ES384', noTimestamp: true }
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

/** The channel's playback URL with a token on it. */
export function signedPlaybackUrl(playbackUrl: string, token: string): string {
  const url = new URL(playbackUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

/** The IVS fields only the party's artist may see. */
export function hideIvsFields(stream: { artistId: string }, viewerId: string | null | undefined) {
  if (viewerId && stream.artistId === viewerId) return {};
  return {
    ivsChannelArn: undefined,
    ivsIngestEndpoint: undefined,
    ivsPlaybackUrl: undefined,
    ivsStreamKeyArn: undefined,
  };
}

/**
 * An "IVS Stream State Change" event from EventBridge. Only the fields used
 * here; see the IVS user guide, "Using Amazon EventBridge with IVS".
 */
export interface IvsStreamStateEvent {
  'detail-type'?: string;
  source?: string;
  resources?: string[];
  detail?: { event_name?: string; channel_name?: string };
}

export type IvsEventOutcome = 'live' | 'ended' | 'ignored' | 'unknown-channel';

/**
 * Marks a party live when its stream starts and over when it ends. A stream
 * that drops and comes back marks the party live again. Cancelled parties
 * stay cancelled.
 */
export async function applyIvsStreamEvent(
  event: IvsStreamStateEvent,
  now: Date = new Date()
): Promise<IvsEventOutcome> {
  if (event.source !== 'aws.ivs' || event['detail-type'] !== 'IVS Stream State Change') {
    return 'ignored';
  }
  const name = event.detail?.event_name;
  if (name !== 'Stream Start' && name !== 'Stream End') return 'ignored';

  const channelArn = event.resources?.find(arn => arn.includes(':channel/'));
  if (!channelArn) return 'ignored';

  const stream = await prisma.live_streams.findUnique({
    where: { ivsChannelArn: channelArn },
    select: { id: true, status: true, startedAt: true },
  });
  if (!stream) return 'unknown-channel';
  if (stream.status === 'CANCELLED') return 'ignored';

  if (name === 'Stream Start') {
    await prisma.live_streams.update({
      where: { id: stream.id },
      data: {
        status: 'LIVE',
        startedAt: stream.startedAt ?? now,
        endedAt: null,
        updatedAt: now,
      },
    });
    return 'live';
  }

  await prisma.live_streams.update({
    where: { id: stream.id },
    data: { status: 'ENDED', endedAt: now, updatedAt: now },
  });
  return 'ended';
}

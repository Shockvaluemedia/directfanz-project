/**
 * Pusher server-side client for real-time features
 */
import Pusher from 'pusher';
import { logger } from './logger';

let pusherInstance: Pusher | null = null;

function getPusher(): Pusher | null {
  if (pusherInstance) return pusherInstance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

  if (!appId || !key || !secret) {
    logger.warn('Pusher not configured — real-time features disabled');
    return null;
  }

  pusherInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherInstance;
}

/**
 * Trigger an event on a Pusher channel
 */
export async function triggerEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    logger.error('Pusher trigger error', {
      channel,
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Trigger a stream event
 */
export async function triggerStreamEvent(
  streamId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  await triggerEvent(`stream-${streamId}`, event, data);
}

export { getPusher };

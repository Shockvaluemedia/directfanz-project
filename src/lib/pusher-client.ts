'use client';

/**
 * Pusher client-side for real-time subscriptions
 */
import PusherClient from 'pusher-js';

let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  if (pusherClient) return pusherClient;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

  if (!key) return null;

  pusherClient = new PusherClient(key, {
    cluster,
  });

  return pusherClient;
}

/**
 * Subscribe to a stream channel and listen for events
 */
export function subscribeToStream(
  streamId: string,
  callbacks: {
    onStarted?: (data: Record<string, unknown>) => void;
    onEnded?: (data: Record<string, unknown>) => void;
    onViewerJoined?: (data: Record<string, unknown>) => void;
    onViewerLeft?: (data: Record<string, unknown>) => void;
    onChatMessage?: (data: Record<string, unknown>) => void;
    onViewerCount?: (data: Record<string, unknown>) => void;
  }
): (() => void) | null {
  const client = getPusherClient();
  if (!client) return null;

  const channel = client.subscribe(`stream-${streamId}`);

  if (callbacks.onStarted) channel.bind('stream-started', callbacks.onStarted);
  if (callbacks.onEnded) channel.bind('stream-ended', callbacks.onEnded);
  if (callbacks.onViewerJoined) channel.bind('viewer-joined', callbacks.onViewerJoined);
  if (callbacks.onViewerLeft) channel.bind('viewer-left', callbacks.onViewerLeft);
  if (callbacks.onChatMessage) channel.bind('chat-message', callbacks.onChatMessage);
  if (callbacks.onViewerCount) channel.bind('viewer-count', callbacks.onViewerCount);

  // Return cleanup function
  return () => {
    channel.unbind_all();
    client.unsubscribe(`stream-${streamId}`);
  };
}

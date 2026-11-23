'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

/**
 * Plays a listening party from Amazon IVS. The app hands out a short-lived
 * signed playback URL only to fans who may watch (a ticket, or a tier the
 * party names), so there is nothing to play without one. IVS serves HLS, so
 * hls.js plays it (Safari plays HLS natively). While the artist is not live
 * yet, it keeps checking back.
 */

const RETRY_MS = 15_000;

type PlayerState =
  | { kind: 'loading' }
  | { kind: 'waiting' }
  | { kind: 'playing' }
  | { kind: 'ended' }
  | { kind: 'locked'; message: string }
  | { kind: 'error'; message: string };

interface PlaybackResponse {
  data?: { status: string; playbackUrl: string | null; expiresAt?: string };
  error?: string;
}

export default function IvsPlayer({ streamId }: { streamId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerState>({ kind: 'loading' });

  const stop = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const load = useCallback(async () => {
    stop();
    const video = videoRef.current;
    if (!video) return;

    const retryLater = () => {
      retryRef.current = setTimeout(() => void load(), RETRY_MS);
    };

    let body: PlaybackResponse;
    let status: number;
    try {
      const response = await fetch(`/api/livestream/${streamId}/playback`, { cache: 'no-store' });
      status = response.status;
      body = await response.json();
    } catch {
      setState({ kind: 'error', message: 'Could not reach the party. Trying again…' });
      retryLater();
      return;
    }

    if (status === 401 || status === 403) {
      setState({ kind: 'locked', message: body.error || 'A ticket is needed to watch' });
      return;
    }
    if (status !== 200 || !body.data) {
      setState({ kind: 'error', message: body.error || 'Playback is unavailable. Trying again…' });
      retryLater();
      return;
    }

    const { status: partyStatus, playbackUrl } = body.data;
    if (partyStatus === 'ENDED' || partyStatus === 'CANCELLED') {
      setState({ kind: 'ended' });
      return;
    }
    if (!playbackUrl) {
      setState({ kind: 'waiting' });
      retryLater();
      return;
    }

    // Not live yet shows up as a failed playlist: wait and ask for a fresh token.
    const onUnavailable = () => {
      stop();
      setState({ kind: 'waiting' });
      retryLater();
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setState({ kind: 'playing' });
        video.play().catch(() => {
          // Autoplay with sound can be blocked; the controls let the fan start it.
        });
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) onUnavailable();
      });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.onloadedmetadata = () => {
        setState({ kind: 'playing' });
        video.play().catch(() => undefined);
      };
      video.onerror = onUnavailable;
    } else {
      setState({ kind: 'error', message: 'This browser cannot play the party.' });
    }
  }, [streamId, stop]);

  useEffect(() => {
    void load();
    return stop;
  }, [load, stop]);

  const overlay =
    state.kind === 'loading'
      ? 'Loading…'
      : state.kind === 'waiting'
        ? 'The party starts when the artist goes live. This page will start playing by itself.'
        : state.kind === 'ended'
          ? 'This listening party has ended.'
          : state.kind === 'locked' || state.kind === 'error'
            ? state.message
            : null;

  return (
    <div className='relative aspect-video w-full overflow-hidden rounded-lg bg-black'>
      <video ref={videoRef} className='h-full w-full' controls playsInline />
      {overlay && (
        <div className='absolute inset-0 flex items-center justify-center p-6 text-center text-white'>
          <p>{overlay}</p>
        </div>
      )}
    </div>
  );
}

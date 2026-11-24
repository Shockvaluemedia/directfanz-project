'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * The artist's side of a listening party on Amazon IVS. Streams the artist's
 * camera and microphone from the browser with the IVS web broadcast SDK, or
 * shows the server and key to paste into OBS instead. Used only on the
 * broadcast page, the one page where the browser allows camera and mic.
 */

interface BroadcastDetails {
  ingestEndpoint: string;
  ingestServer: string;
  streamKey: string;
}

type BroadcastState = 'idle' | 'preview' | 'connecting' | 'live' | 'error';

// The SDK is loaded only in the browser, on this page.
type BroadcastSdk = typeof import('amazon-ivs-web-broadcast').default;
type BroadcastClient = ReturnType<BroadcastSdk['create']>;

interface IvsBroadcasterProps {
  streamId: string;
  onLive?: () => void;
  onEnded?: () => void;
}

export default function IvsBroadcaster({ streamId, onLive, onEnded }: IvsBroadcasterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<BroadcastClient | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const [details, setDetails] = useState<BroadcastDetails | null>(null);
  const [state, setState] = useState<BroadcastState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Ask for the ingest details (and create the channel) once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/livestream/${streamId}/broadcast`, { method: 'POST' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not prepare the broadcast');
        if (!cancelled) setDetails(body.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not prepare the broadcast');
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  const releaseDevices = useCallback(() => {
    mediaRef.current?.getTracks().forEach(track => track.stop());
    mediaRef.current = null;
    try {
      clientRef.current?.delete();
    } catch {
      // already gone
    }
    clientRef.current = null;
  }, []);

  useEffect(() => releaseDevices, [releaseDevices]);

  const startPreview = useCallback(async () => {
    if (!details) return;
    setError(null);
    try {
      const sdk = (await import('amazon-ivs-web-broadcast')).default;
      if (!sdk.isSupported()) {
        throw new Error('This browser cannot broadcast. Use Chrome, Edge or Safari, or OBS.');
      }
      const client = sdk.create({
        streamConfig: sdk.BASIC_LANDSCAPE,
        ingestEndpoint: details.ingestEndpoint,
      });
      client.on(sdk.BroadcastClientEvents.CONNECTION_STATE_CHANGE, (...args: unknown[]) => {
        const value = String(args[0]);
        if (value === 'connected') {
          setState('live');
          onLive?.();
        } else if (value === 'disconnected' || value === 'failed') {
          setState(current => (current === 'live' || current === 'connecting' ? 'preview' : current));
        }
      });

      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 852 }, height: { ideal: 480 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      mediaRef.current = media;

      await client.addVideoInputDevice(new MediaStream(media.getVideoTracks()), 'camera', { index: 0 });
      await client.addAudioInputDevice(new MediaStream(media.getAudioTracks()), 'microphone');
      if (canvasRef.current) client.attachPreview(canvasRef.current);

      clientRef.current = client;
      setState('preview');
    } catch (err) {
      releaseDevices();
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Allow camera and microphone access to broadcast from this page.'
          : err instanceof Error
            ? err.message
            : 'Could not start the camera';
      setError(message);
      setState('idle');
    }
  }, [details, onLive, releaseDevices]);

  const goLive = useCallback(async () => {
    if (!clientRef.current || !details) return;
    setState('connecting');
    try {
      await clientRef.current.startBroadcast(details.streamKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not go live');
      setState('preview');
    }
  }, [details]);

  const endBroadcast = useCallback(() => {
    clientRef.current?.stopBroadcast();
    releaseDevices();
    setState('idle');
    onEnded?.();
  }, [onEnded, releaseDevices]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <span>Broadcast from this browser</span>
            {state === 'live' && (
              <span className='rounded bg-red-100 px-2 py-1 text-sm font-medium text-red-800'>
                Live
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <canvas
            ref={canvasRef}
            className='aspect-video w-full rounded bg-black'
            aria-label='Broadcast preview'
          />
          {error && <p className='text-sm text-red-600'>{error}</p>}
          <div className='flex flex-wrap gap-2'>
            {state === 'idle' && (
              <Button onClick={startPreview} disabled={!details}>
                Turn on camera and mic
              </Button>
            )}
            {state === 'preview' && <Button onClick={goLive}>Go live</Button>}
            {state === 'connecting' && <Button disabled>Connecting…</Button>}
            {(state === 'preview' || state === 'connecting' || state === 'live') && (
              <Button variant='outline' onClick={endBroadcast}>
                {state === 'live' ? 'End party' : 'Turn off camera'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {details && (
        <Card>
          <CardHeader>
            <CardTitle>Or broadcast from OBS</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <p className='text-gray-600'>
              In OBS, open Settings, then Stream. Choose Custom, and paste these. Keep the stream
              key private: anyone with it can broadcast as you.
            </p>
            <div className='flex items-center justify-between gap-2'>
              <code className='break-all rounded bg-gray-100 px-2 py-1'>{details.ingestServer}</code>
              <Button variant='outline' size='sm' onClick={() => copy(details.ingestServer, 'Server')}>
                Copy
              </Button>
            </div>
            <div className='flex items-center justify-between gap-2'>
              <code className='break-all rounded bg-gray-100 px-2 py-1'>
                {showKey ? details.streamKey : '••••••••••••••••'}
              </code>
              <div className='flex gap-2'>
                <Button variant='outline' size='sm' onClick={() => setShowKey(value => !value)}>
                  {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => copy(details.streamKey, 'Stream key')}
                >
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

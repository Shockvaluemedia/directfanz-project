'use client';

import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import IvsBroadcaster from '@/components/livestream/ivs-broadcaster';

/**
 * Marks the party live or over when the artist starts or ends the browser
 * broadcast. IVS stream events (/api/webhooks/ivs) do the same for OBS and
 * for dropped connections; doing it here too keeps the party page right when
 * those events aren't wired up.
 */
export default function PartyBroadcastStudio({ streamId }: { streamId: string }) {
  const setStatus = useCallback(
    async (status: 'LIVE' | 'ENDED') => {
      try {
        const response = await fetch(`/api/livestream/${streamId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error();
        toast.success(status === 'LIVE' ? 'You are live' : 'Party ended');
      } catch {
        toast.error('Could not update the party status');
      }
    },
    [streamId]
  );

  return (
    <IvsBroadcaster
      streamId={streamId}
      onLive={() => setStatus('LIVE')}
      onEnded={() => setStatus('ENDED')}
    />
  );
}

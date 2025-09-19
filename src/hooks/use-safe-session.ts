'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';

export function useSafeSession() {
  const [isClient, setIsClient] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  const sessionHook = useSession();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      setSession(sessionHook.data);
      setStatus(sessionHook.status);
    }
  }, [isClient, sessionHook.data, sessionHook.status]);

  if (!isClient) {
    return {
      data: null,
      status: 'loading' as const,
      update: async () => null,
    };
  }

  return {
    data: session,
    status,
    update: sessionHook.update,
  };
}

'use client';

import { useEffect } from 'react';
import { WebSocketProvider } from './WebSocketProvider';
import { setupConsoleFilter } from '@/lib/console-filter';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface WebSocketClientProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketClientProvider({ children, url }: WebSocketClientProviderProps) {
  useEffect(() => {
    // Set up console filtering to suppress browser extension noise
    setupConsoleFilter();
  }, []);

  return (
    <ClientOnly fallback={<>{children}</>}>
      <WebSocketProvider url={url}>{children}</WebSocketProvider>
    </ClientOnly>
  );
}

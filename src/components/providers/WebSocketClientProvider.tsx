'use client';

import { useEffect, useState } from 'react';
import { WebSocketProvider } from './WebSocketProvider';

interface WebSocketClientProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketClientProvider({ children, url }: WebSocketClientProviderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only render the WebSocketProvider on the client side
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <WebSocketProvider url={url}>
      {children}
    </WebSocketProvider>
  );
}
'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

interface WebSocketContextType {
  eventSource: EventSource | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const { data: session, status } = useSession();
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const eventListeners = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Ensure this only runs on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Don't attempt connection if not on client, session is still loading, or user not available
    if (!isClient || status === 'loading' || !session?.user) return;

    const connect = () => {
      try {
        // Create SSE connection
        const sseUrl = url || `/api/ws?userId=${encodeURIComponent(session.user.id)}`;
        const es = new EventSource(sseUrl);

        es.onopen = () => {
          console.log('SSE connected');
          setIsConnected(true);
          setEventSource(es);
        };

        es.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('SSE message:', message);

            // Dispatch to event listeners
            const listeners = eventListeners.current.get(message.type);
            if (listeners) {
              listeners.forEach(callback => callback(message.data));
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        es.onerror = (error) => {
          console.error('SSE error:', error);
          setIsConnected(false);
          setEventSource(null);

          // Attempt to reconnect after a delay
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect SSE...');
            connect();
          }, 3000);
        };

      } catch (error) {
        console.error('Failed to create SSE connection:', error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isClient, session?.user, status, url, eventSource]);

  const sendMessage = async (message: any) => {
    try {
      // Send message via HTTP POST to SSE endpoint
      await fetch('/api/ws', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...message,
          userId: session?.user?.id
        })
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const subscribe = (event: string, callback: (data: any) => void) => {
    if (!eventListeners.current.has(event)) {
      eventListeners.current.set(event, new Set());
    }
    eventListeners.current.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.current.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListeners.current.delete(event);
        }
      }
    };
  };

  const value: WebSocketContextType = {
    eventSource,
    isConnected,
    sendMessage,
    subscribe
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
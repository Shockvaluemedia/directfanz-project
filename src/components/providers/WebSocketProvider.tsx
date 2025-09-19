'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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

// Global connection tracking to prevent multiple connections per user
const activeConnections = new Map<string, EventSource>();

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const { data: session, status } = useSession();
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // Start with 1 second
  const eventListeners = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const userIdRef = useRef<string | null>(null);

  // Ensure this only runs on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Clean up connection for current user when component unmounts or user changes
  useEffect(() => {
    return () => {
      if (userIdRef.current) {
        const existingConnection = activeConnections.get(userIdRef.current);
        if (existingConnection) {
          try {
            existingConnection.close();
          } catch {}
          activeConnections.delete(userIdRef.current);
        }
      }
    };
  }, []);

  const connect = useCallback(() => {
    if (!isClient || status === 'loading' || !session?.user) {
      return;
    }

    const userId = session.user.id;
    userIdRef.current = userId;

    // Check if there's already an active connection for this user
    const existingConnection = activeConnections.get(userId);
    if (existingConnection && existingConnection.readyState === EventSource.OPEN) {
      // Use existing connection
      setEventSource(existingConnection);
      setIsConnected(true);
      connectionAttempts.current = 0;
      return;
    }

    // Clean up any stale connection
    if (existingConnection) {
      try {
        existingConnection.close();
      } catch {}
      activeConnections.delete(userId);
    }

    // Don't reconnect if we've exceeded max attempts
    if (connectionAttempts.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    try {
      console.log(`Creating SSE connection (attempt ${connectionAttempts.current + 1})`);

      const sseUrl = url || `/api/ws?userId=${encodeURIComponent(userId)}`;
      const es = new EventSource(sseUrl);

      // Store in global connections map
      activeConnections.set(userId, es);

      es.onopen = () => {
        console.log('SSE connected successfully');
        setEventSource(es);
        setIsConnected(true);
        connectionAttempts.current = 0; // Reset on successful connection
      };

      es.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          // Dispatch to event listeners
          const listeners = eventListeners.current.get(message.type);
          if (listeners) {
            listeners.forEach(callback => callback(message.data));
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      es.onerror = error => {
        console.error('SSE connection error:', error);
        setIsConnected(false);

        // Clean up the failed connection
        try {
          es.close();
        } catch {}
        activeConnections.delete(userId);
        setEventSource(null);

        // Increment attempt counter
        connectionAttempts.current++;

        // Only attempt reconnection if we haven't exceeded the limit
        if (connectionAttempts.current < maxReconnectAttempts) {
          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // Exponential backoff: delay increases with each attempt
          const delay = baseReconnectDelay * Math.pow(2, connectionAttempts.current - 1);

          console.log(
            `Scheduling reconnection in ${delay}ms (attempt ${connectionAttempts.current + 1}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('Max reconnection attempts exceeded, giving up');
        }
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      connectionAttempts.current++;
    }
  }, [isClient, status, session?.user?.id, url]);

  // Main connection effect
  useEffect(() => {
    if (isClient && session?.user) {
      connect();
    }

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const userId = session?.user?.id;
      if (userId) {
        const connection = activeConnections.get(userId);
        if (connection && connection === eventSource) {
          // Only close if this is the connection we're managing
          try {
            connection.close();
          } catch {}
          activeConnections.delete(userId);
        }
      }

      setEventSource(null);
      setIsConnected(false);
    };
  }, [connect, session?.user?.id]);

  const sendMessage = useCallback(
    async (message: any) => {
      if (!session?.user?.id) {
        console.warn('Cannot send message: No user session');
        return;
      }

      try {
        await fetch('/api/ws', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...message,
            userId: session.user.id,
          }),
        });
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [session?.user?.id]
  );

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
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
  }, []);

  const value: WebSocketContextType = React.useMemo(
    () => ({
      eventSource,
      isConnected,
      sendMessage,
      subscribe,
    }),
    [eventSource, isConnected, sendMessage, subscribe]
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

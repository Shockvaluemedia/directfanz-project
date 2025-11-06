'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  url?: string;
  userId?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnectAttempt: number;
  lastConnected: Date | null;
}

export function useSocket({
  url = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001',
  userId,
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectDelay = 1000
}: UseSocketOptions = {}) {
  const [socketState, setSocketState] = useState<SocketState>({
    socket: null,
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    reconnectAttempt: 0,
    lastConnected: null
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    setSocketState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      connectionError: null 
    }));

    try {
      const socketOptions = {
        transports: ['websocket', 'polling'] as const,
        upgrade: true,
        timeout: 10000,
        forceNew: true,
        query: userId ? { userId } : undefined
      };

      const newSocket = io(url, socketOptions);
      socketRef.current = newSocket;

      // Connection success
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        
        setSocketState(prev => ({
          ...prev,
          socket: newSocket,
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          reconnectAttempt: 0,
          lastConnected: new Date()
        }));

        // Start ping to keep connection alive
        startPing(newSocket);

        // Join user room if userId provided
        if (userId) {
          newSocket.emit('join_user_room', { userId });
        }
      });

      // Connection error
      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        
        setSocketState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          connectionError: error.message || 'Connection failed'
        }));

        // Attempt reconnection
        attemptReconnection();
      });

      // Disconnection
      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        setSocketState(prev => ({
          ...prev,
          isConnected: false,
          connectionError: reason === 'io server disconnect' 
            ? 'Disconnected by server' 
            : null
        }));

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection for client-side disconnects
        if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
          attemptReconnection();
        }
      });

      // Reconnection attempts
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        
        setSocketState(prev => ({
          ...prev,
          isConnected: true,
          connectionError: null,
          reconnectAttempt: 0,
          lastConnected: new Date()
        }));
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
        
        setSocketState(prev => ({
          ...prev,
          connectionError: error.message || 'Reconnection failed'
        }));
      });

      // Handle pong responses
      newSocket.on('pong', () => {
        // Connection is alive
      });

    } catch (error) {
      console.error('Failed to create socket:', error);
      setSocketState(prev => ({
        ...prev,
        isConnecting: false,
        connectionError: 'Failed to initialize connection'
      }));
    }
  }, [url, userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setSocketState(prev => ({
      ...prev,
      socket: null,
      isConnected: false,
      isConnecting: false,
      reconnectAttempt: 0
    }));
  }, []);

  const attemptReconnection = useCallback(() => {
    if (socketState.reconnectAttempt >= reconnectAttempts) {
      console.log('Max reconnection attempts reached');
      setSocketState(prev => ({
        ...prev,
        connectionError: 'Unable to reconnect after maximum attempts'
      }));
      return;
    }

    const delay = reconnectDelay * Math.pow(2, socketState.reconnectAttempt); // Exponential backoff
    
    setSocketState(prev => ({
      ...prev,
      reconnectAttempt: prev.reconnectAttempt + 1
    }));

    console.log(`Attempting reconnection in ${delay}ms (attempt ${socketState.reconnectAttempt + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [socketState.reconnectAttempt, reconnectAttempts, reconnectDelay, connect]);

  const startPing = useCallback((socket: Socket) => {
    // Send ping every 30 seconds to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    return false;
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Reconnect when userId changes
  useEffect(() => {
    if (socketRef.current?.connected && userId) {
      socketRef.current.emit('join_user_room', { userId });
    }
  }, [userId]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socketState.isConnected && !socketState.isConnecting) {
        // Page became visible and socket is not connected - attempt reconnection
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [socketState.isConnected, socketState.isConnecting, connect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (!socketState.isConnected && !socketState.isConnecting) {
        connect();
      }
    };

    const handleOffline = () => {
      if (socketState.isConnected) {
        setSocketState(prev => ({
          ...prev,
          connectionError: 'You are offline'
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [socketState.isConnected, socketState.isConnecting, connect]);

  return {
    socket: socketRef.current,
    isConnected: socketState.isConnected,
    isConnecting: socketState.isConnecting,
    connectionError: socketState.connectionError,
    reconnectAttempt: socketState.reconnectAttempt,
    lastConnected: socketState.lastConnected,
    connect,
    disconnect,
    emit,
    on,
    off
  };
}

// Custom hook for presence tracking
export function usePresence(userId?: string) {
  const { socket, isConnected, emit } = useSocket({ userId });
  const [presence, setPresence] = useState<{
    status: 'online' | 'away' | 'offline';
    lastSeen?: Date;
  }>({ status: 'offline' });

  const updatePresence = useCallback((status: 'online' | 'away' | 'offline') => {
    if (emit('presence_update', { userId, status, timestamp: new Date() })) {
      setPresence({ status, lastSeen: status === 'offline' ? new Date() : undefined });
    }
  }, [emit, userId]);

  useEffect(() => {
    if (!socket || !userId) return;

    socket.on('presence_updated', (data) => {
      if (data.userId === userId) {
        setPresence({
          status: data.status,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined
        });
      }
    });

    // Update presence when connection state changes
    if (isConnected) {
      updatePresence('online');
    } else {
      setPresence({ status: 'offline', lastSeen: new Date() });
    }

    return () => {
      socket.off('presence_updated');
    };
  }, [socket, userId, isConnected, updatePresence]);

  // Handle user activity
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      
      if (presence.status !== 'online' && isConnected) {
        updatePresence('online');
      }

      // Set to away after 5 minutes of inactivity
      inactivityTimer = setTimeout(() => {
        if (isConnected) {
          updatePresence('away');
        }
      }, 5 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
    };
  }, [presence.status, isConnected, updatePresence]);

  // Handle page beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isConnected) {
        updatePresence('offline');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isConnected, updatePresence]);

  return {
    presence,
    updatePresence
  };
}
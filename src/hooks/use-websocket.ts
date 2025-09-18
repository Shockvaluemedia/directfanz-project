import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import {
  ConnectionStatus,
  createConversationId,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type Message,
  type User,
} from '@/types/websocket';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseWebSocketReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  error: string | null;

  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Messaging methods
  sendMessage: (recipientId: string, content: string, type?: 'TEXT' | 'IMAGE' | 'AUDIO', attachmentUrl?: string) => void;
  markMessageAsRead: (messageId: string) => void;

  // Conversation methods
  joinConversation: (otherUserId: string) => void;
  leaveConversation: (otherUserId: string) => void;

  // Typing indicators
  startTyping: (conversationWith: string) => void;
  stopTyping: (conversationWith: string) => void;

  // Presence
  updatePresence: () => void;

  // State
  messages: Message[];
  typingUsers: { userId: string; displayName: string; conversationId: string }[];
  onlineUsers: string[];

  // Event handlers (for custom usage)
  on: (event: keyof ServerToClientEvents, handler: (...args: any[]) => void) => void;
  off: (event: keyof ServerToClientEvents, handler: (...args: any[]) => void) => void;
  emit: (event: keyof ClientToServerEvents, ...args: any[]) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { data: session, status: sessionStatus } = useSession();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string; conversationId: string }[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (sessionStatus !== 'authenticated' || !session?.accessToken) {
      setError('Authentication required for WebSocket connection');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    setConnectionStatus(ConnectionStatus.CONNECTING);
    setError(null);

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || window.location.origin, {
      auth: {
        token: session.accessToken,
      },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      timeout: 20000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        setConnectionStatus(ConnectionStatus.RECONNECTING);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setConnectionStatus(ConnectionStatus.ERROR);
      setError(err.message || 'Connection failed');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus(ConnectionStatus.RECONNECTING);
    });

    socket.on('reconnect', () => {
      console.log('WebSocket reconnected');
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setError(null);
    });

    socket.on('reconnect_failed', () => {
      setConnectionStatus(ConnectionStatus.ERROR);
      setError('Failed to reconnect after maximum attempts');
    });

    // Authentication events
    socket.on('auth:success', (data) => {
      console.log('WebSocket authentication successful:', data.userId);
    });

    socket.on('auth:error', (error) => {
      console.error('WebSocket authentication error:', error);
      setError(error);
      setConnectionStatus(ConnectionStatus.ERROR);
    });

    // Message events
    socket.on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('message:read', (data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, readAt: data.readAt }
            : msg
        )
      );
    });

    socket.on('message:delivered', (data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, deliveredAt: data.deliveredAt }
            : msg
        )
      );
    });

    // Typing events
    socket.on('typing:start', (data) => {
      setTypingUsers(prev => {
        const exists = prev.find(user => user.userId === data.userId && user.conversationId === data.conversationId);
        if (exists) return prev;
        return [...prev, data];
      });

      // Auto clear typing indicator after 10 seconds
      const timeoutKey = `${data.conversationId}:${data.userId}`;
      if (typingTimeoutsRef.current.has(timeoutKey)) {
        clearTimeout(typingTimeoutsRef.current.get(timeoutKey)!);
      }
      
      const timeout = setTimeout(() => {
        setTypingUsers(prev => 
          prev.filter(user => !(user.userId === data.userId && user.conversationId === data.conversationId))
        );
        typingTimeoutsRef.current.delete(timeoutKey);
      }, 10000);
      
      typingTimeoutsRef.current.set(timeoutKey, timeout);
    });

    socket.on('typing:stop', (data) => {
      setTypingUsers(prev => 
        prev.filter(user => !(user.userId === data.userId && user.conversationId === data.conversationId))
      );
      
      const timeoutKey = `${data.conversationId}:${data.userId}`;
      if (typingTimeoutsRef.current.has(timeoutKey)) {
        clearTimeout(typingTimeoutsRef.current.get(timeoutKey)!);
        typingTimeoutsRef.current.delete(timeoutKey);
      }
    });

    // Presence events
    socket.on('user:online', (data) => {
      setOnlineUsers(prev => 
        prev.includes(data.userId) ? prev : [...prev, data.userId]
      );
    });

    socket.on('user:offline', (data) => {
      setOnlineUsers(prev => prev.filter(userId => userId !== data.userId));
    });

    // Error events
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError(error);
    });

  }, [session, sessionStatus, reconnection, reconnectionAttempts, reconnectionDelay]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
    
    // Clear all typing timeouts
    typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    typingTimeoutsRef.current.clear();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Message methods
  const sendMessage = useCallback((recipientId: string, content: string, type?: 'TEXT' | 'IMAGE' | 'AUDIO', attachmentUrl?: string) => {
    if (!socketRef.current?.connected) {
      setError('Not connected to server');
      return;
    }

    socketRef.current.emit('message:send', {
      recipientId,
      content,
      type,
      attachmentUrl,
    });
  }, []);

  const markMessageAsRead = useCallback((messageId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('message:mark_read', { messageId });
  }, []);

  // Conversation methods
  const joinConversation = useCallback((otherUserId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('conversation:join', { conversationWith: otherUserId });
  }, []);

  const leaveConversation = useCallback((otherUserId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('conversation:leave', { conversationWith: otherUserId });
  }, []);

  // Typing methods
  const startTyping = useCallback((conversationWith: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('typing:start', { conversationWith });
  }, []);

  const stopTyping = useCallback((conversationWith: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('typing:stop', { conversationWith });
  }, []);

  // Presence method
  const updatePresence = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('presence:update');
  }, []);

  // Event handler methods
  const on = useCallback((event: keyof ServerToClientEvents, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event as any, handler);
  }, []);

  const off = useCallback((event: keyof ServerToClientEvents, handler: (...args: any[]) => void) => {
    socketRef.current?.off(event as any, handler);
  }, []);

  const emit = useCallback((event: keyof ClientToServerEvents, ...args: any[]) => {
    socketRef.current?.emit(event as any, ...args);
  }, []);

  // Auto-connect when session is available
  useEffect(() => {
    if (autoConnect && sessionStatus === 'authenticated' && connectionStatus === ConnectionStatus.DISCONNECTED) {
      connect();
    }

    return () => {
      if (!autoConnect) {
        disconnect();
      }
    };
  }, [sessionStatus, autoConnect, connect, disconnect, connectionStatus]);

  // Update presence periodically when connected
  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      const interval = setInterval(updatePresence, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [connectionStatus, updatePresence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    socket: socketRef.current,
    isConnected: connectionStatus === ConnectionStatus.CONNECTED,
    error,
    connect,
    disconnect,
    sendMessage,
    markMessageAsRead,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    updatePresence,
    messages,
    typingUsers,
    onlineUsers,
    on,
    off,
    emit,
  };
}
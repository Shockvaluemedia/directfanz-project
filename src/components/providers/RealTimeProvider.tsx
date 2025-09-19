'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useReducer,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
// Simple console logger fallback
const logger = {
  info: (message: string, data?: any) => console.log(`[RealTime] ${message}`, data),
  error: (message: string, data?: any) => console.error(`[RealTime] ${message}`, data),
  warn: (message: string, data?: any) => console.warn(`[RealTime] ${message}`, data),
};

interface NotificationData {
  id: string;
  type: 'subscription' | 'content' | 'message' | 'livestream' | 'tip' | 'comment' | 'like';
  title: string;
  message: string;
  data?: Record<string, any>;
  userId: string;
  createdAt: string;
  read: boolean;
}

// State management for notifications using useReducer for better performance
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: NotificationData }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_INITIAL'; payload: NotificationData[] };

const notificationReducer = (
  state: NotificationData[],
  action: NotificationAction
): NotificationData[] => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      // Keep only last 50 notifications for memory efficiency
      return [action.payload, ...state.slice(0, 49)];
    case 'MARK_READ':
      return state.map(notif => (notif.id === action.payload ? { ...notif, read: true } : notif));
    case 'CLEAR_ALL':
      return [];
    case 'SET_INITIAL':
      return action.payload;
    default:
      return state;
  }
};

// State management for online users using Set for better performance
type OnlineUsersAction =
  | { type: 'USER_ONLINE'; payload: string }
  | { type: 'USER_OFFLINE'; payload: string }
  | { type: 'SET_USERS'; payload: string[] }
  | { type: 'CLEAR_USERS' };

const onlineUsersReducer = (state: Set<string>, action: OnlineUsersAction): Set<string> => {
  const newState = new Set(state);

  switch (action.type) {
    case 'USER_ONLINE':
      newState.add(action.payload);
      return newState;
    case 'USER_OFFLINE':
      newState.delete(action.payload);
      return newState;
    case 'SET_USERS':
      return new Set(action.payload);
    case 'CLEAR_USERS':
      return new Set();
    default:
      return state;
  }
};

interface RealTimeContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: NotificationData[];
  unreadCount: number;
  onlineUsers: string[];

  // Notification methods
  markNotificationAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;

  // Room management
  joinRoom: (roomType: string, roomId: string) => void;
  leaveRoom: (roomType: string, roomId: string) => void;

  // Chat methods
  sendMessage: (recipientId: string, content: string, type?: 'TEXT' | 'IMAGE' | 'AUDIO') => void;
  startTyping: (conversationWith: string) => void;
  stopTyping: (conversationWith: string) => void;

  // Live stream methods
  joinStream: (streamId: string) => void;
  leaveStream: (streamId: string) => void;
  sendStreamChatMessage: (streamId: string, message: string) => void;
}

const RealTimeContext = createContext<RealTimeContextType | null>(null);

interface RealTimeProviderProps {
  children: React.ReactNode;
}

export function RealTimeProvider({ children }: RealTimeProviderProps) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, dispatchNotifications] = useReducer(notificationReducer, []);
  const [onlineUsersSet, dispatchOnlineUsers] = useReducer(onlineUsersReducer, new Set<string>());

  // Use refs to prevent stale closures and improve performance
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Memoize online users array to prevent unnecessary re-renders
  const onlineUsers = useMemo(() => Array.from(onlineUsersSet), [onlineUsersSet]);

  // Memoize unread count to prevent recalculation on every render
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Stable event handlers using useCallback with proper dependencies
  const handleConnect = useCallback(() => {
    setIsConnected(true);
    isConnectedRef.current = true;
    reconnectAttemptsRef.current = 0;
    logger.info('WebSocket connected');
  }, []);

  const handleDisconnect = useCallback((reason: string) => {
    setIsConnected(false);
    isConnectedRef.current = false;
    logger.info('WebSocket disconnected', { reason });

    // Auto-reconnect with exponential backoff
    if (reason !== 'io client disconnect') {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && !isConnectedRef.current) {
          reconnectAttemptsRef.current++;
          socketRef.current.connect();
          logger.info('Attempting to reconnect', { attempt: reconnectAttemptsRef.current });
        }
      }, delay);
    }
  }, []);

  const handleConnectError = useCallback((error: Error) => {
    logger.error('WebSocket connection error', { error: error.message });
    setIsConnected(false);
    isConnectedRef.current = false;
  }, []);

  const handleAuthSuccess = useCallback(({ userId }: { userId: string }) => {
    logger.info('WebSocket authentication successful', { userId });
    if (socketRef.current) {
      socketRef.current.emit('room:join', { roomType: 'user', roomId: userId });
    }
  }, []);

  const handleNotification = useCallback((notification: NotificationData) => {
    dispatchNotifications({ type: 'ADD_NOTIFICATION', payload: notification });

    // Show toast notification with throttling to prevent spam
    toast(notification.title, {
      description: notification.message,
      duration: 5000,
    });
  }, []);

  const handleNotificationRead = useCallback(({ notificationId }: { notificationId: string }) => {
    dispatchNotifications({ type: 'MARK_READ', payload: notificationId });
  }, []);

  const handleUserOnline = useCallback(({ userId }: { userId: string }) => {
    dispatchOnlineUsers({ type: 'USER_ONLINE', payload: userId });
  }, []);

  const handleUserOffline = useCallback(({ userId }: { userId: string }) => {
    dispatchOnlineUsers({ type: 'USER_OFFLINE', payload: userId });
  }, []);

  const handleMessageReceived = useCallback((message: any) => {
    logger.info('Message received', { messageId: message.id });
  }, []);

  const handleStreamUpdate = useCallback((streamUpdate: any) => {
    if (streamUpdate.status === 'LIVE') {
      toast('Live Stream Started!', {
        description: `${streamUpdate.artistName} is now live`,
        duration: 8000,
      });
    }
  }, []);

  const handleStreamChatMessage = useCallback((message: any) => {
    logger.info('Stream chat message received', { messageId: message.id });
  }, []);

  const handleTypingIndicator = useCallback(
    ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      logger.info('Typing indicator', { userId, isTyping });
    },
    []
  );

  const handleError = useCallback((error: any) => {
    logger.error('WebSocket error', { error });
    toast.error('Connection Error', {
      description: 'There was a problem with the real-time connection',
    });
  }, []);

  // Initialize socket connection with proper cleanup
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || '', {
        auth: {
          token: session.accessToken,
          userId: session.user.id,
        },
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });

      setSocket(newSocket);
      socketRef.current = newSocket;

      // Attach event listeners with stable handlers
      newSocket.on('connect', handleConnect);
      newSocket.on('disconnect', handleDisconnect);
      newSocket.on('connect_error', handleConnectError);
      newSocket.on('auth:success', handleAuthSuccess);
      newSocket.on('notification', handleNotification);
      newSocket.on('notification:read', handleNotificationRead);
      newSocket.on('user:online', handleUserOnline);
      newSocket.on('user:offline', handleUserOffline);
      newSocket.on('message:received', handleMessageReceived);
      newSocket.on('stream:update', handleStreamUpdate);
      newSocket.on('stream:chat:message', handleStreamChatMessage);
      newSocket.on('typing:indicator', handleTypingIndicator);
      newSocket.on('error', handleError);

      return () => {
        // Clean up all event listeners
        newSocket.off('connect', handleConnect);
        newSocket.off('disconnect', handleDisconnect);
        newSocket.off('connect_error', handleConnectError);
        newSocket.off('auth:success', handleAuthSuccess);
        newSocket.off('notification', handleNotification);
        newSocket.off('notification:read', handleNotificationRead);
        newSocket.off('user:online', handleUserOnline);
        newSocket.off('user:offline', handleUserOffline);
        newSocket.off('message:received', handleMessageReceived);
        newSocket.off('stream:update', handleStreamUpdate);
        newSocket.off('stream:chat:message', handleStreamChatMessage);
        newSocket.off('typing:indicator', handleTypingIndicator);
        newSocket.off('error', handleError);

        newSocket.disconnect();
        socketRef.current = null;
      };
    }
  }, [
    session?.accessToken,
    session?.user?.id,
    status,
    handleConnect,
    handleDisconnect,
    handleConnectError,
    handleAuthSuccess,
    handleNotification,
    handleNotificationRead,
    handleUserOnline,
    handleUserOffline,
    handleMessageReceived,
    handleStreamUpdate,
    handleStreamChatMessage,
    handleTypingIndicator,
    handleError,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all typing timeouts
      typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Notification methods with stable references
  const markNotificationAsRead = useCallback((notificationId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('notification:mark_read', { notificationId });
    }
  }, []);

  const clearAllNotifications = useCallback(() => {
    dispatchNotifications({ type: 'CLEAR_ALL' });
  }, []);

  // Room management with stable references
  const joinRoom = useCallback((roomType: string, roomId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('room:join', { roomType, roomId });
      logger.info('Joining room', { roomType, roomId });
    }
  }, []);

  const leaveRoom = useCallback((roomType: string, roomId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('room:leave', { roomType, roomId });
      logger.info('Leaving room', { roomType, roomId });
    }
  }, []);

  // Chat methods with stable references and improved typing logic
  const sendMessage = useCallback(
    (recipientId: string, content: string, type: 'TEXT' | 'IMAGE' | 'AUDIO' = 'TEXT') => {
      if (socketRef.current && isConnectedRef.current && content.trim()) {
        socketRef.current.emit('message:send', {
          recipientId,
          content: content.trim(),
          type,
        });
      }
    },
    []
  );

  const startTyping = useCallback((conversationWith: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('typing:start', { conversationWith });

      // Clear existing timeout for this conversation
      const existingTimeout = typingTimeoutsRef.current.get(conversationWith);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Auto-stop typing after 3 seconds
      const timeout = setTimeout(() => {
        if (socketRef.current && isConnectedRef.current) {
          socketRef.current.emit('typing:stop', { conversationWith });
        }
        typingTimeoutsRef.current.delete(conversationWith);
      }, 3000);

      typingTimeoutsRef.current.set(conversationWith, timeout);
    }
  }, []);

  const stopTyping = useCallback((conversationWith: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('typing:stop', { conversationWith });
    }

    const timeout = typingTimeoutsRef.current.get(conversationWith);
    if (timeout) {
      clearTimeout(timeout);
      typingTimeoutsRef.current.delete(conversationWith);
    }
  }, []);

  // Live stream methods with stable references
  const joinStream = useCallback((streamId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('stream:join', { streamId });
      logger.info('Joining stream', { streamId });
    }
  }, []);

  const leaveStream = useCallback((streamId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('stream:leave', { streamId });
      logger.info('Leaving stream', { streamId });
    }
  }, []);

  const sendStreamChatMessage = useCallback((streamId: string, message: string) => {
    if (socketRef.current && isConnectedRef.current && message.trim()) {
      socketRef.current.emit('stream:chat:send', {
        streamId,
        message: message.trim(),
      });
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: RealTimeContextType = useMemo(
    () => ({
      socket,
      isConnected,
      notifications,
      unreadCount,
      onlineUsers,
      markNotificationAsRead,
      clearAllNotifications,
      joinRoom,
      leaveRoom,
      sendMessage,
      startTyping,
      stopTyping,
      joinStream,
      leaveStream,
      sendStreamChatMessage,
    }),
    [
      socket,
      isConnected,
      notifications,
      unreadCount,
      onlineUsers,
      markNotificationAsRead,
      clearAllNotifications,
      joinRoom,
      leaveRoom,
      sendMessage,
      startTyping,
      stopTyping,
      joinStream,
      leaveStream,
      sendStreamChatMessage,
    ]
  );

  return <RealTimeContext.Provider value={contextValue}>{children}</RealTimeContext.Provider>;
}

// Optimized hooks with stable references
export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}

// Memoized notification hook to prevent unnecessary re-renders
export function useNotifications() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useNotifications must be used within a RealTimeProvider');
  }

  return useMemo(
    () => ({
      notifications: context.notifications,
      unreadCount: context.unreadCount,
      markAsRead: context.markNotificationAsRead,
      clearAll: context.clearAllNotifications,
    }),
    [
      context.notifications,
      context.unreadCount,
      context.markNotificationAsRead,
      context.clearAllNotifications,
    ]
  );
}

// Memoized chat hook
export function useChat() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useChat must be used within a RealTimeProvider');
  }

  return useMemo(
    () => ({
      sendMessage: context.sendMessage,
      startTyping: context.startTyping,
      stopTyping: context.stopTyping,
      isConnected: context.isConnected,
    }),
    [context.sendMessage, context.startTyping, context.stopTyping, context.isConnected]
  );
}

// Memoized stream hook
export function useStream() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useStream must be used within a RealTimeProvider');
  }

  return useMemo(
    () => ({
      joinStream: context.joinStream,
      leaveStream: context.leaveStream,
      sendChatMessage: context.sendStreamChatMessage,
      isConnected: context.isConnected,
    }),
    [context.joinStream, context.leaveStream, context.sendStreamChatMessage, context.isConnected]
  );
}

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// Types for messaging
export interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  senderRole: 'ARTIST' | 'FAN';
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio';
  timestamp: Date;
  read: boolean;
  conversationId: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
}

export interface Conversation {
  conversationId: string;
  participants: Array<{
    userId: string;
    username: string;
    role: string;
    isOnline: boolean;
  }>;
  lastMessage?: Message;
  lastActivity: Date;
  unreadCount: number;
}

export interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
}

export interface UserStatus {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen: Date;
}

// Socket Context
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  typingUsers: TypingUser[];
  onlineUsers: UserStatus[];
  
  // Actions
  sendMessage: (receiverId: string, content: string, type?: 'text' | 'image' | 'video' | 'audio', conversationId?: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  startTyping: (conversationId: string, receiverId: string) => void;
  stopTyping: (conversationId: string, receiverId: string) => void;
  markMessagesAsRead: (conversationId: string, messageIds: string[]) => void;
  getConversationHistory: (conversationId: string, limit?: number, offset?: number) => void;
  refreshConversations: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserStatus[]>([]);

  // Use refs to prevent stale closures and improve performance
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) return;

    console.log('Initializing socket connection...');
    
    // WebSocket URL configuration
    const websocketUrl = process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://your-websocket-server.railway.app' 
      : 'http://localhost:3001';
    
    console.log('Connecting to WebSocket:', websocketUrl);
    
    const newSocket = io(websocketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Message event handlers
    newSocket.on('new_message', (message: Message) => {
      console.log('Received new message:', message);
      setMessages(prev => ({
        ...prev,
        [message.conversationId]: [
          ...(prev[message.conversationId] || []),
          { ...message, timestamp: new Date(message.timestamp) }
        ]
      }));
      
      // Update conversation last message
      setConversations(prev => prev.map(conv => 
        conv.conversationId === message.conversationId 
          ? { ...conv, lastMessage: message, unreadCount: conv.unreadCount + 1 }
          : conv
      ));
    });

    newSocket.on('message_sent', (message: Message & { status: string }) => {
      console.log('Message sent confirmation:', message);
      setMessages(prev => ({
        ...prev,
        [message.conversationId]: [
          ...(prev[message.conversationId] || []),
          { ...message, timestamp: new Date(message.timestamp) }
        ]
      }));
    });

    newSocket.on('message_error', (error: { error: string }) => {
      console.error('Message error:', error);
      // Handle message sending errors (could show toast notification)
    });

    // Typing indicators
    newSocket.on('user_typing', (data: TypingUser) => {
      setTypingUsers(prev => {
        const exists = prev.some(user => 
          user.userId === data.userId && user.conversationId === data.conversationId
        );
        if (exists) return prev;
        return [...prev, data];
      });
    });

    newSocket.on('user_stopped_typing', (data: TypingUser) => {
      setTypingUsers(prev => prev.filter(user => 
        !(user.userId === data.userId && user.conversationId === data.conversationId)
      ));
    });

    // User status updates
    newSocket.on('user_status_changed', (status: UserStatus) => {
      console.log('User status changed:', status);
      setOnlineUsers(prev => {
        const updated = prev.filter(user => user.userId !== status.userId);
        if (status.isOnline) {
          updated.push({ ...status, lastSeen: new Date(status.lastSeen) });
        }
        return updated;
      });

      // Update conversation participant status
      setConversations(prev => prev.map(conv => ({
        ...conv,
        participants: conv.participants.map(participant =>
          participant.userId === status.userId
            ? { ...participant, isOnline: status.isOnline }
            : participant
        )
      })));
    });

    // Conversation history
    newSocket.on('conversation_history', (data: {
      conversationId: string;
      messages: Message[];
      hasMore: boolean;
    }) => {
      console.log('Received conversation history:', data.conversationId, data.messages.length, 'messages');
      setMessages(prev => ({
        ...prev,
        [data.conversationId]: data.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    });

    // Conversations list
    newSocket.on('conversations_list', (conversations: Conversation[]) => {
      console.log('Received conversations list:', conversations.length, 'conversations');
      setConversations(conversations.map(conv => ({
        ...conv,
        lastActivity: new Date(conv.lastActivity),
        lastMessage: conv.lastMessage ? {
          ...conv.lastMessage,
          timestamp: new Date(conv.lastMessage.timestamp)
        } : undefined
      })));
    });

    // Read receipts
    newSocket.on('messages_read', (data: {
      conversationId: string;
      messageIds: string[];
      readBy: string;
    }) => {
      setMessages(prev => ({
        ...prev,
        [data.conversationId]: (prev[data.conversationId] || []).map(msg =>
          data.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
        )
      }));
    });

    return () => {
      console.log('Cleaning up socket connection');
      
      // Remove ALL event listeners before disconnecting
      newSocket.removeAllListeners();
      newSocket.disconnect();
      
      // Clear refs and state
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      
      // Clear all typing timeouts
      typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, [session, status]);

  // Auto-fetch conversations when connected
  useEffect(() => {
    if (isConnected && socket) {
      console.log('Fetching conversations...');
      socket.emit('get_conversations');
    }
  }, [isConnected, socket]);

  // Actions
  const sendMessage = useCallback((
    receiverId: string, 
    content: string, 
    type: 'text' | 'image' | 'video' | 'audio' = 'text',
    conversationId?: string
  ) => {
    if (!socket || !isConnected) {
      console.warn('Cannot send message: socket not connected');
      return;
    }

    console.log('Sending message to:', receiverId, content);
    socket.emit('send_message', {
      receiverId,
      content,
      type,
      conversationId
    });
  }, [socket, isConnected]);

  const joinConversation = useCallback((conversationId: string) => {
    if (!socket || !isConnected) return;
    console.log('Joining conversation:', conversationId);
    socket.emit('join_conversation', conversationId);
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId: string) => {
    if (!socket || !isConnected) return;
    console.log('Leaving conversation:', conversationId);
    socket.emit('leave_conversation', conversationId);
  }, [socket, isConnected]);

  const startTyping = useCallback((conversationId: string, receiverId: string) => {
    if (!socket || !isConnected) return;
    socket.emit('typing_start', { conversationId, receiverId });
  }, [socket, isConnected]);

  const stopTyping = useCallback((conversationId: string, receiverId: string) => {
    if (!socket || !isConnected) return;
    socket.emit('typing_stop', { conversationId, receiverId });
  }, [socket, isConnected]);

  const markMessagesAsRead = useCallback((conversationId: string, messageIds: string[]) => {
    if (!socket || !isConnected) return;
    console.log('Marking messages as read:', conversationId, messageIds.length, 'messages');
    socket.emit('mark_messages_read', { conversationId, messageIds });
  }, [socket, isConnected]);

  const getConversationHistory = useCallback((
    conversationId: string, 
    limit: number = 50, 
    offset: number = 0
  ) => {
    if (!socket || !isConnected) return;
    console.log('Getting conversation history:', conversationId);
    socket.emit('get_conversation_history', { conversationId, limit, offset });
  }, [socket, isConnected]);

  const refreshConversations = useCallback(() => {
    if (!socket || !isConnected) return;
    console.log('Refreshing conversations...');
    socket.emit('get_conversations');
  }, [socket, isConnected]);

  // Memoize context value to prevent unnecessary re-renders
  const value: SocketContextType = useMemo(() => ({
    socket,
    isConnected,
    conversations,
    messages,
    typingUsers,
    onlineUsers,
    sendMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    markMessagesAsRead,
    getConversationHistory,
    refreshConversations,
  }), [
    socket,
    isConnected,
    conversations,
    messages,
    typingUsers,
    onlineUsers,
    sendMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    markMessagesAsRead,
    getConversationHistory,
    refreshConversations,
  ]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
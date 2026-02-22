import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'cookie';
import { setupStreamingSignaling } from './streaming/webrtc-signaling-server';
import { initializeStreamingWebSocket } from './streaming-websocket';

let io: Server | null = null;

// Import Socket type from socket.io
import type { Socket } from 'socket.io';

// User sessions management
const userSessions = new Map<string, {
  userId: string;
  username: string;
  role: 'ARTIST' | 'FAN';
  socketId: string;
  lastSeen: Date;
  isOnline: boolean;
}>();

// Active conversations
const activeConversations = new Map<string, {
  participants: string[];
  messages: Array<{
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'audio';
    timestamp: Date;
    read: boolean;
  }>;
  lastActivity: Date;
}>();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: 'ARTIST' | 'FAN';
}

export function initializeSocket(server: any) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL 
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const cookies = parse(socket.handshake.headers.cookie || '');
      const token = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token'];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // In a real implementation, you would verify the JWT token
      // For now, we'll use a simple demo authentication
      const mockUser = {
        id: `user_${Math.random().toString(36).substr(2, 9)}`,
        username: `User${Math.floor(Math.random() * 1000)}`,
        role: Math.random() > 0.5 ? 'ARTIST' : 'FAN' as 'ARTIST' | 'FAN',
      };

      socket.userId = mockUser.id;
      socket.username = mockUser.username;
      socket.role = mockUser.role;
      
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: any) => {
    console.log(`User connected: ${socket.username} (${socket.role})`);

    // Register user session
    userSessions.set(socket.userId, {
      userId: socket.userId,
      username: socket.username,
      role: socket.role,
      socketId: socket.id,
      lastSeen: new Date(),
      isOnline: true,
    });

    // Join user to their personal room
    socket.join(socket.userId);

    // Broadcast online status to relevant users
    broadcastUserStatus(socket.userId, true);

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`${socket.username} joined conversation: ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`${socket.username} left conversation: ${conversationId}`);
    });

    // Handle sending messages
    socket.on('send_message', async (data: {
      receiverId: string;
      content: string;
      type: 'text' | 'image' | 'video' | 'audio';
      conversationId?: string;
    }) => {
      try {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conversationId = data.conversationId || generateConversationId(socket.userId, data.receiverId);
        
        const message = {
          id: messageId,
          senderId: socket.userId,
          senderUsername: socket.username,
          senderRole: socket.role,
          receiverId: data.receiverId,
          content: data.content,
          type: data.type,
          timestamp: new Date(),
          read: false,
          conversationId,
        };

        // Store message in conversation
        if (!activeConversations.has(conversationId)) {
          activeConversations.set(conversationId, {
            participants: [socket.userId, data.receiverId],
            messages: [],
            lastActivity: new Date(),
          });
        }

        const conversation = activeConversations.get(conversationId)!;
        conversation.messages.push({
          id: messageId,
          senderId: socket.userId,
          receiverId: data.receiverId,
          content: data.content,
          type: data.type,
          timestamp: new Date(),
          read: false,
        });
        conversation.lastActivity = new Date();

        // Send message to sender (confirmation)
        socket.emit('message_sent', {
          ...message,
          status: 'sent',
        });

        // Send message to receiver
        io?.to(data.receiverId).emit('new_message', message);

        // Send to conversation room (for group chats in future)
        socket.to(`conversation_${conversationId}`).emit('new_message', message);

        console.log(`Message sent from ${socket.username} to ${data.receiverId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string; receiverId: string }) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string; receiverId: string }) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId,
      });
    });

    // Handle message read receipts
    socket.on('mark_messages_read', (data: { conversationId: string; messageIds: string[] }) => {
      const conversation = activeConversations.get(data.conversationId);
      if (conversation) {
        conversation.messages.forEach(msg => {
          if (data.messageIds.includes(msg.id) && msg.receiverId === socket.userId) {
            msg.read = true;
          }
        });

        // Notify sender that messages were read
        const senderIds = [...new Set(
          conversation.messages
            .filter(msg => data.messageIds.includes(msg.id))
            .map(msg => msg.senderId)
        )];
        
        senderIds.forEach(senderId => {
          if (senderId !== socket.userId) {
            io?.to(senderId).emit('messages_read', {
              conversationId: data.conversationId,
              messageIds: data.messageIds,
              readBy: socket.userId,
            });
          }
        });
      }
    });

    // Handle getting conversation history
    socket.on('get_conversation_history', (data: { conversationId: string; limit?: number; offset?: number }) => {
      const conversation = activeConversations.get(data.conversationId);
      if (conversation) {
        const limit = data.limit || 50;
        const offset = data.offset || 0;
        const messages = conversation.messages
          .slice(-(limit + offset))
          .slice(-limit)
          .map(msg => ({
            ...msg,
            senderUsername: userSessions.get(msg.senderId)?.username || 'Unknown User',
            senderRole: userSessions.get(msg.senderId)?.role || 'FAN',
          }));

        socket.emit('conversation_history', {
          conversationId: data.conversationId,
          messages,
          hasMore: conversation.messages.length > limit + offset,
        });
      } else {
        socket.emit('conversation_history', {
          conversationId: data.conversationId,
          messages: [],
          hasMore: false,
        });
      }
    });

    // Handle getting user conversations list
    socket.on('get_conversations', () => {
      const userConversations: Array<{
        conversationId: string;
        participants: Array<{ userId: string; username: string; role: string; isOnline: boolean }>;
        lastMessage?: any;
        lastActivity: Date;
        unreadCount: number;
      }> = [];

      activeConversations.forEach((conversation, conversationId) => {
        if (conversation.participants.includes(socket.userId)) {
          const otherParticipants = conversation.participants
            .filter(id => id !== socket.userId)
            .map(id => {
              const session = userSessions.get(id);
              return {
                userId: id,
                username: session?.username || 'Unknown User',
                role: session?.role || 'FAN',
                isOnline: session?.isOnline || false,
              };
            });

          const lastMessage = conversation.messages[conversation.messages.length - 1];
          const unreadCount = conversation.messages.filter(
            msg => msg.receiverId === socket.userId && !msg.read
          ).length;

          userConversations.push({
            conversationId,
            participants: otherParticipants,
            lastMessage: lastMessage ? {
              ...lastMessage,
              senderUsername: userSessions.get(lastMessage.senderId)?.username || 'Unknown User',
            } : undefined,
            lastActivity: conversation.lastActivity,
            unreadCount,
          });
        }
      });

      // Sort by last activity
      userConversations.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

      socket.emit('conversations_list', userConversations);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      
      // Update user session
      const session = userSessions.get(socket.userId);
      if (session) {
        session.isOnline = false;
        session.lastSeen = new Date();
      }

      // Broadcast offline status
      broadcastUserStatus(socket.userId, false);
    });
  });

  // Initialize streaming signaling
  setupStreamingSignaling(io);

  // Initialize streaming WebSocket with authentication
  initializeStreamingWebSocket(io);
  
  return io;
}

// Helper functions
function generateConversationId(userId1: string, userId2: string): string {
  return `conv_${[userId1, userId2].sort().join('_')}`;
}

function broadcastUserStatus(userId: string, isOnline: boolean) {
  const session = userSessions.get(userId);
  if (!session) return;

  // Find all conversations this user is part of
  activeConversations.forEach((conversation, conversationId) => {
    if (conversation.participants.includes(userId)) {
      // Broadcast to other participants
      conversation.participants.forEach(participantId => {
        if (participantId !== userId) {
          io?.to(participantId).emit('user_status_changed', {
            userId,
            username: session.username,
            isOnline,
            lastSeen: session.lastSeen,
          });
        }
      });
    }
  });
}

export function getActiveUsers() {
  return Array.from(userSessions.values()).filter(session => session.isOnline);
}

export function getUserSession(userId: string) {
  return userSessions.get(userId);
}

export function getConversation(conversationId: string) {
  return activeConversations.get(conversationId);
}

export { io };
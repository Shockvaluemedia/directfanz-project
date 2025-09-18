import { Server as SocketIOServer, Socket } from 'socket.io';
import { getToken } from 'next-auth/jwt';
import { prisma } from './prisma';
import { logger } from './logger';
import { WebRTCHandler } from './webrtc-handler';
import {
  createConversationId,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type User,
  type Message,
} from '../types/websocket';

export class WebSocketHandler {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private onlineUsers = new Map<string, { socketId: string; lastSeen: Date; user: User }>();
  private typingUsers = new Map<string, { userId: string; displayName: string; timestamp: number }>();
  private webrtcHandler: WebRTCHandler;

  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    this.io = io;
    this.webrtcHandler = new WebRTCHandler(io);
  }

  initialize() {
    this.io.use(async (socket, next) => {
      try {
        // Extract token from handshake
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token using Next-Auth  
        // Create a mock request object for getToken
        const mockReq = {
          headers: {
            authorization: `Bearer ${token}`,
            cookie: '',
          },
          cookies: {},
        } as any;
        
        const decoded = await getToken({
          req: mockReq,
          secret: process.env.NEXTAUTH_SECRET!,
        });

        if (!decoded || !decoded.id) {
          return next(new Error('Invalid authentication token'));
        }

        // Fetch user data from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id as string },
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
          },
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user data to socket
        socket.data.userId = user.id;
        socket.data.user = user as User;
        socket.data.activeConversations = new Set();
        socket.data.lastSeen = new Date();

        next();
      } catch (error) {
        logger.error('Socket authentication error', {}, error as Error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Clean up typing indicators periodically
    setInterval(() => {
      this.cleanupTypingIndicators();
    }, 5000);
  }

  private handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { userId, user } = socket.data;

    logger.info('User connected to WebSocket', { userId, socketId: socket.id });

    // Add user to online users
    this.onlineUsers.set(userId, {
      socketId: socket.id,
      lastSeen: new Date(),
      user,
    });

    // Emit user online status
    socket.broadcast.emit('user:online', {
      userId,
      lastSeen: new Date().toISOString(),
    });

    // Confirm authentication success
    socket.emit('auth:success', { userId });

    // Handle message sending
    socket.on('message:send', async (data) => {
      try {
        await this.handleSendMessage(socket, data);
      } catch (error) {
        logger.error('Error sending message:', { userId, error });
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle message read status
    socket.on('message:mark_read', async (data) => {
      try {
        await this.handleMarkMessageRead(socket, data);
      } catch (error) {
        logger.error('Error marking message as read:', { userId, error });
        socket.emit('error', 'Failed to mark message as read');
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing:stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle conversation room management
    socket.on('conversation:join', (data) => {
      const conversationId = createConversationId(userId, data.conversationWith);
      socket.join(conversationId);
      socket.data.activeConversations.add(conversationId);
      
      logger.info('User joined conversation', { userId, conversationId });
    });

    socket.on('conversation:leave', (data) => {
      const conversationId = createConversationId(userId, data.conversationWith);
      socket.leave(conversationId);
      socket.data.activeConversations.delete(conversationId);
      
      logger.info('User left conversation', { userId, conversationId });
    });

    // Handle presence updates
    socket.on('presence:update', () => {
      const onlineUser = this.onlineUsers.get(userId);
      if (onlineUser) {
        onlineUser.lastSeen = new Date();
        socket.data.lastSeen = new Date();
      }
    });

    // Initialize WebRTC handlers for this socket
    this.webrtcHandler.initializeWebRTCHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  private async handleSendMessage(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { recipientId: string; content: string; type?: 'TEXT' | 'IMAGE' | 'AUDIO'; attachmentUrl?: string }
  ) {
    const { userId } = socket.data;
    
    // Basic validation
    if (!data.recipientId || !data.content.trim()) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipientId },
      select: { id: true, displayName: true, role: true, notificationPreferences: true },
    });

    if (!recipient) {
      socket.emit('error', 'Recipient not found');
      return;
    }

    // Create message in database
    const message = await prisma.message.create({
      data: {
        senderId: userId,
        recipientId: data.recipientId,
        content: data.content.trim(),
        type: data.type || 'TEXT',
        attachmentUrl: data.attachmentUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    const conversationId = createConversationId(userId, data.recipientId);

    // Emit to conversation room (both sender and recipient if online)
    this.io.to(conversationId).emit('message:new', {
      ...message,
      sender: message.sender as User,
    });

    // Emit delivered event if recipient is online
    const recipientOnline = this.onlineUsers.get(data.recipientId);
    if (recipientOnline) {
      this.io.to(conversationId).emit('message:delivered', {
        messageId: message.id,
        deliveredAt: new Date().toISOString(),
      });
    }

    logger.info('Message sent', {
      messageId: message.id,
      senderId: userId,
      recipientId: data.recipientId,
    });
  }

  private async handleMarkMessageRead(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { messageId: string }
  ) {
    const { userId } = socket.data;

    const message = await prisma.message.findUnique({
      where: { id: data.messageId },
      select: { id: true, senderId: true, recipientId: true },
    });

    if (!message) {
      socket.emit('error', 'Message not found');
      return;
    }

    // Only recipient can mark message as read
    if (message.recipientId !== userId) {
      socket.emit('error', 'Unauthorized to mark this message as read');
      return;
    }

    // Update message read status
    const readAt = new Date();
    await prisma.message.update({
      where: { id: data.messageId },
      data: { readAt },
    });

    const conversationId = createConversationId(message.senderId, message.recipientId);

    // Notify sender about read status
    this.io.to(conversationId).emit('message:read', {
      messageId: data.messageId,
      readAt: readAt.toISOString(),
      readBy: userId,
    });

    logger.info('Message marked as read', {
      messageId: data.messageId,
      readBy: userId,
    });
  }

  private handleTypingStart(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { conversationWith: string }
  ) {
    const { userId, user } = socket.data;
    const conversationId = createConversationId(userId, data.conversationWith);

    // Store typing indicator
    this.typingUsers.set(`${conversationId}:${userId}`, {
      userId,
      displayName: user.displayName,
      timestamp: Date.now(),
    });

    // Emit to conversation room
    socket.to(conversationId).emit('typing:start', {
      userId,
      displayName: user.displayName,
      conversationId,
    });
  }

  private handleTypingStop(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { conversationWith: string }
  ) {
    const { userId } = socket.data;
    const conversationId = createConversationId(userId, data.conversationWith);

    // Remove typing indicator
    this.typingUsers.delete(`${conversationId}:${userId}`);

    // Emit to conversation room
    socket.to(conversationId).emit('typing:stop', {
      userId,
      conversationId,
    });
  }

  private handleDisconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { userId } = socket.data;

    logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });

    // Handle WebRTC stream disconnection
    this.webrtcHandler.handleStreamDisconnect(socket);

    // Remove from online users
    this.onlineUsers.delete(userId);

    // Note: lastSeenAt field would need to be added to User schema if needed
    // For now, we just track disconnection without persisting to database

    // Clear typing indicators for this user
    Array.from(this.typingUsers.keys()).forEach(key => {
      if (key.includes(userId)) {
        this.typingUsers.delete(key);
      }
    });

    // Emit user offline status
    socket.broadcast.emit('user:offline', {
      userId,
      lastSeen: new Date().toISOString(),
    });
  }

  private cleanupTypingIndicators() {
    const now = Date.now();
    const TYPING_TIMEOUT = 10000; // 10 seconds

    Array.from(this.typingUsers.entries()).forEach(([key, typingData]) => {
      if (now - typingData.timestamp > TYPING_TIMEOUT) {
        this.typingUsers.delete(key);
        
        // Emit typing stop
        const [conversationId] = key.split(':');
        this.io.to(conversationId).emit('typing:stop', {
          userId: typingData.userId,
          conversationId,
        });
      }
    });
  }

  // Public methods for external use (e.g., from API routes)
  public emitToUser(userId: string, event: keyof ServerToClientEvents, data: any) {
    const onlineUser = this.onlineUsers.get(userId);
    if (onlineUser) {
      this.io.to(onlineUser.socketId).emit(event as any, data);
    }
  }

  public emitToConversation(userId1: string, userId2: string, event: keyof ServerToClientEvents, data: any) {
    const conversationId = createConversationId(userId1, userId2);
    this.io.to(conversationId).emit(event as any, data);
  }

  public getOnlineUsers(): User[] {
    return Array.from(this.onlineUsers.values()).map(({ user }) => user);
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  // WebRTC public methods
  public getConnectedViewers(streamId: string): number {
    return this.webrtcHandler.getConnectedViewers(streamId);
  }

  public isStreamLive(streamId: string): boolean {
    return this.webrtcHandler.isStreamLive(streamId);
  }
}


#!/usr/bin/env node

/**
 * DirectFanZ WebSocket Server optimized for AWS ECS deployment
 * Supports sticky sessions with ALB and graceful shutdown
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { isRunningInECS, loadAWSConfiguration, getContainerHealth } from './aws-config';
import { logger } from './logger';

const port = parseInt(process.env.WEBSOCKET_PORT || process.env.PORT || '3001', 10);
const hostname = isRunningInECS() ? '0.0.0.0' : 'localhost';

// Store active streams and their connections
const activeStreams = new Map();
const streamingSessions = new Map();

// Store messaging data
const userSessions = new Map();
const activeConversations = new Map();

// Load demo data
const loadDemoData = () => {
  try {
    // Import demo data dynamically to avoid build issues
    const demoData = require('../../init-demo-conversations.js');
    
    // Initialize demo conversations
    demoData.demoConversations.forEach((conv: any) => {
      activeConversations.set(conv.id, {
        participants: conv.participants,
        messages: conv.messages,
        lastActivity: new Date(),
      });
    });
    
    logger.info('🎭 Demo conversations loaded', { count: demoData.demoConversations.length });
  } catch (error) {
    logger.warn('⚠️ Demo data not loaded', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Create HTTP server with health check support
const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  
  // Health check endpoints for ALB
  if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/healthz') {
    handleHealthCheck(req, res);
    return;
  }
  
  // Default response
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server Running');
});

// Health check handler optimized for ALB
const handleHealthCheck = async (req: any, res: any) => {
  try {
    const isALBHealthCheck = req.headers['user-agent']?.includes('ELB-HealthChecker') ||
                            req.url?.includes('source=alb');

    if (isALBHealthCheck) {
      // Simple ALB health check
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'DirectFanZ WebSocket Server'
      }));
    } else {
      // Detailed health check
      const health = await getContainerHealth();
      const status = health.status === 'healthy' ? 200 : 503;
      
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'DirectFanZ WebSocket Server',
        checks: health.checks,
        connections: {
          streaming: streamingSessions.size,
          messaging: userSessions.size,
          activeStreams: activeStreams.size,
        }
      }));
    }
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }));
  }
};

// Create Socket.IO server with ALB sticky session support
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "https://www.directfanz.io", 
      "https://*.vercel.app",
      // Add ALB and CloudFront origins
      process.env.ALB_DNS_NAME ? `https://${process.env.ALB_DNS_NAME}` : null,
      process.env.CLOUDFRONT_DOMAIN ? `https://${process.env.CLOUDFRONT_DOMAIN}` : null,
    ].filter(Boolean),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  // Enable sticky sessions for ALB
  cookie: {
    name: 'io',
    httpOnly: true,
    sameSite: 'lax',
  },
  // Connection state recovery for better reliability
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// Initialize server
const initializeServer = async () => {
  // Load AWS configuration if running in ECS
  if (process.env.NODE_ENV === 'production' && isRunningInECS()) {
    try {
      logger.info('Loading AWS configuration from Parameter Store...');
      const config = await loadAWSConfiguration();
      
      // Set environment variables from Parameter Store
      if (config.redisUrl) process.env.REDIS_URL = config.redisUrl;
      if (config.databaseUrl) process.env.DATABASE_URL = config.databaseUrl;
      
      logger.info('AWS configuration loaded successfully');
    } catch (error) {
      logger.warn('Failed to load AWS configuration, using environment variables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Load demo data
  loadDemoData();
};

// Create streaming namespace
const streamingNamespace = io.of('/streaming');

// Create main namespace for messaging
const mainNamespace = io.of('/');

// Setup main messaging handlers
mainNamespace.on('connection', (socket) => {
  logger.info('✅ Messaging client connected', { socketId: socket.id });

  // Store user session (mock auth for now)
  const mockUser = {
    id: `user_${Math.random().toString(36).substr(2, 9)}`,
    username: `User${Math.floor(Math.random() * 1000)}`,
    role: Math.random() > 0.5 ? 'ARTIST' : 'FAN',
  };
  
  userSessions.set(socket.id, {
    userId: mockUser.id,
    username: mockUser.username,
    role: mockUser.role,
    socketId: socket.id,
    lastSeen: new Date(),
    isOnline: true,
  });

  // Join user to their personal room
  socket.join(mockUser.id);

  // Handle joining conversation rooms
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    logger.debug(`💬 ${mockUser.username} joined conversation: ${conversationId}`);
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    logger.debug(`👋 ${mockUser.username} left conversation: ${conversationId}`);
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const conversationId = data.conversationId || generateConversationId(mockUser.id, data.receiverId);
      
      const message = {
        id: messageId,
        senderId: mockUser.id,
        senderUsername: mockUser.username,
        senderRole: mockUser.role,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || 'text',
        timestamp: new Date(),
        read: false,
        conversationId,
        status: 'sent'
      };

      // Store message in conversation
      if (!activeConversations.has(conversationId)) {
        activeConversations.set(conversationId, {
          participants: [mockUser.id, data.receiverId],
          messages: [],
          lastActivity: new Date(),
        });
      }

      const conversation = activeConversations.get(conversationId);
      conversation.messages.push(message);
      conversation.lastActivity = new Date();

      // Send message confirmation to sender
      socket.emit('message_sent', {
        ...message,
        status: 'sent',
      });

      // Send message to receiver
      mainNamespace.to(data.receiverId).emit('new_message', message);

      // Send to conversation room
      socket.to(`conversation_${conversationId}`).emit('new_message', message);

      logger.debug(`💬 Message sent from ${mockUser.username} to ${data.receiverId}`);
    } catch (error) {
      logger.error('❌ Error sending message', { error: error instanceof Error ? error.message : 'Unknown error' });
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      userId: mockUser.id,
      username: mockUser.username,
      conversationId: data.conversationId,
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_stopped_typing', {
      userId: mockUser.id,
      username: mockUser.username,
      conversationId: data.conversationId,
    });
  });

  // Handle message read receipts
  socket.on('mark_messages_read', (data) => {
    const conversation = activeConversations.get(data.conversationId);
    if (conversation) {
      conversation.messages.forEach((msg: any) => {
        if (data.messageIds.includes(msg.id) && msg.receiverId === mockUser.id) {
          msg.read = true;
        }
      });

      // Notify sender that messages were read
      const senderIds = [...new Set(
        conversation.messages
          .filter((msg: any) => data.messageIds.includes(msg.id))
          .map((msg: any) => msg.senderId)
      )];
      
      senderIds.forEach(senderId => {
        if (senderId !== mockUser.id) {
          mainNamespace.to(senderId).emit('messages_read', {
            conversationId: data.conversationId,
            messageIds: data.messageIds,
            readBy: mockUser.id,
          });
        }
      });
    }
  });

  // Handle getting conversation history
  socket.on('get_conversation_history', (data) => {
    const conversation = activeConversations.get(data.conversationId);
    if (conversation) {
      const limit = data.limit || 50;
      const offset = data.offset || 0;
      const messages = conversation.messages
        .slice(-(limit + offset))
        .slice(-limit);

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
    const userConversations: any[] = [];

    activeConversations.forEach((conversation, conversationId) => {
      if (conversation.participants.includes(mockUser.id)) {
        const otherParticipants = conversation.participants
          .filter((id: string) => id !== mockUser.id)
          .map((id: string) => {
            const session = Array.from(userSessions.values()).find((s: any) => s.userId === id);
            return {
              userId: id,
              username: session?.username || 'Unknown User',
              role: session?.role || 'FAN',
              isOnline: session?.isOnline || false,
            };
          });

        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const unreadCount = conversation.messages.filter(
          (msg: any) => msg.receiverId === mockUser.id && !msg.read
        ).length;

        userConversations.push({
          conversationId,
          participants: otherParticipants,
          lastMessage,
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
    const session = userSessions.get(socket.id);
    if (session) {
      session.isOnline = false;
      session.lastSeen = new Date();
      
      // Broadcast offline status
      broadcastUserStatus(session.userId, false);
    }
    
    logger.info('❌ Messaging client disconnected', { socketId: socket.id });
  });
});

// Setup streaming handlers (similar to existing websocket-server.js but optimized for ECS)
streamingNamespace.on('connection', (socket) => {
  logger.info('✅ Streaming client connected', { socketId: socket.id });

  // Handle stream room joining
  socket.on('stream:join', async (data) => {
    try {
      const { streamId, isOwner, userId } = data;
      
      socket.streamId = streamId;
      socket.userId = userId;
      socket.role = isOwner ? 'BROADCASTER' : 'VIEWER';
      
      // Join stream room
      socket.join(`stream:${streamId}`);
      
      // Store session
      streamingSessions.set(socket.id, {
        userId: userId || 'anonymous',
        socketId: socket.id,
        role: socket.role,
        streamId,
        lastSeen: new Date(),
      });
      
      if (isOwner) {
        // Handle broadcaster joining
        if (activeStreams.has(streamId)) {
          const stream = activeStreams.get(streamId);
          stream.broadcasterSocket = socket.id;
          stream.status = 'STARTING';
        } else {
          // Create new stream session
          activeStreams.set(streamId, {
            streamId,
            broadcasterId: userId || 'anonymous',
            broadcasterSocket: socket.id,
            viewers: new Set(),
            startTime: new Date(),
            status: 'STARTING',
          });
        }
        
        socket.emit('broadcaster-ready');
        logger.info('🎥 Broadcaster joined', { streamId });
        
      } else {
        // Handle viewer joining
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers.add(socket.id);
          
          // Notify broadcaster about new viewer
          streamingNamespace.to(stream.broadcasterSocket).emit('viewer-joined', {
            viewerId: socket.id,
            totalViewers: stream.viewers.size,
          });
          
          // Update viewer count for all viewers
          streamingNamespace.to(`stream:${streamId}`).emit('viewer-count-update', {
            count: stream.viewers.size,
          });
          
          // If broadcaster is already live, notify viewer
          if (stream.status === 'LIVE') {
            socket.emit('broadcaster-available');
          }
          
          logger.info('👀 Viewer joined', { streamId, totalViewers: stream.viewers.size });
        } else {
          socket.emit('stream-not-found');
        }
      }
    } catch (error) {
      logger.error('❌ Error joining stream', { error: error instanceof Error ? error.message : 'Unknown error' });
      socket.emit('stream-join-error', { error: 'Failed to join stream' });
    }
  });

  // Handle broadcaster ready event
  socket.on('broadcaster-ready', () => {
    const streamId = socket.streamId;
    if (streamId && socket.role === 'BROADCASTER') {
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.status = 'LIVE';
        socket.to(`stream:${streamId}`).emit('broadcaster-available');
        streamingNamespace.to(`stream:${streamId}`).emit('stream-started');
        logger.info('🔴 Broadcaster ready', { streamId });
      }
    }
  });

  // Handle stream requests
  socket.on('request-stream', () => {
    const streamId = socket.streamId;
    if (streamId && socket.role === 'VIEWER') {
      const stream = activeStreams.get(streamId);
      if (stream && stream.status === 'LIVE') {
        streamingNamespace.to(stream.broadcasterSocket).emit('stream-request', {
          viewerId: socket.id,
        });
        logger.debug('📡 Stream requested', { streamId, viewerId: socket.id });
      } else {
        socket.emit('stream-not-available');
      }
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const { offer, targetId } = data;
    streamingNamespace.to(targetId).emit('offer', {
      offer,
      senderId: socket.id,
    });
  });

  socket.on('answer', (data) => {
    const { answer, targetId } = data;
    streamingNamespace.to(targetId).emit('answer', {
      answer,
      senderId: socket.id,
    });
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, targetId } = data;
    streamingNamespace.to(targetId).emit('ice-candidate', {
      candidate,
      senderId: socket.id,
    });
  });

  // Handle stream control
  socket.on('start-stream', () => {
    const streamId = socket.streamId;
    if (streamId && socket.role === 'BROADCASTER') {
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.status = 'LIVE';
        streamingNamespace.to(`stream:${streamId}`).emit('stream-started');
        logger.info('🎬 Stream started', { streamId });
      }
    }
  });

  socket.on('stop-stream', () => {
    const streamId = socket.streamId;
    if (streamId && socket.role === 'BROADCASTER') {
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.status = 'ENDED';
        streamingNamespace.to(`stream:${streamId}`).emit('stream-ended');
        activeStreams.delete(streamId);
        logger.info('⏹️ Stream ended', { streamId });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const session = streamingSessions.get(socket.id);
    if (session) {
      const { streamId, role } = session;
      
      if (role === 'BROADCASTER' && streamId) {
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.status = 'ENDED';
          streamingNamespace.to(`stream:${streamId}`).emit('broadcaster-left');
          activeStreams.delete(streamId);
          logger.info('📴 Broadcaster disconnected - stream ended', { streamId });
        }
      } else if (role === 'VIEWER' && streamId) {
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers.delete(socket.id);
          streamingNamespace.to(`stream:${streamId}`).emit('viewer-count-update', {
            count: stream.viewers.size,
          });
          logger.debug('👋 Viewer left', { streamId, remaining: stream.viewers.size });
        }
      }
      
      streamingSessions.delete(socket.id);
    }
    
    logger.info('❌ Streaming client disconnected', { socketId: socket.id });
  });
});

// Graceful shutdown handling for ECS
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close all socket connections
    io.close(() => {
      logger.info('Socket.IO server closed');
      process.exit(0);
    });
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    await initializeServer();
    
    server.listen(port, hostname, () => {
      logger.info('🚀 DirectFanZ WebSocket Server running', { 
        port, 
        hostname,
        environment: process.env.NODE_ENV,
        isECS: isRunningInECS()
      });
      logger.info('📡 Streaming namespace: /streaming');
      logger.info('💬 Messaging namespace: /');
      logger.info('🎥 Ready for live streaming and messaging!');
      
      if (isRunningInECS()) {
        logger.info('🐳 Running in AWS ECS environment with ALB sticky session support');
      }
    });
  } catch (error) {
    logger.error('Failed to start WebSocket server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
};

// Helper functions
function generateConversationId(userId1: string, userId2: string): string {
  return `conv_${[userId1, userId2].sort().join('_')}`;
}

function broadcastUserStatus(userId: string, isOnline: boolean): void {
  const session = Array.from(userSessions.values()).find((s: any) => s.userId === userId);
  if (!session) return;

  // Find all conversations this user is part of
  activeConversations.forEach((conversation, conversationId) => {
    if (conversation.participants.includes(userId)) {
      // Broadcast to other participants
      conversation.participants.forEach((participantId: string) => {
        if (participantId !== userId) {
          mainNamespace.to(participantId).emit('user_status_changed', {
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

// Start the server
startServer();

export { server, io, streamingNamespace, mainNamespace };
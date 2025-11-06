#!/usr/bin/env node

/**
 * DirectFanZ WebSocket Development Server
 * Run this locally for WebRTC streaming development
 * Usage: node websocket-server.js
 */

import { createServer } from 'http';
import { Server } from 'socket.io';

const port = process.env.WEBSOCKET_PORT || 3001;

// Create HTTP server
const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DirectFanZ WebSocket Server'
    }));
    return;
  }
  
  // Default response
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server Running');
});

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://www.directfanz.io", "https://*.vercel.app"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Store active streams and their connections
const activeStreams = new Map();
const streamingSessions = new Map();

// Store messaging data
const userSessions = new Map();
const activeConversations = new Map();

// Load demo data
try {
  const demoData = require('./init-demo-conversations.js');
  
  // Initialize demo conversations
  demoData.demoConversations.forEach(conv => {
    activeConversations.set(conv.id, {
      participants: conv.participants,
      messages: conv.messages,
      lastActivity: new Date(),
    });
  });
  
  console.log('🎭 Demo conversations loaded:', demoData.demoConversations.length);
} catch (error) {
  console.log('⚠️ Demo data not loaded:', error.message);
}

// Create streaming namespace
const streamingNamespace = io.of('/streaming');

// Create main namespace for messaging
const mainNamespace = io.of('/');

// Setup main messaging handlers
mainNamespace.on('connection', (socket) => {
  console.log('✅ Messaging client connected:', socket.id);

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
    console.log(`💬 ${mockUser.username} joined conversation: ${conversationId}`);
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`👋 ${mockUser.username} left conversation: ${conversationId}`);
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

      console.log(`💬 Message sent from ${mockUser.username} to ${data.receiverId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
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
      conversation.messages.forEach(msg => {
        if (data.messageIds.includes(msg.id) && msg.receiverId === mockUser.id) {
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
    const userConversations = [];

    activeConversations.forEach((conversation, conversationId) => {
      if (conversation.participants.includes(mockUser.id)) {
        const otherParticipants = conversation.participants
          .filter(id => id !== mockUser.id)
          .map(id => {
            const session = Array.from(userSessions.values()).find(s => s.userId === id);
            return {
              userId: id,
              username: session?.username || 'Unknown User',
              role: session?.role || 'FAN',
              isOnline: session?.isOnline || false,
            };
          });

        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const unreadCount = conversation.messages.filter(
          msg => msg.receiverId === mockUser.id && !msg.read
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
    
    console.log('❌ Messaging client disconnected:', socket.id);
  });
});

streamingNamespace.on('connection', (socket) => {
  console.log('✅ Streaming client connected:', socket.id);

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
        console.log('🎥 Broadcaster joined:', streamId);
        
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
          
          console.log('👀 Viewer joined:', streamId, 'Total viewers:', stream.viewers.size);
        } else {
          socket.emit('stream-not-found');
        }
      }
    } catch (error) {
      console.error('❌ Error joining stream:', error);
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
        console.log('🔴 Broadcaster ready:', streamId);
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
        console.log('📡 Stream requested:', streamId, 'from viewer:', socket.id);
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
        console.log('🎬 Stream started:', streamId);
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
        console.log('⏹️ Stream ended:', streamId);
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
          console.log('📴 Broadcaster disconnected - stream ended:', streamId);
        }
      } else if (role === 'VIEWER' && streamId) {
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers.delete(socket.id);
          streamingNamespace.to(`stream:${streamId}`).emit('viewer-count-update', {
            count: stream.viewers.size,
          });
          console.log('👋 Viewer left:', streamId, 'Remaining:', stream.viewers.size);
        }
      }
      
      streamingSessions.delete(socket.id);
    }
    
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Start server
server.listen(port, () => {
  console.log('🚀 DirectFanZ WebSocket Server running on port', port);
  console.log('📡 Streaming namespace: /streaming');
  console.log('🌐 CORS origins: localhost:3000, directfanz.io, *.vercel.app');
  console.log('🎥 Ready for live streaming!');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('⚠️ Shutting down WebSocket server...');
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('⚠️ Shutting down WebSocket server...');
  server.close(() => {
    console.log('✅ WebSocket server closed');  
    process.exit(0);
  });
});

// Helper functions
function generateConversationId(userId1, userId2) {
  return `conv_${[userId1, userId2].sort().join('_')}`;
}

function broadcastUserStatus(userId, isOnline) {
  const session = Array.from(userSessions.values()).find(s => s.userId === userId);
  if (!session) return;

  // Find all conversations this user is part of
  activeConversations.forEach((conversation, conversationId) => {
    if (conversation.participants.includes(userId)) {
      // Broadcast to other participants
      conversation.participants.forEach(participantId => {
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

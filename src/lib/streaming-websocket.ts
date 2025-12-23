import { Server as SocketIOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/types/database';
import { checkStreamAccess, hasStreamingPermission } from '@/lib/streaming-auth';

export interface StreamingSocketData {
  userId: string;
  userRole: UserRole;
  userName: string;
  streamId?: string;
}

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  message: string;
  timestamp: Date;
  type: 'message' | 'system' | 'moderator';
}

export interface StreamEvent {
  type: 'stream_started' | 'stream_stopped' | 'viewer_joined' | 'viewer_left' | 'chat_message';
  streamId: string;
  data: any;
  timestamp: Date;
}

// Initialize streaming WebSocket handlers
export function initializeStreamingWebSocket(io: SocketIOServer) {
  // Create streaming namespace
  const streamingNamespace = io.of('/streaming');

  // Authentication middleware for streaming namespace
  streamingNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = await getToken({
        req: {
          headers: {
            authorization: `Bearer ${token}`,
          },
        } as any,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!decoded || !decoded.id) {
        return next(new Error('Invalid token'));
      }

      // Attach user data to socket
      socket.data = {
        userId: decoded.id as string,
        userRole: decoded.role as UserRole,
        userName: decoded.name as string,
      } as StreamingSocketData;

      next();
    } catch (error) {
      console.error('Streaming WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle streaming connections
  streamingNamespace.on('connection', (socket) => {
    const userData = socket.data as StreamingSocketData;
    console.log(`Streaming user connected: ${userData.userName} (${userData.userId})`);

    // Join stream room
    socket.on('join_stream', async (data: { streamId: string }) => {
      try {
        const { streamId } = data;

        if (!streamId) {
          socket.emit('error', { message: 'Stream ID is required' });
          return;
        }

        // Check if user can access this stream
        const canAccess = await checkStreamAccess({
          streamId,
          userId: userData.userId,
          userRole: userData.userRole,
          action: 'view'
        });

        if (!canAccess) {
          socket.emit('error', { message: 'Access denied to this stream' });
          return;
        }

        // Join the stream room
        socket.join(`stream:${streamId}`);
        socket.data.streamId = streamId;

        // Notify others that a viewer joined
        socket.to(`stream:${streamId}`).emit('viewer_joined', {
          userId: userData.userId,
          userName: userData.userName,
          timestamp: new Date().toISOString(),
        });

        // Send current stream info to the user
        socket.emit('stream_joined', {
          streamId,
          message: 'Successfully joined stream',
          timestamp: new Date().toISOString(),
        });

        // TODO: Update viewer count in database
        console.log(`User ${userData.userName} joined stream ${streamId}`);
      } catch (error) {
        console.error('Join stream error:', error);
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Leave stream room
    socket.on('leave_stream', async (data: { streamId: string }) => {
      try {
        const { streamId } = data;

        if (!streamId) {
          socket.emit('error', { message: 'Stream ID is required' });
          return;
        }

        // Leave the stream room
        socket.leave(`stream:${streamId}`);
        socket.data.streamId = undefined;

        // Notify others that a viewer left
        socket.to(`stream:${streamId}`).emit('viewer_left', {
          userId: userData.userId,
          userName: userData.userName,
          timestamp: new Date().toISOString(),
        });

        socket.emit('stream_left', {
          streamId,
          message: 'Successfully left stream',
          timestamp: new Date().toISOString(),
        });

        // TODO: Update viewer count in database
        console.log(`User ${userData.userName} left stream ${streamId}`);
      } catch (error) {
        console.error('Leave stream error:', error);
        socket.emit('error', { message: 'Failed to leave stream' });
      }
    });

    // Handle chat messages
    socket.on('send_chat_message', async (data: { streamId: string; message: string }) => {
      try {
        const { streamId, message } = data;

        if (!streamId || !message) {
          socket.emit('error', { message: 'Stream ID and message are required' });
          return;
        }

        // Check if user can chat in this stream
        const canChat = hasStreamingPermission(userData.userRole, 'fan:stream:chat');
        if (!canChat) {
          socket.emit('error', { message: 'Chat permission denied' });
          return;
        }

        // Validate message content
        if (message.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        if (message.length > 500) {
          socket.emit('error', { message: 'Message too long (max 500 characters)' });
          return;
        }

        // Create chat message
        const chatMessage: ChatMessage = {
          id: crypto.randomUUID(),
          streamId,
          userId: userData.userId,
          userName: userData.userName,
          userRole: userData.userRole,
          message: message.trim(),
          timestamp: new Date(),
          type: 'message',
        };

        // TODO: Save message to database
        // TODO: Apply content moderation

        // Broadcast message to all users in the stream
        streamingNamespace.to(`stream:${streamId}`).emit('chat_message', {
          id: chatMessage.id,
          userId: chatMessage.userId,
          userName: chatMessage.userName,
          userRole: chatMessage.userRole,
          message: chatMessage.message,
          timestamp: chatMessage.timestamp.toISOString(),
          type: chatMessage.type,
        });

        console.log(`Chat message in stream ${streamId} from ${userData.userName}: ${message}`);
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle stream control events (for artists)
    socket.on('stream_control', async (data: { streamId: string; action: 'start' | 'stop' }) => {
      try {
        const { streamId, action } = data;

        if (!streamId || !action) {
          socket.emit('error', { message: 'Stream ID and action are required' });
          return;
        }

        // Check if user can control this stream
        const canManage = hasStreamingPermission(userData.userRole, 'artist:stream:start');
        if (!canManage) {
          socket.emit('error', { message: 'Stream control permission denied' });
          return;
        }

        // TODO: Verify stream ownership

        // Broadcast stream status change
        const streamEvent: StreamEvent = {
          type: action === 'start' ? 'stream_started' : 'stream_stopped',
          streamId,
          data: {
            artistId: userData.userId,
            artistName: userData.userName,
          },
          timestamp: new Date(),
        };

        streamingNamespace.to(`stream:${streamId}`).emit('stream_event', {
          type: streamEvent.type,
          streamId: streamEvent.streamId,
          data: streamEvent.data,
          timestamp: streamEvent.timestamp.toISOString(),
        });

        console.log(`Stream ${streamId} ${action} by ${userData.userName}`);
      } catch (error) {
        console.error('Stream control error:', error);
        socket.emit('error', { message: 'Failed to control stream' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const streamId = socket.data.streamId;
      
      if (streamId) {
        // Notify others that viewer left
        socket.to(`stream:${streamId}`).emit('viewer_left', {
          userId: userData.userId,
          userName: userData.userName,
          timestamp: new Date().toISOString(),
        });

        // TODO: Update viewer count in database
      }

      console.log(`Streaming user disconnected: ${userData.userName} (${userData.userId})`);
    });
  });

  return streamingNamespace;
}

// Helper function to broadcast stream events
export function broadcastStreamEvent(
  io: SocketIOServer,
  streamId: string,
  event: StreamEvent
) {
  const streamingNamespace = io.of('/streaming');
  streamingNamespace.to(`stream:${streamId}`).emit('stream_event', {
    type: event.type,
    streamId: event.streamId,
    data: event.data,
    timestamp: event.timestamp.toISOString(),
  });
}

// Helper function to send system messages
export function sendSystemMessage(
  io: SocketIOServer,
  streamId: string,
  message: string
) {
  const streamingNamespace = io.of('/streaming');
  const systemMessage: ChatMessage = {
    id: crypto.randomUUID(),
    streamId,
    userId: 'system',
    userName: 'System',
    userRole: UserRole.ADMIN,
    message,
    timestamp: new Date(),
    type: 'system',
  };

  streamingNamespace.to(`stream:${streamId}`).emit('chat_message', {
    id: systemMessage.id,
    userId: systemMessage.userId,
    userName: systemMessage.userName,
    userRole: systemMessage.userRole,
    message: systemMessage.message,
    timestamp: systemMessage.timestamp.toISOString(),
    type: systemMessage.type,
  });
}
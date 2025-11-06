import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { logger } from '@/lib/logger';

// Store active streams and their connections
const activeStreams = new Map<string, {
  streamId: string;
  broadcasterId: string;
  broadcasterSocket: string;
  viewers: Set<string>;
  startTime: Date;
  status: 'STARTING' | 'LIVE' | 'ENDING' | 'ENDED';
}>();

// Store user sessions for streaming
const streamingSessions = new Map<string, {
  userId: string;
  socketId: string;
  role: 'BROADCASTER' | 'VIEWER';
  streamId: string | null;
  lastSeen: Date;
}>();

interface StreamingSocket extends Socket {
  userId?: string;
  streamId?: string;
  role?: 'BROADCASTER' | 'VIEWER';
}

export function setupStreamingSignaling(io: Server) {
  // Create streaming namespace
  const streamingNamespace = io.of('/streaming');
  
  streamingNamespace.on('connection', (socket: StreamingSocket) => {
    logger.info('Streaming client connected', { socketId: socket.id });

    // Handle stream room joining
    socket.on('stream:join', async (data: { streamId: string; isOwner: boolean; userId?: string }) => {
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
            const stream = activeStreams.get(streamId)!;
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
          logger.info('Broadcaster joined stream', { streamId, userId });
          
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
            
            logger.info('Viewer joined stream', { streamId, viewerId: socket.id, totalViewers: stream.viewers.size });
          } else {
            socket.emit('stream-not-found');
          }
        }
      } catch (error) {
        logger.error('Error joining stream', { error, data });
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
          
          // Notify all viewers that broadcaster is ready
          socket.to(`stream:${streamId}`).emit('broadcaster-available');
          streamingNamespace.to(`stream:${streamId}`).emit('stream-started');
          
          logger.info('Broadcaster ready', { streamId, viewerCount: stream.viewers.size });
        }
      }
    });

    // Handle start stream event
    socket.on('start-stream', () => {
      const streamId = socket.streamId;
      if (streamId && socket.role === 'BROADCASTER') {
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.status = 'LIVE';
          streamingNamespace.to(`stream:${streamId}`).emit('stream-started');
          logger.info('Stream started', { streamId });
        }
      }
    });

    // Handle stop stream event
    socket.on('stop-stream', () => {
      const streamId = socket.streamId;
      if (streamId && socket.role === 'BROADCASTER') {
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.status = 'ENDED';
          
          // Notify all viewers stream has ended
          streamingNamespace.to(`stream:${streamId}`).emit('stream-ended');
          
          // Clean up stream
          activeStreams.delete(streamId);
          
          logger.info('Stream ended', { streamId, totalViewers: stream.viewers.size });
        }
      }
    });

    // Handle viewer requesting stream
    socket.on('request-stream', () => {
      const streamId = socket.streamId;
      if (streamId && socket.role === 'VIEWER') {
        const stream = activeStreams.get(streamId);
        if (stream && stream.status === 'LIVE') {
          // Notify broadcaster about stream request
          streamingNamespace.to(stream.broadcasterSocket).emit('stream-request', {
            viewerId: socket.id,
          });
          
          logger.info('Stream requested', { streamId, viewerId: socket.id });
        } else {
          socket.emit('stream-not-available');
        }
      }
    });

    // Handle WebRTC offer from broadcaster
    socket.on('offer', (data: { offer: RTCSessionDescriptionInit; targetId: string }) => {
      const { offer, targetId } = data;
      streamingNamespace.to(targetId).emit('offer', {
        offer,
        senderId: socket.id,
      });
      
      logger.info('WebRTC offer sent', { from: socket.id, to: targetId });
    });

    // Handle WebRTC answer from viewer
    socket.on('answer', (data: { answer: RTCSessionDescriptionInit; targetId: string }) => {
      const { answer, targetId } = data;
      streamingNamespace.to(targetId).emit('answer', {
        answer,
        senderId: socket.id,
      });
      
      logger.info('WebRTC answer sent', { from: socket.id, to: targetId });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; targetId: string }) => {
      const { candidate, targetId } = data;
      streamingNamespace.to(targetId).emit('ice-candidate', {
        candidate,
        senderId: socket.id,
      });
    });

    // Handle stream quality changes
    socket.on('stream-quality-change', (data: { quality: string; bitrate: number }) => {
      const streamId = socket.streamId;
      if (streamId && socket.role === 'BROADCASTER') {
        socket.to(`stream:${streamId}`).emit('quality-changed', data);
        logger.info('Stream quality changed', { streamId, ...data });
      }
    });

    // Handle chat messages during stream
    socket.on('stream-chat', (data: { message: string; timestamp: Date }) => {
      const streamId = socket.streamId;
      const session = streamingSessions.get(socket.id);
      
      if (streamId && session) {
        const chatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          streamId,
          senderId: session.userId,
          message: data.message,
          timestamp: data.timestamp || new Date(),
          role: session.role,
        };
        
        // Broadcast chat message to all stream participants
        streamingNamespace.to(`stream:${streamId}`).emit('stream-chat-message', chatMessage);
        
        logger.info('Stream chat message', { streamId, senderId: session.userId });
      }
    });

    // Handle viewer tips/donations during stream
    socket.on('stream-tip', (data: { amount: number; currency: string; message?: string }) => {
      const streamId = socket.streamId;
      const session = streamingSessions.get(socket.id);
      
      if (streamId && session && socket.role === 'VIEWER') {
        const stream = activeStreams.get(streamId);
        if (stream) {
          const tipEvent = {
            id: `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            streamId,
            tipperId: session.userId,
            amount: data.amount,
            currency: data.currency,
            message: data.message,
            timestamp: new Date(),
          };
          
          // Notify broadcaster about tip
          streamingNamespace.to(stream.broadcasterSocket).emit('stream-tip-received', tipEvent);
          
          // Optionally broadcast to all viewers (if enabled)
          streamingNamespace.to(`stream:${streamId}`).emit('stream-tip-notification', {
            amount: data.amount,
            currency: data.currency,
            message: data.message,
            anonymous: false, // Could be configurable
          });
          
          logger.info('Stream tip received', { streamId, amount: data.amount, currency: data.currency });
        }
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const session = streamingSessions.get(socket.id);
      if (session) {
        const { streamId, role } = session;
        
        if (role === 'BROADCASTER' && streamId) {
          // Broadcaster disconnected - end stream
          const stream = activeStreams.get(streamId);
          if (stream) {
            stream.status = 'ENDED';
            streamingNamespace.to(`stream:${streamId}`).emit('broadcaster-left');
            activeStreams.delete(streamId);
            logger.info('Broadcaster disconnected - stream ended', { streamId });
          }
        } else if (role === 'VIEWER' && streamId) {
          // Viewer disconnected - update count
          const stream = activeStreams.get(streamId);
          if (stream) {
            stream.viewers.delete(socket.id);
            
            // Update viewer count
            streamingNamespace.to(`stream:${streamId}`).emit('viewer-count-update', {
              count: stream.viewers.size,
            });
            
            // Notify broadcaster
            streamingNamespace.to(stream.broadcasterSocket).emit('viewer-left', {
              viewerId: socket.id,
              totalViewers: stream.viewers.size,
            });
            
            logger.info('Viewer disconnected', { streamId, viewerId: socket.id, remainingViewers: stream.viewers.size });
          }
        }
        
        streamingSessions.delete(socket.id);
      }
      
      logger.info('Streaming client disconnected', { socketId: socket.id });
    });
  });

  return streamingNamespace;
}

// Helper functions for external use
export function getActiveStream(streamId: string) {
  return activeStreams.get(streamId);
}

export function getAllActiveStreams() {
  return Array.from(activeStreams.values());
}

export function getStreamViewerCount(streamId: string): number {
  const stream = activeStreams.get(streamId);
  return stream ? stream.viewers.size : 0;
}

export function endStream(streamId: string): boolean {
  const stream = activeStreams.get(streamId);
  if (stream) {
    stream.status = 'ENDED';
    return activeStreams.delete(streamId);
  }
  return false;
}
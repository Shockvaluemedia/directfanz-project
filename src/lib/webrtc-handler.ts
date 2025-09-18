import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from './logger';
import { prisma } from './prisma';
import {
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from '../types/websocket';

// Store active streams
interface ActiveStream {
  broadcasterSocket: string | null;
  broadcasterUserId: string;
  viewers: Set<string>;
  startTime: Date;
  isLive: boolean;
}

export class WebRTCHandler {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private activeStreams = new Map<string, ActiveStream>();
  private socketToStream = new Map<string, string>();

  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    this.io = io;
  }

  public initializeWebRTCHandlers(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    // Stream room management
    socket.on('stream:join', (data) => this.handleStreamJoin(socket, data));
    socket.on('stream:leave', (data) => this.handleStreamLeave(socket, data));

    // WebRTC signaling
    socket.on('offer', (data) => this.handleOffer(socket, data));
    socket.on('answer', (data) => this.handleAnswer(socket, data));
    socket.on('ice-candidate', (data) => this.handleIceCandidate(socket, data));
    
    // Stream control
    socket.on('broadcaster-ready', () => this.handleBroadcasterReady(socket));
    socket.on('request-stream', () => this.handleStreamRequest(socket));
    socket.on('start-stream', () => this.handleStartStream(socket));
    socket.on('stop-stream', () => this.handleStopStream(socket));
    socket.on('stream-quality-change', (data) => this.handleQualityChange(socket, data));
  }

  private async handleStreamJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { streamId: string; isOwner: boolean }
  ) {
    try {
      const { userId } = socket.data;
      const { streamId, isOwner } = data;

      // Verify stream exists and user has access
      const stream = await prisma.liveStream.findUnique({
        where: { id: streamId },
        include: {
          artist: {
            select: { id: true, displayName: true }
          }
        }
      });

      if (!stream) {
        socket.emit('error', 'Stream not found');
        return;
      }

      // Check ownership
      const isActualOwner = stream.artistId === userId;
      if (isOwner && !isActualOwner) {
        socket.emit('error', 'Unauthorized to broadcast this stream');
        return;
      }

      // Store stream data in socket
      socket.data.streamId = streamId;
      socket.data.isStreamOwner = isActualOwner;
      socket.data.streamData = stream;

      // Join stream room
      socket.join(`stream:${streamId}`);
      this.socketToStream.set(socket.id, streamId);

      if (isActualOwner) {
        await this.handleBroadcasterJoin(socket, streamId);
      } else {
        await this.handleViewerJoin(socket, streamId);
      }

      logger.info('User joined stream', {
        userId,
        streamId,
        isOwner: isActualOwner,
        socketId: socket.id
      });

    } catch (error) {
      logger.error('Error joining stream', { userId: socket.data.userId, streamId: data.streamId }, error as Error);
      socket.emit('error', 'Failed to join stream');
    }
  }

  private async handleBroadcasterJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    streamId: string
  ) {
    const { userId } = socket.data;

    // Initialize or update active stream
    let activeStream = this.activeStreams.get(streamId);
    if (!activeStream) {
      activeStream = {
        broadcasterSocket: socket.id,
        broadcasterUserId: userId,
        viewers: new Set(),
        startTime: new Date(),
        isLive: false
      };
      this.activeStreams.set(streamId, activeStream);
    } else {
      // Update broadcaster socket (reconnection)
      activeStream.broadcasterSocket = socket.id;
    }

    // Notify existing viewers that broadcaster is available
    socket.to(`stream:${streamId}`).emit('broadcaster-joined');

    logger.info('Broadcaster joined stream', {
      streamId,
      broadcasterId: userId,
      viewerCount: activeStream.viewers.size
    });
  }

  private async handleViewerJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    streamId: string
  ) {
    const { userId } = socket.data;

    let activeStream = this.activeStreams.get(streamId);
    if (!activeStream) {
      // Create placeholder stream if broadcaster hasn't joined yet
      activeStream = {
        broadcasterSocket: null,
        broadcasterUserId: '', // Will be set when broadcaster joins
        viewers: new Set(),
        startTime: new Date(),
        isLive: false
      };
      this.activeStreams.set(streamId, activeStream);
    }

    // Add viewer
    activeStream.viewers.add(socket.id);

    // Track viewer in database
    await this.trackViewer(streamId, userId, socket.id);

    // Notify broadcaster of new viewer
    if (activeStream.broadcasterSocket) {
      this.io.to(activeStream.broadcasterSocket).emit('viewer-joined', {
        viewerId: socket.id,
        totalViewers: activeStream.viewers.size
      });

      // Notify viewer that broadcaster is available
      socket.emit('broadcaster-available');
    }

    // Update viewer count for all clients
    this.updateViewerCount(streamId);

    logger.info('Viewer joined stream', {
      streamId,
      viewerId: socket.id,
      userId,
      totalViewers: activeStream.viewers.size
    });
  }

  private handleStreamLeave(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { streamId: string }
  ) {
    this.handleStreamDisconnect(socket);
  }

  private handleOffer(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { offer: RTCSessionDescriptionInit; targetId: string }
  ) {
    const { streamId } = socket.data;
    logger.info('WebRTC offer', {
      streamId,
      from: socket.id,
      to: data.targetId
    });

    socket.to(data.targetId).emit('offer', {
      offer: data.offer,
      senderId: socket.id
    });
  }

  private handleAnswer(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { answer: RTCSessionDescriptionInit; targetId: string }
  ) {
    const { streamId } = socket.data;
    logger.info('WebRTC answer', {
      streamId,
      from: socket.id,
      to: data.targetId
    });

    socket.to(data.targetId).emit('answer', {
      answer: data.answer,
      senderId: socket.id
    });
  }

  private handleIceCandidate(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { candidate: RTCIceCandidateInit; targetId: string }
  ) {
    socket.to(data.targetId).emit('ice-candidate', {
      candidate: data.candidate,
      senderId: socket.id
    });
  }

  private handleBroadcasterReady(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { streamId } = socket.data;
    
    if (streamId) {
      logger.info('Broadcaster ready', { streamId, socketId: socket.id });
      socket.to(`stream:${streamId}`).emit('broadcaster-ready');
    }
  }

  private handleStreamRequest(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { streamId } = socket.data;
    
    if (streamId) {
      const activeStream = this.activeStreams.get(streamId);
      if (activeStream?.broadcasterSocket) {
        logger.info('Stream requested', {
          streamId,
          viewerId: socket.id,
          broadcasterId: activeStream.broadcasterSocket
        });

        this.io.to(activeStream.broadcasterSocket).emit('stream-request', {
          viewerId: socket.id
        });
      }
    }
  }

  private async handleStartStream(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { streamId } = socket.data;
    
    if (streamId) {
      const activeStream = this.activeStreams.get(streamId);
      if (activeStream) {
        activeStream.isLive = true;
        
        // Update database
        await this.updateStreamStatus(streamId, 'LIVE');
        
        // Notify viewers
        socket.to(`stream:${streamId}`).emit('stream-started');
        
        logger.info('Stream started', { streamId, socketId: socket.id });
      }
    }
  }

  private async handleStopStream(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const { streamId } = socket.data;
    
    if (streamId) {
      const activeStream = this.activeStreams.get(streamId);
      if (activeStream) {
        activeStream.isLive = false;
        
        // Update database
        await this.updateStreamStatus(streamId, 'ENDED');
        
        // Notify viewers
        socket.to(`stream:${streamId}`).emit('stream-ended');
        
        // Clean up stream
        this.activeStreams.delete(streamId);
        
        logger.info('Stream stopped', { streamId, socketId: socket.id });
      }
    }
  }

  private handleQualityChange(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { quality: string; bitrate?: number }
  ) {
    const { streamId } = socket.data;
    
    if (streamId) {
      logger.info('Stream quality changed', { 
        streamId, 
        quality: data.quality,
        bitrate: data.bitrate 
      });

      socket.to(`stream:${streamId}`).emit('quality-changed', data);
    }
  }

  public handleStreamDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const streamId = this.socketToStream.get(socket.id);
    
    if (streamId) {
      const activeStream = this.activeStreams.get(streamId);
      const { userId } = socket.data;
      
      if (activeStream) {
        if (activeStream.broadcasterSocket === socket.id) {
          // Broadcaster disconnected
          logger.info('Broadcaster disconnected', { streamId, socketId: socket.id });
          
          // Update stream status
          this.updateStreamStatus(streamId, 'ENDED');
          
          // Notify viewers
          socket.to(`stream:${streamId}`).emit('broadcaster-left');
          
          // Clean up stream
          this.activeStreams.delete(streamId);
          
        } else {
          // Viewer disconnected
          activeStream.viewers.delete(socket.id);
          
          // Update viewer session
          this.updateViewerSession(streamId, userId, socket.id);
          
          // Update viewer count
          this.updateViewerCount(streamId);
          
          logger.info('Viewer disconnected', {
            streamId,
            socketId: socket.id,
            remainingViewers: activeStream.viewers.size
          });
        }
      }
      
      // Clean up mappings
      this.socketToStream.delete(socket.id);
    }
  }

  // Helper methods
  private async trackViewer(streamId: string, userId: string, sessionId: string) {
    try {
      await prisma.streamViewer.create({
        data: {
          streamId,
          viewerId: userId,
          sessionId,
          displayName: '', // Will be populated from user data
          ipAddress: '', // Can be extracted from socket
          userAgent: '', // Can be extracted from socket
        }
      });
    } catch (error) {
      logger.error('Failed to track viewer', { streamId, userId }, error as Error);
    }
  }

  private async updateViewerSession(streamId: string, userId: string, sessionId: string) {
    try {
      await prisma.streamViewer.updateMany({
        where: {
          streamId,
          sessionId,
        },
        data: {
          leftAt: new Date(),
        }
      });
    } catch (error) {
      logger.error('Failed to update viewer session', { streamId, userId }, error as Error);
    }
  }

  private async updateStreamStatus(streamId: string, status: 'LIVE' | 'ENDED') {
    try {
      const updateData: any = { status };
      
      if (status === 'LIVE') {
        updateData.startedAt = new Date();
      } else if (status === 'ENDED') {
        updateData.endedAt = new Date();
      }

      await prisma.liveStream.update({
        where: { id: streamId },
        data: updateData
      });
    } catch (error) {
      logger.error('Failed to update stream status', { streamId, status }, error as Error);
    }
  }

  private updateViewerCount(streamId: string) {
    const activeStream = this.activeStreams.get(streamId);
    if (activeStream) {
      const viewerCount = activeStream.viewers.size;
      
      // Broadcast viewer count to all clients in the stream
      this.io.to(`stream:${streamId}`).emit('viewer-count-update', {
        count: viewerCount
      });

      // Update peak viewers in database if necessary
      this.updatePeakViewers(streamId, viewerCount);
    }
  }

  private async updatePeakViewers(streamId: string, currentViewers: number) {
    try {
      const stream = await prisma.liveStream.findUnique({
        where: { id: streamId },
        select: { peakViewers: true }
      });

      if (stream && currentViewers > stream.peakViewers) {
        await prisma.liveStream.update({
          where: { id: streamId },
          data: { 
            peakViewers: currentViewers,
            totalViewers: currentViewers // Also update total for current count
          }
        });
      }
    } catch (error) {
      logger.error('Failed to update peak viewers', { streamId, currentViewers }, error as Error);
    }
  }

  // Public methods for external access
  public getConnectedViewers(streamId: string): number {
    const activeStream = this.activeStreams.get(streamId);
    return activeStream?.viewers.size || 0;
  }

  public isStreamLive(streamId: string): boolean {
    const activeStream = this.activeStreams.get(streamId);
    return activeStream?.isLive || false;
  }
}
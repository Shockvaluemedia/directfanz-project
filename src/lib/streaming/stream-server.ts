/**
 * Live Streaming Infrastructure - Stream Server
 *
 * This module provides a comprehensive live streaming system with:
 * - WebRTC-based streaming with adaptive bitrate
 * - Stream recording and cloud storage
 * - Real-time chat integration with moderation
 * - Viewer count and engagement tracking
 * - Donations and tips during live streams
 * - Stream scheduling and notifications
 * - Mobile streaming support
 * - Multi-quality streaming (1080p, 720p, 480p)
 * - Stream analytics and performance monitoring
 * - RTMP ingestion for OBS Studio integration
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../logger';
import { prisma } from '../prisma-optimized';
import { verifyJWT } from '../auth';
import { uploadToS3 } from '../media-processing/core';
import { analyticsMonitor } from '../media-processing/analytics-monitor';

// Types and Interfaces
export interface StreamSession {
  id: string;
  streamerId: string;
  title: string;
  description?: string;
  category: string;
  isPrivate: boolean;
  maxViewers?: number;
  scheduledStart?: Date;
  actualStart?: Date;
  endTime?: Date;
  status: StreamStatus;
  settings: StreamSettings;
  metadata: StreamMetadata;
  recordingPath?: string;
  thumbnailUrl?: string;
}

export interface StreamSettings {
  enableChat: boolean;
  enableDonations: boolean;
  enableRecording: boolean;
  chatModeration: 'disabled' | 'keywords' | 'manual' | 'auto';
  donationGoal?: number;
  subscribersOnly: boolean;
  delaySeconds: number;
  qualities: StreamQuality[];
  rtmpKey?: string;
}

export interface StreamMetadata {
  currentViewers: number;
  peakViewers: number;
  totalViews: number;
  duration: number;
  bitrate: number;
  framerate: number;
  resolution: string;
  totalDonations: number;
  chatMessages: number;
  likes: number;
  shares: number;
}

export interface StreamQuality {
  name: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  enabled: boolean;
}

export interface Viewer {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  joinedAt: Date;
  lastActivity: Date;
  isSubscriber: boolean;
  tier?: string;
  socketId: string;
  quality: string;
  deviceInfo?: {
    type: 'mobile' | 'desktop' | 'tablet' | 'tv';
    browser?: string;
    os?: string;
  };
}

export interface StreamDonation {
  id: string;
  streamId: string;
  donorId: string;
  donorName: string;
  amount: number;
  currency: string;
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface StreamChatMessage {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  type: 'message' | 'donation' | 'subscription' | 'system';
  isModerated: boolean;
  createdAt: Date;
  metadata?: {
    donationAmount?: number;
    subscriptionTier?: string;
    badges?: string[];
  };
}

export type StreamStatus =
  | 'scheduled'
  | 'starting'
  | 'live'
  | 'paused'
  | 'ending'
  | 'ended'
  | 'error';

// Configuration
const STREAMING_CONFIG = {
  // Stream Settings
  STREAM: {
    maxDuration: 8 * 60 * 60 * 1000, // 8 hours
    maxViewers: 10000,
    defaultDelay: 10, // 10 seconds
    keyframeInterval: 2, // seconds
    segmentDuration: 4, // seconds for HLS
    maxBitrate: 6000000, // 6 Mbps
    minBitrate: 500000, // 500 Kbps
  },

  // Quality Presets
  QUALITIES: [
    {
      name: '1080p',
      width: 1920,
      height: 1080,
      bitrate: 6000000,
      framerate: 30,
      enabled: true,
    },
    {
      name: '720p',
      width: 1280,
      height: 720,
      bitrate: 3000000,
      framerate: 30,
      enabled: true,
    },
    {
      name: '480p',
      width: 854,
      height: 480,
      bitrate: 1500000,
      framerate: 30,
      enabled: true,
    },
    {
      name: '360p',
      width: 640,
      height: 360,
      bitrate: 800000,
      framerate: 30,
      enabled: true,
    },
  ],

  // Recording Settings
  RECORDING: {
    format: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 23, // Constant Rate Factor
    preset: 'medium',
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
  },

  // Chat Settings
  CHAT: {
    maxMessageLength: 500,
    maxMessagesPerMinute: 30,
    slowModeDelay: 5, // seconds
    moderationKeywords: ['spam', 'scam', 'hate', 'harassment'],
  },

  // Donation Settings
  DONATIONS: {
    minAmount: 1,
    maxAmount: 1000,
    currencies: ['USD', 'EUR', 'GBP'],
    processingFee: 0.029, // 2.9%
    platformFee: 0.05, // 5%
  },

  // WebRTC Settings
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN servers for production
    ],
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    iceCandidatePoolSize: 10,
  },

  // RTMP Settings
  RTMP: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
} as const;

export class StreamingServer {
  private io: SocketIOServer;
  private redis: Redis;
  private activeStreams = new Map<string, StreamSession>();
  private streamViewers = new Map<string, Map<string, Viewer>>();
  private streamProcesses = new Map<string, ChildProcess>();
  private recordingProcesses = new Map<string, ChildProcess>();

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.IO
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Initialize Redis
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Setup handlers
    this.setupSocketHandlers();
    this.setupCleanupHandlers();

    logger.info('Streaming server initialized');
  }

  private setupSocketHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No authentication token provided');
        }

        const decoded = await verifyJWT(token);
        const user = await this.getUserFromDatabase(decoded.userId);

        if (!user) {
          throw new Error('User not found');
        }

        socket.data.user = user;
        next();
      } catch (error) {
        logger.error('Stream socket authentication failed', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', socket => {
      this.handleConnection(socket);
    });
  }

  private async handleConnection(socket: any): Promise<void> {
    const user = socket.data.user;

    logger.info('User connected to streaming', {
      userId: user.id,
      socketId: socket.id,
    });

    // Setup stream event handlers
    socket.on('create_stream', (data: any) => this.handleCreateStream(socket, data));

    socket.on('start_stream', (data: { streamId: string }) => this.handleStartStream(socket, data));

    socket.on('end_stream', (data: { streamId: string }) => this.handleEndStream(socket, data));

    socket.on('join_stream', (data: { streamId: string }) => this.handleJoinStream(socket, data));

    socket.on('leave_stream', (data: { streamId: string }) => this.handleLeaveStream(socket, data));

    // WebRTC signaling
    socket.on('offer', (data: { streamId: string; offer: RTCSessionDescriptionInit }) =>
      this.handleWebRTCOffer(socket, data)
    );

    socket.on('answer', (data: { streamId: string; answer: RTCSessionDescriptionInit }) =>
      this.handleWebRTCAnswer(socket, data)
    );

    socket.on('ice_candidate', (data: { streamId: string; candidate: RTCIceCandidateInit }) =>
      this.handleICECandidate(socket, data)
    );

    // Stream interaction
    socket.on('stream_chat', (data: { streamId: string; message: string }) =>
      this.handleStreamChat(socket, data)
    );

    socket.on('stream_donation', (data: { streamId: string; amount: number; message?: string }) =>
      this.handleStreamDonation(socket, data)
    );

    socket.on('stream_like', (data: { streamId: string }) => this.handleStreamLike(socket, data));

    socket.on('stream_share', (data: { streamId: string }) => this.handleStreamShare(socket, data));

    // Quality control
    socket.on('change_quality', (data: { streamId: string; quality: string }) =>
      this.handleChangeQuality(socket, data)
    );

    // Moderation
    socket.on('moderate_message', (data: { messageId: string; action: 'delete' | 'timeout' }) =>
      this.handleModerateMessage(socket, data)
    );

    socket.on('disconnect', () => this.handleDisconnection(socket));

    // Send user their active streams
    await this.sendUserStreams(socket);
  }

  private async handleCreateStream(
    socket: any,
    data: {
      title: string;
      description?: string;
      category: string;
      isPrivate: boolean;
      settings: Partial<StreamSettings>;
      scheduledStart?: Date;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      // Check if user can create streams (artist role, subscription level, etc.)
      const canStream = await this.canUserStream(user.id);
      if (!canStream) {
        socket.emit('error', { message: 'Streaming not available for your account' });
        return;
      }

      // Create stream session
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const rtmpKey = this.generateRTMPKey();

      const stream: StreamSession = {
        id: streamId,
        streamerId: user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        isPrivate: data.isPrivate,
        scheduledStart: data.scheduledStart,
        status: data.scheduledStart ? 'scheduled' : 'starting',
        settings: {
          enableChat: true,
          enableDonations: true,
          enableRecording: true,
          chatModeration: 'keywords',
          subscribersOnly: false,
          delaySeconds: STREAMING_CONFIG.STREAM.defaultDelay,
          qualities: STREAMING_CONFIG.QUALITIES,
          rtmpKey,
          ...data.settings,
        },
        metadata: {
          currentViewers: 0,
          peakViewers: 0,
          totalViews: 0,
          duration: 0,
          bitrate: 0,
          framerate: 0,
          resolution: '1080p',
          totalDonations: 0,
          chatMessages: 0,
          likes: 0,
          shares: 0,
        },
      };

      // Save to database
      await this.saveStreamToDatabase(stream);

      // Store in memory
      this.activeStreams.set(streamId, stream);
      this.streamViewers.set(streamId, new Map());

      // Setup stream directory
      await this.setupStreamDirectory(streamId);

      socket.emit('stream_created', {
        stream,
        rtmpUrl: `rtmp://localhost:${STREAMING_CONFIG.RTMP.port}/live/${rtmpKey}`,
        webrtcConfig: STREAMING_CONFIG.WEBRTC,
      });

      logger.info('Stream created', {
        streamId,
        streamerId: user.id,
        title: data.title,
      });
    } catch (error) {
      logger.error('Failed to create stream', { userId: user.id, error });
      socket.emit('error', { message: 'Failed to create stream' });
    }
  }

  private async handleStartStream(socket: any, data: { streamId: string }): Promise<void> {
    const user = socket.data.user;
    const { streamId } = data;

    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream || stream.streamerId !== user.id) {
        socket.emit('error', { message: 'Stream not found or access denied' });
        return;
      }

      if (stream.status !== 'starting' && stream.status !== 'scheduled') {
        socket.emit('error', { message: 'Stream already started or ended' });
        return;
      }

      // Update stream status
      stream.status = 'live';
      stream.actualStart = new Date();

      // Start recording if enabled
      if (stream.settings.enableRecording) {
        await this.startRecording(streamId);
      }

      // Setup stream processing
      await this.setupStreamProcessing(streamId);

      // Notify subscribers
      await this.notifyStreamStart(streamId);

      // Update database
      await this.updateStreamInDatabase(stream);

      // Broadcast to all sockets
      this.io.emit('stream_started', {
        streamId,
        streamer: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
        },
        stream: {
          id: stream.id,
          title: stream.title,
          category: stream.category,
          thumbnailUrl: stream.thumbnailUrl,
        },
      });

      socket.emit('stream_start_success', { streamId });

      logger.info('Stream started', {
        streamId,
        streamerId: user.id,
      });
    } catch (error) {
      logger.error('Failed to start stream', { userId: user.id, streamId, error });
      socket.emit('error', { message: 'Failed to start stream' });
    }
  }

  private async handleEndStream(socket: any, data: { streamId: string }): Promise<void> {
    const user = socket.data.user;
    const { streamId } = data;

    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream || stream.streamerId !== user.id) {
        socket.emit('error', { message: 'Stream not found or access denied' });
        return;
      }

      // Update stream status
      stream.status = 'ending';
      stream.endTime = new Date();

      if (stream.actualStart) {
        stream.metadata.duration = stream.endTime.getTime() - stream.actualStart.getTime();
      }

      // Stop recording
      await this.stopRecording(streamId);

      // Stop stream processing
      await this.stopStreamProcessing(streamId);

      // Process and upload recording
      if (stream.settings.enableRecording && stream.recordingPath) {
        await this.processStreamRecording(streamId);
      }

      // Update final analytics
      await this.updateStreamAnalytics(streamId);

      // Notify all viewers
      this.io.to(streamId).emit('stream_ended', {
        streamId,
        duration: stream.metadata.duration,
        viewers: stream.metadata.totalViews,
      });

      // Clean up viewers
      const viewers = this.streamViewers.get(streamId);
      if (viewers) {
        for (const viewer of viewers.values()) {
          const viewerSocket = this.io.sockets.sockets.get(viewer.socketId);
          if (viewerSocket) {
            viewerSocket.leave(streamId);
          }
        }
        viewers.clear();
      }

      // Update database
      stream.status = 'ended';
      await this.updateStreamInDatabase(stream);

      // Clean up memory
      this.activeStreams.delete(streamId);
      this.streamViewers.delete(streamId);

      socket.emit('stream_end_success', { streamId });

      logger.info('Stream ended', {
        streamId,
        streamerId: user.id,
        duration: stream.metadata.duration,
        viewers: stream.metadata.totalViews,
      });
    } catch (error) {
      logger.error('Failed to end stream', { userId: user.id, streamId, error });
      socket.emit('error', { message: 'Failed to end stream' });
    }
  }

  private async handleJoinStream(socket: any, data: { streamId: string }): Promise<void> {
    const user = socket.data.user;
    const { streamId } = data;

    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        socket.emit('error', { message: 'Stream not found' });
        return;
      }

      if (stream.status !== 'live') {
        socket.emit('error', { message: 'Stream is not live' });
        return;
      }

      // Check access permissions
      const hasAccess = await this.checkStreamAccess(user.id, stream);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this stream' });
        return;
      }

      // Add viewer
      const viewer: Viewer = {
        id: `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        userName: user.name,
        avatar: user.avatar,
        joinedAt: new Date(),
        lastActivity: new Date(),
        isSubscriber: false, // Would check subscription status
        socketId: socket.id,
        quality: '720p', // Default quality
      };

      const viewers = this.streamViewers.get(streamId) || new Map();
      viewers.set(user.id, viewer);
      this.streamViewers.set(streamId, viewers);

      // Update stream metrics
      stream.metadata.currentViewers = viewers.size;
      stream.metadata.peakViewers = Math.max(stream.metadata.peakViewers, viewers.size);
      stream.metadata.totalViews++;

      // Join socket room
      await socket.join(streamId);

      // Send stream data to viewer
      socket.emit('stream_joined', {
        streamId,
        stream: {
          ...stream,
          streamer: await this.getStreamerInfo(stream.streamerId),
        },
        viewer,
        chatHistory: await this.getStreamChatHistory(streamId),
      });

      // Notify streamer
      socket.to(streamId).emit('viewer_joined', {
        streamId,
        viewer: {
          id: viewer.id,
          userName: viewer.userName,
          avatar: viewer.avatar,
        },
        currentViewers: stream.metadata.currentViewers,
      });

      logger.info('Viewer joined stream', {
        streamId,
        viewerId: user.id,
        currentViewers: stream.metadata.currentViewers,
      });
    } catch (error) {
      logger.error('Failed to join stream', { userId: user.id, streamId, error });
      socket.emit('error', { message: 'Failed to join stream' });
    }
  }

  private async handleLeaveStream(socket: any, data: { streamId: string }): Promise<void> {
    const user = socket.data.user;
    const { streamId } = data;

    try {
      const viewers = this.streamViewers.get(streamId);
      if (!viewers) return;

      const viewer = viewers.get(user.id);
      if (!viewer) return;

      // Remove viewer
      viewers.delete(user.id);

      // Update stream metrics
      const stream = this.activeStreams.get(streamId);
      if (stream) {
        stream.metadata.currentViewers = viewers.size;
      }

      // Leave socket room
      await socket.leave(streamId);

      // Notify others
      socket.to(streamId).emit('viewer_left', {
        streamId,
        viewerId: user.id,
        currentViewers: viewers.size,
      });

      logger.info('Viewer left stream', {
        streamId,
        viewerId: user.id,
        currentViewers: viewers.size,
      });
    } catch (error) {
      logger.error('Failed to leave stream', { userId: user.id, streamId, error });
    }
  }

  private async handleWebRTCOffer(
    socket: any,
    data: {
      streamId: string;
      offer: RTCSessionDescriptionInit;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      const stream = this.activeStreams.get(data.streamId);
      if (!stream || stream.streamerId !== user.id) {
        socket.emit('error', { message: 'Stream not found or access denied' });
        return;
      }

      // Forward offer to viewers in the stream
      socket.to(data.streamId).emit('webrtc_offer', {
        streamId: data.streamId,
        offer: data.offer,
        streamerId: user.id,
      });
    } catch (error) {
      logger.error('Failed to handle WebRTC offer', { userId: user.id, error });
    }
  }

  private async handleWebRTCAnswer(
    socket: any,
    data: {
      streamId: string;
      answer: RTCSessionDescriptionInit;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      const stream = this.activeStreams.get(data.streamId);
      if (!stream) {
        socket.emit('error', { message: 'Stream not found' });
        return;
      }

      // Forward answer to streamer
      const streamerSocket = await this.getStreamerSocket(stream.streamerId);
      if (streamerSocket) {
        streamerSocket.emit('webrtc_answer', {
          streamId: data.streamId,
          answer: data.answer,
          viewerId: user.id,
        });
      }
    } catch (error) {
      logger.error('Failed to handle WebRTC answer', { userId: user.id, error });
    }
  }

  private async handleICECandidate(
    socket: any,
    data: {
      streamId: string;
      candidate: RTCIceCandidateInit;
    }
  ): Promise<void> {
    try {
      // Forward ICE candidate to other participants
      socket.to(data.streamId).emit('ice_candidate', {
        streamId: data.streamId,
        candidate: data.candidate,
        senderId: socket.data.user.id,
      });
    } catch (error) {
      logger.error('Failed to handle ICE candidate', error);
    }
  }

  private async handleStreamChat(
    socket: any,
    data: {
      streamId: string;
      message: string;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      const stream = this.activeStreams.get(data.streamId);
      if (!stream) {
        socket.emit('error', { message: 'Stream not found' });
        return;
      }

      // Check if user can chat
      const canChat = await this.canUserChat(user.id, stream);
      if (!canChat) {
        socket.emit('error', { message: 'Chat not available' });
        return;
      }

      // Validate message
      if (!data.message.trim() || data.message.length > STREAMING_CONFIG.CHAT.maxMessageLength) {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      // Check for moderation
      const isModerated = this.moderateMessage(data.message, stream.settings.chatModeration);

      const chatMessage: StreamChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        streamId: data.streamId,
        userId: user.id,
        userName: user.name,
        avatar: user.avatar,
        content: data.message,
        type: 'message',
        isModerated,
        createdAt: new Date(),
      };

      // Save to database
      await this.saveChatMessage(chatMessage);

      // Update stream metrics
      stream.metadata.chatMessages++;

      // Broadcast to stream viewers
      if (!isModerated) {
        this.io.to(data.streamId).emit('stream_chat_message', chatMessage);
      }
    } catch (error) {
      logger.error('Failed to handle stream chat', { userId: user.id, error });
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleStreamDonation(
    socket: any,
    data: {
      streamId: string;
      amount: number;
      message?: string;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      const stream = this.activeStreams.get(data.streamId);
      if (!stream || !stream.settings.enableDonations) {
        socket.emit('error', { message: 'Donations not available' });
        return;
      }

      // Validate donation amount
      if (
        data.amount < STREAMING_CONFIG.DONATIONS.minAmount ||
        data.amount > STREAMING_CONFIG.DONATIONS.maxAmount
      ) {
        socket.emit('error', { message: 'Invalid donation amount' });
        return;
      }

      const donation: StreamDonation = {
        id: `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        streamId: data.streamId,
        donorId: user.id,
        donorName: user.name,
        amount: data.amount,
        currency: 'USD', // Default currency
        message: data.message,
        isAnonymous: false,
        createdAt: new Date(),
        status: 'pending',
      };

      // Process payment (integrate with Stripe)
      const paymentResult = await this.processStreamDonation(donation);

      if (paymentResult.success) {
        donation.status = 'completed';
        stream.metadata.totalDonations += data.amount;

        // Create donation chat message
        const donationChatMessage: StreamChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          streamId: data.streamId,
          userId: user.id,
          userName: user.name,
          avatar: user.avatar,
          content: data.message || `Donated $${data.amount}!`,
          type: 'donation',
          isModerated: false,
          createdAt: new Date(),
          metadata: {
            donationAmount: data.amount,
          },
        };

        // Broadcast donation
        this.io.to(data.streamId).emit('stream_donation', {
          donation,
          chatMessage: donationChatMessage,
        });

        // Save to database
        await this.saveDonation(donation);
        await this.saveChatMessage(donationChatMessage);

        socket.emit('donation_success', { donation });

        logger.info('Stream donation processed', {
          streamId: data.streamId,
          donorId: user.id,
          amount: data.amount,
        });
      } else {
        donation.status = 'failed';
        socket.emit('error', { message: paymentResult.error || 'Payment failed' });
      }
    } catch (error) {
      logger.error('Failed to process stream donation', { userId: user.id, error });
      socket.emit('error', { message: 'Failed to process donation' });
    }
  }

  private async handleStreamLike(socket: any, data: { streamId: string }): Promise<void> {
    const user = socket.data.user;

    try {
      const stream = this.activeStreams.get(data.streamId);
      if (!stream) return;

      stream.metadata.likes++;

      // Broadcast like
      this.io.to(data.streamId).emit('stream_liked', {
        streamId: data.streamId,
        userId: user.id,
        userName: user.name,
        totalLikes: stream.metadata.likes,
      });
    } catch (error) {
      logger.error('Failed to handle stream like', { userId: user.id, error });
    }
  }

  private async handleStreamShare(socket: any, data: { streamId: string }): Promise<void> {
    const stream = this.activeStreams.get(data.streamId);
    if (!stream) return;

    stream.metadata.shares++;

    // Track share analytics
    await analyticsMonitor.trackEvent({
      eventType: 'content_shared',
      timestamp: Date.now(),
      sessionId: socket.id,
      contentId: data.streamId,
      properties: {
        type: 'live_stream',
        platform: 'web',
      },
      context: {
        platform: 'web',
        deviceType: 'desktop',
      },
    });
  }

  private async handleChangeQuality(
    socket: any,
    data: {
      streamId: string;
      quality: string;
    }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      const viewers = this.streamViewers.get(data.streamId);
      if (!viewers) return;

      const viewer = viewers.get(user.id);
      if (!viewer) return;

      viewer.quality = data.quality;

      socket.emit('quality_changed', {
        streamId: data.streamId,
        quality: data.quality,
      });
    } catch (error) {
      logger.error('Failed to change quality', { userId: user.id, error });
    }
  }

  private async handleDisconnection(socket: any): Promise<void> {
    const user = socket.data.user;

    if (user) {
      // Remove from all stream viewer lists
      for (const [streamId, viewers] of this.streamViewers.entries()) {
        if (viewers.has(user.id)) {
          await this.handleLeaveStream(socket, { streamId });
        }
      }

      logger.info('User disconnected from streaming', {
        userId: user.id,
        socketId: socket.id,
      });
    }
  }

  // Helper methods (implementation details)
  private async getUserFromDatabase(userId: string): Promise<any> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          stripeAccountId: true,
        },
      });

      return user;
    } catch (error) {
      logger.error('Failed to get user from database', { userId, error });
      return null;
    }
  }

  private async canUserStream(userId: string): Promise<boolean> {
    try {
      // Check if user is an artist
      const user = await prisma.users.findFirst({
        where: {
          id: userId,
          role: 'ARTIST',
        },
      });

      if (!user) {
        return false;
      }

      // Check if user has Stripe account set up
      if (!user.stripeAccountId) {
        logger.warn('Artist cannot stream without Stripe account', { userId });
        return false;
      }

      // Check if user has any active subscriptions or is verified
      // You can add additional business logic here
      return true;
    } catch (error) {
      logger.error('Failed to check streaming permissions', { userId, error });
      return false;
    }
  }

  private async checkStreamAccess(userId: string, stream: StreamSession): Promise<boolean> {
    try {
      // Public streams are accessible to everyone
      if (stream.isPrivate === false) {
        return true;
      }

      // Stream owner always has access
      if (stream.streamerId === userId) {
        return true;
      }

      // Check tier-based access
      if (stream.settings.subscribersOnly) {
        const subscription = await prisma.subscriptions.findFirst({
          where: {
            fanId: userId,
            artistId: stream.streamerId,
            status: 'ACTIVE',
          },
        });

        if (!subscription) {
          return false;
        }

        // If specific tiers are required, check if user has one of them
        const requiredTiers = JSON.parse(stream.settings.rtmpKey || '[]');
        if (requiredTiers.length > 0) {
          return requiredTiers.includes(subscription.tierId);
        }

        return true;
      }

      // Check payment requirement
      if (stream.metadata.totalDonations > 0) {
        // You can add logic to check if user has paid for stream access
        return true;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check stream access', { userId, streamId: stream.id, error });
      return false;
    }
  }

  private async canUserChat(userId: string, stream: StreamSession): Promise<boolean> {
    try {
      if (!stream.settings.enableChat) {
        return false;
      }

      // Check if user is banned or muted
      // You can implement a ban/mute system here

      // Check if chat is subscribers-only
      if (stream.settings.subscribersOnly) {
        const subscription = await prisma.subscriptions.findFirst({
          where: {
            fanId: userId,
            artistId: stream.streamerId,
            status: 'ACTIVE',
          },
        });

        return !!subscription;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check chat permissions', { userId, streamId: stream.id, error });
      return false;
    }
  }

  private async getStreamerInfo(streamerId: string): Promise<any> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: streamerId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          bio: true,
          role: true,
          artists: {
            select: {
              displayName: true,
              bio: true,
              profilePicture: true,
              _count: {
                select: {
                  subscriptions: true,
                  content: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar || user.artists[0]?.profilePicture,
        bio: user.bio || user.artists[0]?.bio,
        displayName: user.artists[0]?.displayName || user.name,
        subscriberCount: user.artists[0]?._count?.subscriptions || 0,
        contentCount: user.artists[0]?._count?.content || 0,
      };
    } catch (error) {
      logger.error('Failed to get streamer info', { streamerId, error });
      return null;
    }
  }

  private async getStreamerSocket(streamerId: string): Promise<any> {
    try {
      // Find the socket for the streamer
      const sockets = await this.io.fetchSockets();
      const streamerSocket = sockets.find(socket => socket.data.user?.id === streamerId);
      return streamerSocket || null;
    } catch (error) {
      logger.error('Failed to get streamer socket', { streamerId, error });
      return null;
    }
  }

  private async sendUserStreams(socket: any): Promise<void> {
    try {
      const user = socket.data.user;
      if (!user) return;

      // Get user's active streams (if they're an artist)
      const streams = await prisma.live_streams.findMany({
        where: {
          artistId: user.id,
          status: {
            in: ['LIVE', 'SCHEDULED', 'STARTING'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      socket.emit('user_streams', {
        streams: streams.map(stream => ({
          id: stream.id,
          title: stream.title,
          status: stream.status,
          scheduledAt: stream.scheduledAt,
          startedAt: stream.startedAt,
          viewerCount: stream.totalViewers,
        })),
      });
    } catch (error) {
      logger.error('Failed to send user streams', { userId: socket.data.user?.id, error });
    }
  }

  private async getStreamChatHistory(streamId: string, limit: number = 50): Promise<StreamChatMessage[]> {
    try {
      const messages = await prisma.stream_chat_messages.findMany({
        where: {
          streamId,
          isModerated: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return messages.map(msg => ({
        id: msg.id,
        streamId: msg.streamId,
        userId: msg.senderId || 'anonymous',
        userName: msg.senderName,
        avatar: undefined,
        content: msg.message,
        type: msg.type.toLowerCase() as 'message' | 'donation' | 'subscription' | 'system',
        isModerated: msg.isModerated,
        createdAt: msg.createdAt,
      })).reverse(); // Reverse to show oldest first
    } catch (error) {
      logger.error('Failed to get chat history', { streamId, error });
      return [];
    }
  }

  private async notifyStreamStart(streamId: string): Promise<void> {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) return;

      // Get all subscribers of the artist
      const subscribers = await prisma.subscriptions.findMany({
        where: {
          artistId: stream.streamerId,
          status: 'ACTIVE',
        },
        include: {
          fan: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      const streamerInfo = await this.getStreamerInfo(stream.streamerId);

      // Send notifications to all subscribers
      const notificationPromises = subscribers.map(async sub => {
        try {
          // Import notification service dynamically to avoid circular dependency
          const { sendNotification } = await import('../notifications');

          await sendNotification({
            userId: sub.fanId,
            type: 'content_uploaded', // Reusing existing type
            title: `${streamerInfo?.displayName || 'An artist'} is now live!`,
            message: `${stream.title} - Join the stream now!`,
            data: {
              streamId: stream.id,
              streamUrl: `/stream/${stream.id}`,
              artistId: stream.streamerId,
            },
            channels: ['email', 'push', 'in_app'],
            priority: 'high',
          });
        } catch (error) {
          logger.error('Failed to notify subscriber', { subscriberId: sub.fanId, error });
        }
      });

      await Promise.allSettled(notificationPromises);

      logger.info('Notified subscribers of stream start', {
        streamId,
        subscriberCount: subscribers.length,
      });
    } catch (error) {
      logger.error('Failed to notify stream start', { streamId, error });
    }
  }

  private async handleModerateMessage(
    socket: any,
    data: { messageId: string; action: 'delete' | 'timeout' }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      // Get the message
      const message = await prisma.stream_chat_messages.findUnique({
        where: { id: data.messageId },
        include: {
          live_streams: {
            select: {
              artistId: true,
            },
          },
        },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if user is the stream owner
      if (message.live_streams.artistId !== user.id) {
        socket.emit('error', { message: 'Not authorized to moderate' });
        return;
      }

      if (data.action === 'delete') {
        // Mark message as moderated
        await prisma.stream_chat_messages.update({
          where: { id: data.messageId },
          data: {
            isModerated: true,
            moderatedBy: user.id,
            moderationReason: 'Deleted by moderator',
          },
        });

        // Broadcast message deletion
        this.io.to(message.streamId).emit('message_deleted', {
          messageId: data.messageId,
          streamId: message.streamId,
        });

        logger.info('Message moderated', {
          messageId: data.messageId,
          streamId: message.streamId,
          action: data.action,
          moderatorId: user.id,
        });
      } else if (data.action === 'timeout') {
        // Implement timeout logic - remove user from stream temporarily
        // This would require a separate timeout tracking system
        logger.info('User timeout requested', {
          userId: message.senderId,
          streamId: message.streamId,
        });
      }
    } catch (error) {
      logger.error('Failed to moderate message', { messageId: data.messageId, error });
      socket.emit('error', { message: 'Failed to moderate message' });
    }
  }

  private generateRTMPKey(): string {
    return `rtmp_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async setupStreamDirectory(streamId: string): Promise<void> {
    const streamDir = path.join(process.cwd(), 'streams', streamId);
    await fs.mkdir(streamDir, { recursive: true });
  }

  private async startRecording(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const outputPath = path.join(process.cwd(), 'streams', streamId, 'recording.mp4');
    stream.recordingPath = outputPath;

    // Start FFmpeg recording process
    const ffmpegArgs = [
      '-f',
      'flv',
      '-i',
      `rtmp://localhost:${STREAMING_CONFIG.RTMP.port}/live/${stream.settings.rtmpKey}`,
      '-c:v',
      STREAMING_CONFIG.RECORDING.videoCodec,
      '-c:a',
      STREAMING_CONFIG.RECORDING.audioCodec,
      '-crf',
      STREAMING_CONFIG.RECORDING.crf.toString(),
      '-preset',
      STREAMING_CONFIG.RECORDING.preset,
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    this.recordingProcesses.set(streamId, ffmpeg);

    ffmpeg.on('error', error => {
      logger.error('Recording process error', { streamId, error });
    });

    logger.info('Started recording', { streamId, outputPath });
  }

  private async stopRecording(streamId: string): Promise<void> {
    const process = this.recordingProcesses.get(streamId);
    if (process) {
      process.kill('SIGTERM');
      this.recordingProcesses.delete(streamId);
      logger.info('Stopped recording', { streamId });
    }
  }

  private async setupStreamProcessing(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    try {
      // Setup adaptive bitrate streaming with multiple quality levels
      // This creates HLS (HTTP Live Streaming) segments for different quality levels

      const streamDir = path.join(process.cwd(), 'streams', streamId);
      const hlsDir = path.join(streamDir, 'hls');
      await fs.mkdir(hlsDir, { recursive: true });

      // Create FFmpeg process for each quality level
      const qualities = stream.settings.qualities.filter(q => q.enabled);

      for (const quality of qualities) {
        const outputPath = path.join(hlsDir, `${quality.name}.m3u8`);

        const ffmpegArgs = [
          '-f',
          'flv',
          '-i',
          `rtmp://localhost:${STREAMING_CONFIG.RTMP.port}/live/${stream.settings.rtmpKey}`,
          '-c:v',
          'libx264',
          '-c:a',
          'aac',
          '-b:v',
          `${quality.bitrate}`,
          '-s',
          `${quality.width}x${quality.height}`,
          '-r',
          `${quality.framerate}`,
          '-f',
          'hls',
          '-hls_time',
          STREAMING_CONFIG.STREAM.segmentDuration.toString(),
          '-hls_list_size',
          '6',
          '-hls_flags',
          'delete_segments',
          '-hls_segment_filename',
          path.join(hlsDir, `${quality.name}_%03d.ts`),
          outputPath,
        ];

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        ffmpeg.stderr.on('data', data => {
          // Log FFmpeg output for debugging
          logger.debug(`FFmpeg ${quality.name}`, { output: data.toString() });
        });

        ffmpeg.on('error', error => {
          logger.error('Stream processing error', { streamId, quality: quality.name, error });
        });

        ffmpeg.on('close', code => {
          logger.info('Stream processing ended', { streamId, quality: quality.name, code });
        });

        this.streamProcesses.set(`${streamId}_${quality.name}`, ffmpeg);
      }

      // Generate master playlist that references all quality levels
      const masterPlaylist = this.generateMasterPlaylist(qualities);
      await fs.writeFile(path.join(hlsDir, 'master.m3u8'), masterPlaylist);

      logger.info('Stream processing setup complete', {
        streamId,
        qualities: qualities.map(q => q.name),
      });
    } catch (error) {
      logger.error('Failed to setup stream processing', { streamId, error });
      // Don't throw - stream can still work without adaptive bitrate
    }
  }

  private generateMasterPlaylist(qualities: StreamQuality[]): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    for (const quality of qualities) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bitrate},RESOLUTION=${quality.width}x${quality.height},NAME="${quality.name}"\n`;
      playlist += `${quality.name}.m3u8\n\n`;
    }

    return playlist;
  }

  private async stopStreamProcessing(streamId: string): Promise<void> {
    // Stop all quality-specific processes for this stream
    const processesToStop: string[] = [];

    for (const [key, process] of this.streamProcesses.entries()) {
      if (key.startsWith(`${streamId}_`)) {
        process.kill('SIGTERM');
        processesToStop.push(key);
      }
    }

    // Remove from map
    for (const key of processesToStop) {
      this.streamProcesses.delete(key);
    }

    if (processesToStop.length > 0) {
      logger.info('Stopped stream processing', { streamId, processCount: processesToStop.length });
    }
  }

  private async processStreamRecording(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream || !stream.recordingPath) return;

    try {
      // Upload recording to S3
      const s3Key = `streams/recordings/${streamId}/recording.mp4`;
      const recordingUrl = await uploadToS3(stream.recordingPath, s3Key);

      // Update stream with recording URL
      await this.updateStreamRecording(streamId, recordingUrl);

      // Clean up local file
      await fs.unlink(stream.recordingPath);

      logger.info('Stream recording processed', { streamId, recordingUrl });
    } catch (error) {
      logger.error('Failed to process stream recording', { streamId, error });
    }
  }

  private moderateMessage(
    message: string,
    moderationType: StreamSettings['chatModeration']
  ): boolean {
    if (moderationType === 'disabled') return false;
    if (moderationType === 'manual') return false;

    // Keyword-based moderation
    const lowerMessage = message.toLowerCase();
    return STREAMING_CONFIG.CHAT.moderationKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Database operations (implement based on your schema)
  private async saveStreamToDatabase(stream: StreamSession): Promise<void> {
    try {
      await prisma.live_streams.create({
        data: {
          id: stream.id,
          artistId: stream.streamerId,
          title: stream.title,
          description: stream.description,
          status: stream.status.toUpperCase(),
          streamKey: stream.settings.rtmpKey || '',
          maxViewers: stream.maxViewers || STREAMING_CONFIG.STREAM.maxViewers,
          isRecorded: stream.settings.enableRecording,
          recordingUrl: stream.recordingPath,
          thumbnailUrl: stream.thumbnailUrl,
          scheduledAt: stream.scheduledStart,
          startedAt: stream.actualStart,
          endedAt: stream.endTime,
          peakViewers: stream.metadata.peakViewers,
          totalViewers: stream.metadata.totalViews,
          totalTips: stream.metadata.totalDonations,
          totalMessages: stream.metadata.chatMessages,
          tierIds: JSON.stringify([]), // Store as JSON string
          isPublic: !stream.isPrivate,
          requiresPayment: false,
          paymentAmount: null,
          updatedAt: new Date(),
        },
      });

      logger.info('Stream saved to database', { streamId: stream.id });
    } catch (error) {
      logger.error('Failed to save stream to database', { streamId: stream.id, error });
      throw error;
    }
  }

  private async updateStreamInDatabase(stream: StreamSession): Promise<void> {
    try {
      await prisma.live_streams.update({
        where: { id: stream.id },
        data: {
          status: stream.status.toUpperCase(),
          startedAt: stream.actualStart,
          endedAt: stream.endTime,
          peakViewers: stream.metadata.peakViewers,
          totalViewers: stream.metadata.totalViews,
          totalTips: stream.metadata.totalDonations,
          totalMessages: stream.metadata.chatMessages,
          recordingUrl: stream.recordingPath,
          thumbnailUrl: stream.thumbnailUrl,
          updatedAt: new Date(),
        },
      });

      logger.info('Stream updated in database', { streamId: stream.id, status: stream.status });
    } catch (error) {
      logger.error('Failed to update stream in database', { streamId: stream.id, error });
      throw error;
    }
  }

  private async saveChatMessage(message: StreamChatMessage): Promise<void> {
    try {
      await prisma.stream_chat_messages.create({
        data: {
          id: message.id,
          streamId: message.streamId,
          senderId: message.userId !== 'anonymous' ? message.userId : null,
          senderName: message.userName,
          message: message.content,
          type: message.type.toUpperCase(),
          isHighlighted: message.type === 'donation' || message.type === 'subscription',
          isModerated: message.isModerated,
          moderatedBy: null,
          moderationReason: null,
          createdAt: message.createdAt,
        },
      });

      logger.debug('Chat message saved', { messageId: message.id, streamId: message.streamId });
    } catch (error) {
      logger.error('Failed to save chat message', { messageId: message.id, error });
      // Don't throw - chat messages should not break the stream
    }
  }

  private async saveDonation(donation: StreamDonation): Promise<void> {
    try {
      await prisma.stream_tips.create({
        data: {
          id: donation.id,
          streamId: donation.streamId,
          tipperId: donation.donorId !== 'anonymous' ? donation.donorId : null,
          tipperName: donation.donorName,
          amount: donation.amount,
          message: donation.message,
          currency: donation.currency,
          stripePaymentIntentId: null, // Will be updated when payment is processed
          status: donation.status.toUpperCase(),
          processedAt: donation.status === 'completed' ? new Date() : null,
          createdAt: donation.createdAt,
        },
      });

      logger.info('Donation saved to database', {
        donationId: donation.id,
        amount: donation.amount,
        streamId: donation.streamId,
      });
    } catch (error) {
      logger.error('Failed to save donation', { donationId: donation.id, error });
      throw error;
    }
  }

  private async processStreamDonation(
    donation: StreamDonation
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import Stripe dynamically
      const { stripe } = await import('../stripe');

      // Get stream info to get artist's Stripe account
      const stream = this.activeStreams.get(donation.streamId);
      if (!stream) {
        return { success: false, error: 'Stream not found' };
      }

      const artist = await prisma.users.findUnique({
        where: { id: stream.streamerId },
        select: { stripeAccountId: true },
      });

      if (!artist?.stripeAccountId) {
        return { success: false, error: 'Artist Stripe account not configured' };
      }

      // Create payment intent
      const amountInCents = Math.round(donation.amount * 100);
      const platformFee = Math.round(
        amountInCents * STREAMING_CONFIG.DONATIONS.platformFee
      );
      const artistAmount = amountInCents - platformFee;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: donation.currency.toLowerCase(),
        application_fee_amount: platformFee,
        transfer_data: {
          destination: artist.stripeAccountId,
        },
        metadata: {
          donationId: donation.id,
          streamId: donation.streamId,
          donorId: donation.donorId,
          donorName: donation.donorName,
        },
        description: `Stream tip: ${donation.message || 'No message'}`,
      });

      // Update donation with payment intent ID
      await prisma.stream_tips.update({
        where: { id: donation.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      logger.info('Donation payment processed', {
        donationId: donation.id,
        paymentIntentId: paymentIntent.id,
        amount: donation.amount,
        artistAmount: artistAmount / 100,
        platformFee: platformFee / 100,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to process donation payment', {
        donationId: donation.id,
        error: error.message,
      });

      // Update donation status to failed
      try {
        await prisma.stream_tips.update({
          where: { id: donation.id },
          data: {
            status: 'FAILED',
          },
        });
      } catch (updateError) {
        logger.error('Failed to update donation status', { donationId: donation.id, updateError });
      }

      return { success: false, error: error.message };
    }
  }

  private async updateStreamRecording(streamId: string, recordingUrl: string): Promise<void> {
    try {
      await prisma.live_streams.update({
        where: { id: streamId },
        data: {
          recordingUrl,
          updatedAt: new Date(),
        },
      });

      // Also create a stream_recordings entry for tracking
      await prisma.stream_recordings.create({
        data: {
          id: `recording_${streamId}_${Date.now()}`,
          streamId,
          fileUrl: recordingUrl,
          fileSize: 0, // Can be populated if we track file size
          duration: 0, // Can be calculated from stream duration
          format: 'mp4',
          createdAt: new Date(),
        },
      });

      logger.info('Stream recording URL updated', { streamId, recordingUrl });
    } catch (error) {
      logger.error('Failed to update stream recording', { streamId, error });
      throw error;
    }
  }

  private async updateStreamAnalytics(streamId: string): Promise<void> {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) return;

      // Calculate final analytics
      const duration = stream.endTime && stream.actualStart
        ? stream.endTime.getTime() - stream.actualStart.getTime()
        : stream.metadata.duration;

      // Get viewer statistics
      const viewers = await prisma.stream_viewers.findMany({
        where: { streamId },
        select: {
          watchTime: true,
          leftAt: true,
          joinedAt: true,
        },
      });

      const totalWatchTime = viewers.reduce((sum, v) => sum + v.watchTime, 0);
      const averageWatchTime = viewers.length > 0 ? totalWatchTime / viewers.length : 0;

      // Get total tips
      const tips = await prisma.stream_tips.aggregate({
        where: {
          streamId,
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      });

      const totalTips = tips._sum.amount || 0;

      // Update stream with final analytics
      await prisma.live_streams.update({
        where: { id: streamId },
        data: {
          totalTips,
          totalViewers: stream.metadata.totalViews,
          peakViewers: stream.metadata.peakViewers,
          totalMessages: stream.metadata.chatMessages,
          updatedAt: new Date(),
        },
      });

      logger.info('Stream analytics updated', {
        streamId,
        duration: Math.round(duration / 1000),
        totalViewers: stream.metadata.totalViews,
        peakViewers: stream.metadata.peakViewers,
        totalTips: Number(totalTips),
        averageWatchTime: Math.round(averageWatchTime),
      });
    } catch (error) {
      logger.error('Failed to update stream analytics', { streamId, error });
      // Don't throw - analytics failure shouldn't prevent stream ending
    }
  }

  private setupCleanupHandlers(): void {
    // Cleanup on server shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down streaming server');

    // Stop all active streams
    for (const streamId of this.activeStreams.keys()) {
      await this.stopRecording(streamId);
      await this.stopStreamProcessing(streamId);
    }

    // Close connections
    await this.redis.quit();
    this.io.close();

    logger.info('Streaming server shutdown complete');
  }
}

// Export singleton factory
export const createStreamingServer = (httpServer: HTTPServer): StreamingServer => {
  return new StreamingServer(httpServer);
};

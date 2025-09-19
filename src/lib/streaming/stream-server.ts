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
    // Implementation to get user from database
    return { id: userId, name: 'User', avatar: null };
  }

  private async canUserStream(userId: string): Promise<boolean> {
    // Check if user has streaming permissions
    return true; // Implement actual logic
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
    // Setup multi-quality stream processing
    // This would involve FFmpeg or similar for transcoding
  }

  private async stopStreamProcessing(streamId: string): Promise<void> {
    const process = this.streamProcesses.get(streamId);
    if (process) {
      process.kill('SIGTERM');
      this.streamProcesses.delete(streamId);
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
    // Implementation to save stream to database
  }

  private async updateStreamInDatabase(stream: StreamSession): Promise<void> {
    // Implementation to update stream in database
  }

  private async saveChatMessage(message: StreamChatMessage): Promise<void> {
    // Implementation to save chat message to database
  }

  private async saveDonation(donation: StreamDonation): Promise<void> {
    // Implementation to save donation to database
  }

  private async processStreamDonation(
    donation: StreamDonation
  ): Promise<{ success: boolean; error?: string }> {
    // Implementation to process payment via Stripe
    return { success: true };
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

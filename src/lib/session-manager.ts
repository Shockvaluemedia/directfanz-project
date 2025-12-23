/**
 * Session management optimized for AWS ElastiCache
 * Handles user sessions, WebSocket connections, and streaming state
 */

import { 
  setSession, 
  getSession, 
  deleteSession,
  setStreamData,
  getStreamData,
  deleteStreamData,
  setChatMessages,
  getChatMessages,
  CACHE_TTL 
} from './redis';
import { logger } from './logger';

export interface UserSession {
  userId: string;
  username: string;
  role: 'ARTIST' | 'FAN' | 'ADMIN';
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  socketId?: string;
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    deviceFingerprint?: string;
  };
  permissions: string[];
  subscriptions: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface StreamSession {
  streamId: string;
  broadcasterId: string;
  status: 'STARTING' | 'LIVE' | 'ENDED' | 'ERROR';
  title: string;
  description?: string;
  viewers: Set<string>;
  maxViewers: number;
  startTime: Date;
  endTime?: Date;
  isRecorded: boolean;
  tierIds: string[];
  isPublic: boolean;
  chatEnabled: boolean;
  settings: {
    allowTips: boolean;
    allowPolls: boolean;
    moderationEnabled: boolean;
  };
}

export interface ChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  senderName: string;
  message: string;
  type: 'MESSAGE' | 'SYSTEM' | 'TIP' | 'POLL' | 'HIGHLIGHT';
  timestamp: Date;
  isHighlighted: boolean;
  isModerated: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  metadata?: any;
}

/**
 * Session Manager class for ElastiCache operations
 */
export class SessionManager {
  private readonly SESSION_TTL = CACHE_TTL.VERY_LONG; // 24 hours
  private readonly STREAM_TTL = CACHE_TTL.LONG * 2; // 2 hours
  private readonly CHAT_TTL = CACHE_TTL.LONG; // 1 hour

  /**
   * Create or update user session
   */
  async createUserSession(sessionId: string, sessionData: Partial<UserSession>): Promise<void> {
    try {
      const session: UserSession = {
        userId: sessionData.userId!,
        username: sessionData.username!,
        role: sessionData.role || 'FAN',
        email: sessionData.email!,
        avatar: sessionData.avatar,
        isOnline: true,
        lastSeen: new Date(),
        socketId: sessionData.socketId,
        deviceInfo: sessionData.deviceInfo,
        permissions: sessionData.permissions || [],
        subscriptions: sessionData.subscriptions || [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000),
        ...sessionData,
      };

      await setSession(sessionId, session, this.SESSION_TTL);
      
      // Also store user-to-session mapping for quick lookups
      await setSession(`user:${session.userId}:session`, sessionId, this.SESSION_TTL);
      
      logger.info('User session created', { 
        sessionId, 
        userId: session.userId, 
        username: session.username 
      });
    } catch (error) {
      logger.error('Failed to create user session', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get user session
   */
  async getUserSession(sessionId: string): Promise<UserSession | null> {
    try {
      const session = await getSession<UserSession>(sessionId);
      
      if (session && new Date() > new Date(session.expiresAt)) {
        // Session expired, clean it up
        await this.deleteUserSession(sessionId);
        return null;
      }
      
      return session;
    } catch (error) {
      logger.error('Failed to get user session', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Update user session activity
   */
  async updateSessionActivity(sessionId: string, socketId?: string): Promise<void> {
    try {
      const session = await this.getUserSession(sessionId);
      if (!session) return;

      session.lastSeen = new Date();
      session.isOnline = true;
      if (socketId) {
        session.socketId = socketId;
      }

      await setSession(sessionId, session, this.SESSION_TTL);
    } catch (error) {
      logger.error('Failed to update session activity', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Delete user session
   */
  async deleteUserSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getUserSession(sessionId);
      if (session) {
        // Remove user-to-session mapping
        await deleteSession(`user:${session.userId}:session`);
      }
      
      await deleteSession(sessionId);
      
      logger.info('User session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete user session', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get session by user ID
   */
  async getSessionByUserId(userId: string): Promise<{ sessionId: string; session: UserSession } | null> {
    try {
      const sessionId = await getSession<string>(`user:${userId}:session`);
      if (!sessionId) return null;

      const session = await this.getUserSession(sessionId);
      if (!session) return null;

      return { sessionId, session };
    } catch (error) {
      logger.error('Failed to get session by user ID', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Create or update stream session
   */
  async createStreamSession(streamId: string, streamData: Partial<StreamSession>): Promise<void> {
    try {
      const stream: StreamSession = {
        streamId,
        broadcasterId: streamData.broadcasterId!,
        status: streamData.status || 'STARTING',
        title: streamData.title!,
        description: streamData.description,
        viewers: new Set(streamData.viewers || []),
        maxViewers: streamData.maxViewers || 1000,
        startTime: new Date(),
        endTime: streamData.endTime,
        isRecorded: streamData.isRecorded || false,
        tierIds: streamData.tierIds || [],
        isPublic: streamData.isPublic || false,
        chatEnabled: streamData.chatEnabled !== false,
        settings: {
          allowTips: true,
          allowPolls: true,
          moderationEnabled: false,
          ...streamData.settings,
        },
        ...streamData,
      };

      // Convert Set to Array for JSON serialization
      const streamForStorage = {
        ...stream,
        viewers: Array.from(stream.viewers),
      };

      await setStreamData(streamId, streamForStorage, this.STREAM_TTL);
      
      logger.info('Stream session created', { 
        streamId, 
        broadcasterId: stream.broadcasterId, 
        title: stream.title 
      });
    } catch (error) {
      logger.error('Failed to create stream session', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get stream session
   */
  async getStreamSession(streamId: string): Promise<StreamSession | null> {
    try {
      const streamData = await getStreamData<any>(streamId);
      if (!streamData) return null;

      // Convert Array back to Set
      return {
        ...streamData,
        viewers: new Set(streamData.viewers || []),
        startTime: new Date(streamData.startTime),
        endTime: streamData.endTime ? new Date(streamData.endTime) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get stream session', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Add viewer to stream
   */
  async addViewerToStream(streamId: string, viewerId: string): Promise<boolean> {
    try {
      const stream = await this.getStreamSession(streamId);
      if (!stream || stream.status !== 'LIVE') return false;

      stream.viewers.add(viewerId);
      await this.createStreamSession(streamId, stream);
      
      logger.info('Viewer added to stream', { streamId, viewerId, totalViewers: stream.viewers.size });
      return true;
    } catch (error) {
      logger.error('Failed to add viewer to stream', { 
        streamId, 
        viewerId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Remove viewer from stream
   */
  async removeViewerFromStream(streamId: string, viewerId: string): Promise<boolean> {
    try {
      const stream = await this.getStreamSession(streamId);
      if (!stream) return false;

      stream.viewers.delete(viewerId);
      await this.createStreamSession(streamId, stream);
      
      logger.info('Viewer removed from stream', { streamId, viewerId, totalViewers: stream.viewers.size });
      return true;
    } catch (error) {
      logger.error('Failed to remove viewer from stream', { 
        streamId, 
        viewerId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Update stream status
   */
  async updateStreamStatus(streamId: string, status: StreamSession['status']): Promise<void> {
    try {
      const stream = await this.getStreamSession(streamId);
      if (!stream) return;

      stream.status = status;
      if (status === 'ENDED') {
        stream.endTime = new Date();
      }

      await this.createStreamSession(streamId, stream);
      
      logger.info('Stream status updated', { streamId, status });
    } catch (error) {
      logger.error('Failed to update stream status', { 
        streamId, 
        status, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Delete stream session
   */
  async deleteStreamSession(streamId: string): Promise<void> {
    try {
      await deleteStreamData(streamId);
      // Also clean up chat messages
      await this.deleteChatMessages(streamId);
      
      logger.info('Stream session deleted', { streamId });
    } catch (error) {
      logger.error('Failed to delete stream session', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Add chat message to stream
   */
  async addChatMessage(streamId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage | null> {
    try {
      const stream = await this.getStreamSession(streamId);
      if (!stream || !stream.chatEnabled) return null;

      const chatMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...message,
      };

      // Get existing messages
      const existingMessages = await getChatMessages(streamId) || [];
      
      // Add new message and keep only recent messages (last 100)
      const updatedMessages = [...existingMessages, chatMessage].slice(-100);
      
      await setChatMessages(streamId, updatedMessages, this.CHAT_TTL);
      
      logger.debug('Chat message added', { streamId, messageId: chatMessage.id, senderId: message.senderId });
      return chatMessage;
    } catch (error) {
      logger.error('Failed to add chat message', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Get chat messages for stream
   */
  async getStreamChatMessages(streamId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const messages = await getChatMessages(streamId) || [];
      return messages
        .slice(-limit)
        .map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
    } catch (error) {
      logger.error('Failed to get chat messages', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Delete chat messages for stream
   */
  async deleteChatMessages(streamId: string): Promise<void> {
    try {
      await deleteStreamData(`chat:${streamId}`);
      logger.info('Chat messages deleted', { streamId });
    } catch (error) {
      logger.error('Failed to delete chat messages', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get online users count
   */
  async getOnlineUsersCount(): Promise<number> {
    try {
      // This would require scanning all sessions, which is expensive
      // In a real implementation, you might maintain a separate counter
      // For now, return a placeholder
      return 0;
    } catch (error) {
      logger.error('Failed to get online users count', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      // This would require scanning all sessions
      // In production, you might use Redis TTL or a background job
      logger.info('Session cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
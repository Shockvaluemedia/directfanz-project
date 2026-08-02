/**
 * Streaming Authentication Service
 * 
 * Handles HLS playback URL generation with adaptive bitrate streaming
 * and access control for live streams.
 * Requirements: 7.3, 7.4
 */

import { createHash, createHmac } from 'crypto';

// Types
export interface StreamConfig {
  channelArn: string;
  playbackUrl: string;
  cdnDomain?: string;
  recordingEnabled: boolean;
  maxViewers?: number;
}

export interface PlaybackOptions {
  quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
  startTime?: number;
  userId?: string;
  subscriptionTier?: string;
  accessToken?: string;
}

export interface StreamAccess {
  hasAccess: boolean;
  reason?: string;
  allowedQualities: string[];
  expiresAt?: number;
}

export interface AdaptiveBitrateConfig {
  qualities: Array<{
    name: string;
    width: number;
    height: number;
    bitrate: number;
    enabled: boolean;
  }>;
  defaultQuality: string;
  adaptationEnabled: boolean;
}

// Constants
const STREAM_SECRET = process.env.STREAM_SECRET || 'default-stream-secret';
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour
const QUALITY_LEVELS = [
  { name: '1080p', width: 1920, height: 1080, bitrate: 5000000 },
  { name: '720p', width: 1280, height: 720, bitrate: 3000000 },
  { name: '480p', width: 854, height: 480, bitrate: 1500000 },
  { name: '360p', width: 640, height: 360, bitrate: 800000 },
];

class StreamingAuthService {
  private streamConfigs = new Map<string, StreamConfig>();
  private activeStreams = new Map<string, { viewers: number; startedAt: number }>();

  // Stream configuration
  registerStream(streamId: string, config: StreamConfig): void {
    this.streamConfigs.set(streamId, config);
  }

  getStreamConfig(streamId: string): StreamConfig | null {
    return this.streamConfigs.get(streamId) || null;
  }

  // Access control
  async checkStreamAccess(streamId: string, userId?: string, subscriptionTier?: string): Promise<StreamAccess> {
    const config = this.getStreamConfig(streamId);
    if (!config) {
      return { hasAccess: false, reason: 'Stream not found', allowedQualities: [] };
    }

    // Check if stream is live
    const isLive = this.activeStreams.has(streamId);
    if (!isLive) {
      return { hasAccess: false, reason: 'Stream is not live', allowedQualities: [] };
    }

    // Check viewer limit
    const streamInfo = this.activeStreams.get(streamId)!;
    if (config.maxViewers && streamInfo.viewers >= config.maxViewers) {
      return { hasAccess: false, reason: 'Stream at capacity', allowedQualities: [] };
    }

    // Determine allowed qualities based on subscription tier
    const allowedQualities = this.getAllowedQualities(subscriptionTier);

    return {
      hasAccess: true,
      allowedQualities,
      expiresAt: Date.now() + (DEFAULT_TOKEN_EXPIRY * 1000),
    };
  }

  private getAllowedQualities(subscriptionTier?: string): string[] {
    switch (subscriptionTier) {
      case 'premium':
        return ['1080p', '720p', '480p', '360p'];
      case 'standard':
        return ['720p', '480p', '360p'];
      case 'basic':
        return ['480p', '360p'];
      default:
        return ['360p']; // Free tier
    }
  }

  // Playback URL generation
  generatePlaybackUrl(streamId: string, options: PlaybackOptions = {}): string | null {
    const config = this.getStreamConfig(streamId);
    if (!config) return null;

    const baseUrl = config.cdnDomain 
      ? `https://${config.cdnDomain}`
      : config.playbackUrl;

    // Generate signed URL with access token
    const token = this.generateAccessToken(streamId, options);
    const params = new URLSearchParams({
      token,
      ...(options.quality && { quality: options.quality }),
      ...(options.startTime && { t: options.startTime.toString() }),
    });

    return `${baseUrl}/playlist.m3u8?${params.toString()}`;
  }

  private generateAccessToken(streamId: string, options: PlaybackOptions): string {
    const payload = {
      streamId,
      userId: options.userId,
      subscriptionTier: options.subscriptionTier,
      quality: options.quality || 'auto',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_EXPIRY,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', STREAM_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  // Adaptive bitrate configuration
  getAdaptiveBitrateConfig(subscriptionTier?: string): AdaptiveBitrateConfig {
    const allowedQualities = this.getAllowedQualities(subscriptionTier);
    
    return {
      qualities: QUALITY_LEVELS.map(level => ({
        ...level,
        enabled: allowedQualities.includes(level.name),
      })),
      defaultQuality: allowedQualities[0] || '360p',
      adaptationEnabled: allowedQualities.length > 1,
    };
  }

  // Stream lifecycle management
  startStream(streamId: string): void {
    this.activeStreams.set(streamId, {
      viewers: 0,
      startedAt: Date.now(),
    });
  }

  stopStream(streamId: string): void {
    this.activeStreams.delete(streamId);
  }

  addViewer(streamId: string): boolean {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return false;

    const config = this.getStreamConfig(streamId);
    if (config?.maxViewers && streamInfo.viewers >= config.maxViewers) {
      return false;
    }

    streamInfo.viewers++;
    return true;
  }

  removeViewer(streamId: string): void {
    const streamInfo = this.activeStreams.get(streamId);
    if (streamInfo && streamInfo.viewers > 0) {
      streamInfo.viewers--;
    }
  }

  getStreamStats(streamId: string): { viewers: number; duration: number } | null {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return null;

    return {
      viewers: streamInfo.viewers,
      duration: Date.now() - streamInfo.startedAt,
    };
  }

  // Quality selection helpers
  selectOptimalQuality(availableBandwidth: number, allowedQualities: string[]): string {
    // Sort qualities by bitrate (descending)
    const sortedQualities = QUALITY_LEVELS
      .filter(q => allowedQualities.includes(q.name))
      .sort((a, b) => b.bitrate - a.bitrate);

    // Select highest quality that fits bandwidth
    for (const quality of sortedQualities) {
      if (quality.bitrate <= availableBandwidth * 0.8) { // 80% of bandwidth
        return quality.name;
      }
    }

    // Fallback to lowest quality
    return sortedQualities[sortedQualities.length - 1]?.name || '360p';
  }

  // Network quality detection
  detectNetworkQuality(rtt: number, bandwidth: number, packetLoss: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (rtt < 50 && bandwidth > 5000000 && packetLoss < 0.01) {
      return 'excellent';
    } else if (rtt < 100 && bandwidth > 2000000 && packetLoss < 0.02) {
      return 'good';
    } else if (rtt < 200 && bandwidth > 1000000 && packetLoss < 0.05) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  getRecommendedQuality(networkQuality: 'excellent' | 'good' | 'fair' | 'poor', allowedQualities: string[]): string {
    const qualityMap = {
      excellent: '1080p',
      good: '720p',
      fair: '480p',
      poor: '360p',
    };

    const recommended = qualityMap[networkQuality];
    return allowedQualities.includes(recommended) ? recommended : allowedQualities[allowedQualities.length - 1];
  }

  // URL validation
  validatePlaybackUrl(url: string): { valid: boolean; streamId?: string; error?: string } {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      
      if (!token) {
        return { valid: false, error: 'Missing access token' };
      }

      const decoded = this.verifyAccessToken(token);
      if (!decoded) {
        return { valid: false, error: 'Invalid access token' };
      }

      return { valid: true, streamId: decoded.streamId };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  private verifyAccessToken(token: string): any {
    try {
      const [header, payload, signature] = token.split('.');
      
      const expectedSignature = createHmac('sha256', STREAM_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      // Check expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return decoded;
    } catch {
      return null;
    }
  }

  // Cleanup
  cleanup(): void {
    // Remove expired streams
    const now = Date.now();
    for (const [streamId, info] of this.activeStreams) {
      // Remove streams inactive for more than 1 hour
      if (now - info.startedAt > 3600000) {
        this.activeStreams.delete(streamId);
      }
    }
  }
}

// Export singleton instance
export const streamingAuthService = new StreamingAuthService();
export default streamingAuthService;
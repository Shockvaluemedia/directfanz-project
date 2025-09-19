/**
 * Media Streaming and Delivery Optimization System
 *
 * This module provides comprehensive streaming optimization with:
 * - CDN integration and intelligent routing
 * - Adaptive bitrate streaming (HLS/DASH)
 * - Progressive loading and preloading strategies
 * - Bandwidth detection and quality adaptation
 * - Edge caching and geographic optimization
 * - Mobile and connection-aware delivery
 */

import { logger } from '../logger';
import { ProcessingOutput } from './core';

// Streaming Configuration
export const STREAMING_CONFIG = {
  // CDN Settings
  CDN: {
    primaryDomain: process.env.AWS_CLOUDFRONT_DOMAIN || 'cdn.nahvee.com',
    fallbackDomains: [
      process.env.AWS_S3_BUCKET_NAME + '.s3.amazonaws.com',
      'backup-cdn.nahvee.com',
    ],
    regionMapping: {
      'us-east-1': 'us-east.cdn.nahvee.com',
      'us-west-2': 'us-west.cdn.nahvee.com',
      'eu-west-1': 'eu.cdn.nahvee.com',
      'ap-southeast-1': 'asia.cdn.nahvee.com',
    },
  },

  // Adaptive Bitrate Settings
  ABR: {
    qualities: [
      { name: '1080p', bandwidth: 5000000, resolution: '1920x1080' },
      { name: '720p', bandwidth: 3000000, resolution: '1280x720' },
      { name: '480p', bandwidth: 1500000, resolution: '854x480' },
      { name: '360p', bandwidth: 800000, resolution: '640x360' },
      { name: '240p', bandwidth: 400000, resolution: '426x240' },
    ],
    switchThreshold: 0.8, // Switch quality at 80% of bandwidth capacity
    bufferTargets: {
      low: 5, // 5 seconds for low quality
      medium: 10, // 10 seconds for medium quality
      high: 15, // 15 seconds for high quality
    },
  },

  // Progressive Loading
  PROGRESSIVE: {
    chunkSize: 1024 * 1024, // 1MB chunks
    preloadSize: 5 * 1024 * 1024, // 5MB preload
    maxConcurrentChunks: 3,
    enableRangeRequests: true,
  },

  // Connection Types
  CONNECTION_TYPES: {
    'slow-2g': { bandwidth: 50000, quality: '240p' },
    '2g': { bandwidth: 250000, quality: '360p' },
    '3g': { bandwidth: 750000, quality: '480p' },
    '4g': { bandwidth: 4000000, quality: '720p' },
    '5g': { bandwidth: 20000000, quality: '1080p' },
    wifi: { bandwidth: 10000000, quality: '1080p' },
    ethernet: { bandwidth: 50000000, quality: '1080p' },
  },

  // Cache Settings
  CACHE: {
    videoTTL: 7 * 24 * 60 * 60, // 7 days
    audioTTL: 30 * 24 * 60 * 60, // 30 days
    thumbnailTTL: 30 * 24 * 60 * 60, // 30 days
    hlsTTL: 60 * 60, // 1 hour for HLS segments
    edgeTTL: 24 * 60 * 60, // 24 hours at edge
  },
} as const;

// Interfaces
export interface StreamingManifest {
  type: 'hls' | 'dash' | 'progressive';
  masterPlaylist: string;
  qualities: QualityLevel[];
  thumbnails?: ThumbnailTrack;
  subtitles?: SubtitleTrack[];
  metadata: StreamingMetadata;
}

export interface QualityLevel {
  quality: string;
  bandwidth: number;
  resolution: string;
  url: string;
  codecs: string;
  frameRate?: number;
}

export interface ThumbnailTrack {
  url: string;
  interval: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
  format: 'vtt' | 'srt';
}

export interface StreamingMetadata {
  duration: number;
  contentType: 'video' | 'audio';
  artistId: string;
  contentId: string;
  tier?: string;
  isLive: boolean;
  drmProtected: boolean;
  geoRestrictions?: string[];
}

export interface BandwidthInfo {
  estimated: number;
  effective: string;
  rtt: number;
  downlink: number;
  type: string;
}

export interface DeliveryOptions {
  userLocation?: {
    country: string;
    region: string;
    coordinates?: [number, number];
  };
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop' | 'tv';
    screenSize: { width: number; height: number };
    capabilities: {
      hls: boolean;
      dash: boolean;
      hevc: boolean;
      av1: boolean;
    };
  };
  connectionInfo?: BandwidthInfo;
  preferences?: {
    maxQuality?: string;
    autoplay?: boolean;
    dataSaver?: boolean;
    preferredLanguage?: string;
  };
}

export class StreamingOptimizer {
  private geoLocationCache = new Map<string, string>();
  private bandwidthHistory = new Map<string, BandwidthInfo[]>();

  /**
   * Generate optimized streaming manifest for content
   */
  async generateStreamingManifest(
    outputs: ProcessingOutput[],
    metadata: StreamingMetadata,
    options: DeliveryOptions = {}
  ): Promise<StreamingManifest> {
    logger.info('Generating streaming manifest', {
      contentId: metadata.contentId,
      outputCount: outputs.length,
      deviceType: options.deviceInfo?.type,
    });

    // Determine optimal streaming format
    const streamingType = this.selectStreamingType(outputs, options);

    // Generate quality levels
    const qualities = this.generateQualityLevels(outputs, options);

    // Create thumbnail track
    const thumbnails = this.generateThumbnailTrack(outputs);

    // Generate master playlist
    const masterPlaylist = await this.generateMasterPlaylist(
      qualities,
      streamingType,
      metadata,
      options
    );

    return {
      type: streamingType,
      masterPlaylist,
      qualities,
      thumbnails,
      metadata,
    };
  }

  /**
   * Select optimal streaming type based on device and network
   */
  private selectStreamingType(
    outputs: ProcessingOutput[],
    options: DeliveryOptions
  ): 'hls' | 'dash' | 'progressive' {
    const hasHLS = outputs.some(o => o.format === 'hls');
    const hasDASH = outputs.some(o => o.format === 'dash');

    // Check device capabilities
    const deviceSupportsHLS = options.deviceInfo?.capabilities.hls !== false;
    const deviceSupportsDASH = options.deviceInfo?.capabilities.dash !== false;

    // iOS/Safari prefer HLS
    if (options.deviceInfo?.type === 'mobile' && deviceSupportsHLS && hasHLS) {
      return 'hls';
    }

    // Modern browsers with DASH support
    if (deviceSupportsDASH && hasDASH) {
      return 'dash';
    }

    // HLS fallback
    if (deviceSupportsHLS && hasHLS) {
      return 'hls';
    }

    // Progressive fallback for older devices
    return 'progressive';
  }

  /**
   * Generate quality levels with CDN optimization
   */
  private generateQualityLevels(
    outputs: ProcessingOutput[],
    options: DeliveryOptions
  ): QualityLevel[] {
    const videoOutputs = outputs.filter(
      o => o.format === 'mp4' || o.format === 'hls' || o.format === 'dash'
    );

    return videoOutputs
      .map(output => {
        const quality = this.extractQualityFromOutput(output);
        const optimizedUrl = this.optimizeUrl(output.url, options);

        return {
          quality: quality.name,
          bandwidth: quality.bandwidth,
          resolution: quality.resolution,
          url: optimizedUrl,
          codecs: this.getCodecs(output),
          frameRate: 30, // Default, could be extracted from metadata
        };
      })
      .sort((a, b) => b.bandwidth - a.bandwidth); // Sort by bandwidth descending
  }

  /**
   * Extract quality information from processing output
   */
  private extractQualityFromOutput(output: ProcessingOutput): {
    name: string;
    bandwidth: number;
    resolution: string;
  } {
    // Extract quality from filename or metadata
    const qualityMatch = output.quality?.match(/(1080p|720p|480p|360p|240p)/i);
    const qualityName = qualityMatch ? qualityMatch[1].toLowerCase() : '480p';

    const abrConfig =
      STREAMING_CONFIG.ABR.qualities.find(q => q.name === qualityName) ||
      STREAMING_CONFIG.ABR.qualities[2]; // Default to 480p

    return {
      name: abrConfig.name,
      bandwidth: abrConfig.bandwidth,
      resolution: abrConfig.resolution,
    };
  }

  /**
   * Get codec information for quality level
   */
  private getCodecs(output: ProcessingOutput): string {
    // Default H.264 + AAC codecs
    if (output.format === 'mp4') {
      return 'avc1.640028,mp4a.40.2';
    }

    // HLS codecs
    if (output.format === 'hls') {
      return 'avc1.640028,mp4a.40.2';
    }

    return 'avc1.640028,mp4a.40.2';
  }

  /**
   * Optimize URL based on user location and device
   */
  private optimizeUrl(baseUrl: string, options: DeliveryOptions): string {
    let optimizedUrl = baseUrl;

    // Use CDN domain if available
    if (STREAMING_CONFIG.CDN.primaryDomain) {
      optimizedUrl = baseUrl.replace(
        /https?:\/\/[^\/]+/,
        `https://${STREAMING_CONFIG.CDN.primaryDomain}`
      );
    }

    // Add geographic optimization
    if (options.userLocation?.region) {
      const regionalDomain =
        STREAMING_CONFIG.CDN.regionMapping[
          options.userLocation.region as keyof typeof STREAMING_CONFIG.CDN.regionMapping
        ];

      if (regionalDomain) {
        optimizedUrl = optimizedUrl.replace(STREAMING_CONFIG.CDN.primaryDomain, regionalDomain);
      }
    }

    // Add query parameters for optimization
    const params = new URLSearchParams();

    // Device-specific parameters
    if (options.deviceInfo?.type) {
      params.set('device', options.deviceInfo.type);
    }

    // Connection-aware parameters
    if (options.connectionInfo?.type) {
      params.set('connection', options.connectionInfo.type);
    }

    // Data saver mode
    if (options.preferences?.dataSaver) {
      params.set('datasaver', '1');
    }

    if (params.toString()) {
      optimizedUrl += `?${params.toString()}`;
    }

    return optimizedUrl;
  }

  /**
   * Generate thumbnail track for video scrubbing
   */
  private generateThumbnailTrack(outputs: ProcessingOutput[]): ThumbnailTrack | undefined {
    const spriteOutput = outputs.find(o => o.quality === 'sprite');

    if (!spriteOutput) return undefined;

    return {
      url: spriteOutput.url,
      interval: 10, // 10 seconds between thumbnails
      columns: 10,
      rows: 10,
      width: 160,
      height: 90,
    };
  }

  /**
   * Generate master playlist for HLS/DASH
   */
  private async generateMasterPlaylist(
    qualities: QualityLevel[],
    type: 'hls' | 'dash' | 'progressive',
    metadata: StreamingMetadata,
    options: DeliveryOptions
  ): Promise<string> {
    if (type === 'hls') {
      return this.generateHLSMasterPlaylist(qualities, metadata, options);
    } else if (type === 'dash') {
      return this.generateDASHManifest(qualities, metadata, options);
    } else {
      return this.generateProgressivePlaylist(qualities, metadata);
    }
  }

  /**
   * Generate HLS master playlist
   */
  private generateHLSMasterPlaylist(
    qualities: QualityLevel[],
    metadata: StreamingMetadata,
    options: DeliveryOptions
  ): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:6\n';

    // Add quality levels
    for (const quality of qualities) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth}`;
      playlist += `,RESOLUTION=${quality.resolution}`;
      playlist += `,CODECS="${quality.codecs}"`;

      if (quality.frameRate) {
        playlist += `,FRAME-RATE=${quality.frameRate}`;
      }

      playlist += `\n${quality.url}\n`;
    }

    // Add alternative audio (if available)
    // This would be implemented for multi-language support

    return playlist;
  }

  /**
   * Generate DASH manifest
   */
  private generateDASHManifest(
    qualities: QualityLevel[],
    metadata: StreamingMetadata,
    options: DeliveryOptions
  ): string {
    // DASH MPD XML generation
    const mpd = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     type="static"
     mediaPresentationDuration="PT${Math.floor(metadata.duration)}S"
     profiles="urn:mpeg:dash:profile:isoff-main:2011">
  <Period>
    <AdaptationSet mimeType="video/mp4" codecs="avc1.640028">
      ${qualities
        .map(
          quality => `
      <Representation id="${quality.quality}"
                     bandwidth="${quality.bandwidth}"
                     width="${quality.resolution.split('x')[0]}"
                     height="${quality.resolution.split('x')[1]}">
        <BaseURL>${quality.url}</BaseURL>
      </Representation>
      `
        )
        .join('')}
    </AdaptationSet>
  </Period>
</MPD>`;

    return mpd;
  }

  /**
   * Generate progressive playlist (JSON format)
   */
  private generateProgressivePlaylist(
    qualities: QualityLevel[],
    metadata: StreamingMetadata
  ): string {
    return JSON.stringify({
      type: 'progressive',
      duration: metadata.duration,
      sources: qualities.map(quality => ({
        src: quality.url,
        type: 'video/mp4',
        quality: quality.quality,
        bandwidth: quality.bandwidth,
        resolution: quality.resolution,
      })),
    });
  }

  /**
   * Recommend optimal quality based on network conditions
   */
  async recommendQuality(
    qualities: QualityLevel[],
    networkInfo: BandwidthInfo,
    deviceInfo?: DeliveryOptions['deviceInfo']
  ): Promise<QualityLevel> {
    // Apply data saver logic
    if (deviceInfo && this.isDataSaverMode(deviceInfo, networkInfo)) {
      return qualities.find(q => q.quality === '360p') || qualities[qualities.length - 1];
    }

    // Find optimal quality based on bandwidth
    const availableBandwidth =
      networkInfo.downlink * 1000000 * STREAMING_CONFIG.ABR.switchThreshold;

    for (const quality of qualities) {
      if (quality.bandwidth <= availableBandwidth) {
        return quality;
      }
    }

    // Return lowest quality if bandwidth is too low
    return qualities[qualities.length - 1];
  }

  /**
   * Check if data saver mode should be enabled
   */
  private isDataSaverMode(
    deviceInfo: NonNullable<DeliveryOptions['deviceInfo']>,
    networkInfo: BandwidthInfo
  ): boolean {
    // Enable data saver on mobile with slow connections
    if (
      deviceInfo.type === 'mobile' &&
      (networkInfo.type === '2g' || networkInfo.type === 'slow-2g')
    ) {
      return true;
    }

    // Enable data saver if connection is very slow
    if (networkInfo.downlink < 1) {
      // Less than 1 Mbps
      return true;
    }

    return false;
  }

  /**
   * Generate preloading strategy
   */
  generatePreloadingStrategy(
    manifest: StreamingManifest,
    options: DeliveryOptions
  ): {
    preloadAmount: number;
    chunkSize: number;
    maxConcurrent: number;
    priorities: string[];
  } {
    const connectionType = options.connectionInfo?.type || '4g';
    const deviceType = options.deviceInfo?.type || 'desktop';

    // Adjust preloading based on connection and device
    let preloadAmount = STREAMING_CONFIG.PROGRESSIVE.preloadSize;
    let chunkSize = STREAMING_CONFIG.PROGRESSIVE.chunkSize;
    let maxConcurrent = STREAMING_CONFIG.PROGRESSIVE.maxConcurrentChunks;

    // Reduce preloading on slow connections
    if (connectionType === '2g' || connectionType === 'slow-2g') {
      preloadAmount = Math.floor(preloadAmount / 4);
      chunkSize = Math.floor(chunkSize / 2);
      maxConcurrent = 1;
    }

    // Increase preloading on fast connections
    if (connectionType === '5g' || connectionType === 'wifi') {
      preloadAmount = preloadAmount * 2;
      maxConcurrent = Math.min(maxConcurrent * 2, 6);
    }

    // Mobile-specific adjustments
    if (deviceType === 'mobile') {
      preloadAmount = Math.floor(preloadAmount * 0.7); // Reduce by 30%
    }

    // Priority order for loading
    const priorities = [
      'audio', // Audio first for faster perceived loading
      'video-360p', // Lowest video quality
      'video-480p',
      'thumbnails',
      'video-720p',
      'video-1080p',
    ];

    return {
      preloadAmount,
      chunkSize,
      maxConcurrent,
      priorities,
    };
  }

  /**
   * Generate CDN cache headers
   */
  generateCacheHeaders(
    contentType: 'video' | 'audio' | 'thumbnail' | 'hls'
  ): Record<string, string> {
    const ttl = STREAMING_CONFIG.CACHE[`${contentType}TTL` as keyof typeof STREAMING_CONFIG.CACHE];

    return {
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      'CDN-Cache-Control': `public, max-age=${STREAMING_CONFIG.CACHE.edgeTTL}`,
      Expires: new Date(Date.now() + ttl * 1000).toUTCString(),
      ETag: `"${contentType}-${Date.now()}"`,
      Vary: 'Accept-Encoding, User-Agent',
    };
  }

  /**
   * Optimize delivery for geographic regions
   */
  async optimizeForRegion(
    baseUrl: string,
    userRegion: string,
    contentType: 'video' | 'audio'
  ): Promise<string> {
    // Use cached geo-location mapping
    const cachedRegion = this.geoLocationCache.get(userRegion);
    if (cachedRegion) {
      return baseUrl.replace(STREAMING_CONFIG.CDN.primaryDomain, cachedRegion);
    }

    // Determine optimal CDN endpoint
    const regionalDomain =
      STREAMING_CONFIG.CDN.regionMapping[
        userRegion as keyof typeof STREAMING_CONFIG.CDN.regionMapping
      ] || STREAMING_CONFIG.CDN.primaryDomain;

    // Cache the result
    this.geoLocationCache.set(userRegion, regionalDomain);

    return baseUrl.replace(STREAMING_CONFIG.CDN.primaryDomain, regionalDomain);
  }

  /**
   * Track bandwidth history for adaptive improvements
   */
  trackBandwidth(sessionId: string, bandwidthInfo: BandwidthInfo): void {
    const history = this.bandwidthHistory.get(sessionId) || [];
    history.push(bandwidthInfo);

    // Keep only last 10 measurements
    if (history.length > 10) {
      history.shift();
    }

    this.bandwidthHistory.set(sessionId, history);
  }

  /**
   * Get bandwidth predictions based on history
   */
  predictBandwidth(sessionId: string): BandwidthInfo | null {
    const history = this.bandwidthHistory.get(sessionId);
    if (!history || history.length === 0) {
      return null;
    }

    // Calculate weighted average (more recent measurements weighted higher)
    const weights = history.map((_, i) => Math.pow(1.2, i));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const avgDownlink =
      history.reduce((sum, info, i) => sum + info.downlink * weights[i], 0) / totalWeight;

    const avgRtt = history.reduce((sum, info, i) => sum + info.rtt * weights[i], 0) / totalWeight;

    return {
      estimated: avgDownlink * 1000000, // Convert to bps
      effective: this.classifyConnection(avgDownlink),
      rtt: avgRtt,
      downlink: avgDownlink,
      type: history[history.length - 1].type, // Use latest type
    };
  }

  /**
   * Classify connection type based on bandwidth
   */
  private classifyConnection(downlinkMbps: number): string {
    if (downlinkMbps >= 20) return '5g';
    if (downlinkMbps >= 4) return '4g';
    if (downlinkMbps >= 0.75) return '3g';
    if (downlinkMbps >= 0.25) return '2g';
    return 'slow-2g';
  }

  /**
   * Generate fallback URLs for reliability
   */
  generateFallbackUrls(primaryUrl: string): string[] {
    const fallbacks = [primaryUrl];

    // Add fallback CDN domains
    for (const fallbackDomain of STREAMING_CONFIG.CDN.fallbackDomains) {
      const fallbackUrl = primaryUrl.replace(STREAMING_CONFIG.CDN.primaryDomain, fallbackDomain);
      fallbacks.push(fallbackUrl);
    }

    return fallbacks;
  }

  /**
   * Clear caches (for testing or maintenance)
   */
  clearCaches(): void {
    this.geoLocationCache.clear();
    this.bandwidthHistory.clear();
    logger.info('Streaming optimizer caches cleared');
  }
}

// Export singleton instance
export const streamingOptimizer = new StreamingOptimizer();

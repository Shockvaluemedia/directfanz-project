/**
 * Player Utility Functions
 *
 * Collection of utility functions for the mobile audio player including:
 * - Duration formatting for playback time display
 * - Color extraction from album artwork
 * - Audio format detection and validation
 * - Player state management helpers
 * - Gesture handling utilities
 */

import { ImageColorsResult, getColors as extractColors } from 'react-native-image-colors';
import { Platform } from 'react-native';

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Extract dominant colors from album artwork for gradient backgrounds
 */
export async function getColors(imageUrl: string): Promise<string[]> {
  try {
    const result = await extractColors(imageUrl, {
      fallback: '#1a1a1a',
      cache: true,
      key: imageUrl,
    });

    if (Platform.OS === 'android') {
      const androidResult = result as ImageColorsResult & {
        dominant: string;
        average: string;
        vibrant: string;
        darkVibrant: string;
        lightVibrant: string;
        darkMuted: string;
        lightMuted: string;
        muted: string;
      };

      return [
        androidResult.dominant || '#1a1a1a',
        androidResult.vibrant || '#2a2a2a',
        androidResult.darkVibrant || '#3a3a3a',
      ];
    } else {
      const iosResult = result as ImageColorsResult & {
        background: string;
        primary: string;
        secondary: string;
        detail: string;
      };

      return [
        iosResult.background || '#1a1a1a',
        iosResult.primary || '#2a2a2a',
        iosResult.secondary || '#3a3a3a',
      ];
    }
  } catch (error) {
    console.error('Error extracting colors:', error);
    return ['#1a1a1a', '#2a2a2a', '#3a3a3a'];
  }
}

/**
 * Calculate progress percentage from current position and duration
 */
export function calculateProgress(position: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(Math.max(position / duration, 0), 1);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get audio quality label based on bitrate
 */
export function getQualityLabel(bitrate: number): string {
  if (bitrate >= 320) return 'Lossless';
  if (bitrate >= 256) return 'High';
  if (bitrate >= 192) return 'Good';
  if (bitrate >= 128) return 'Normal';
  return 'Low';
}

/**
 * Validate if file is a supported audio format
 */
export function isAudioFile(filename: string): boolean {
  const audioExtensions = [
    '.mp3',
    '.m4a',
    '.aac',
    '.wav',
    '.flac',
    '.ogg',
    '.wma',
    '.opus',
    '.webm',
  ];

  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return audioExtensions.includes(extension);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.substring(filename.lastIndexOf('.') + 1).toUpperCase();
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Convert seconds to human-readable time remaining
 */
export function getTimeRemaining(currentPosition: number, duration: number): string {
  const remaining = duration - currentPosition;
  if (remaining <= 0) return 'Finished';

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m left`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s left`;
  } else {
    return `${seconds}s left`;
  }
}

/**
 * Generate shuffle indices for queue
 */
export function generateShuffleIndices(length: number, currentIndex: number = 0): number[] {
  const indices = Array.from({ length }, (_, i) => i);

  // Remove current index to avoid immediate repeat
  indices.splice(currentIndex, 1);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Add current index at the beginning
  indices.unshift(currentIndex);

  return indices;
}

/**
 * Check if gesture should trigger action based on velocity and distance
 */
export function shouldTriggerGesture(
  velocity: number,
  distance: number,
  minVelocity: number = 500,
  minDistance: number = 50
): boolean {
  return Math.abs(velocity) > minVelocity || Math.abs(distance) > minDistance;
}

/**
 * Calculate gesture direction from delta values
 */
export function getGestureDirection(
  dx: number,
  dy: number
): 'up' | 'down' | 'left' | 'right' | 'none' {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < 20 && absDy < 20) return 'none';

  if (absDy > absDx) {
    return dy > 0 ? 'down' : 'up';
  } else {
    return dx > 0 ? 'right' : 'left';
  }
}

/**
 * Generate vibration pattern for haptic feedback
 */
export function getHapticPattern(
  type: 'light' | 'medium' | 'heavy' | 'error' | 'success'
): number[] {
  const patterns = {
    light: [10],
    medium: [50],
    heavy: [100],
    error: [50, 50, 50],
    success: [25, 25, 50],
  };

  return patterns[type] || patterns.light;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastExecution = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastExecution >= delay) {
      func.apply(null, args);
      lastExecution = now;
    }
  };
}

/**
 * Parse track metadata from filename
 */
export function parseTrackMetadata(filename: string): {
  title: string;
  artist?: string;
  album?: string;
  track?: number;
} {
  // Remove extension
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));

  // Try to parse common patterns like "Artist - Title" or "Track. Title"
  const patterns = [
    /^(\d+)\.\s*(.+)$/, // "01. Song Title"
    /^(.+?)\s*-\s*(.+)$/, // "Artist - Song Title"
    /^(\d+)\s*-\s*(.+?)\s*-\s*(.+)$/, // "01 - Artist - Song Title"
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        return {
          title: match[2].trim(),
          track: parseInt(match[1], 10),
        };
      } else if (pattern === patterns[1]) {
        return {
          title: match[2].trim(),
          artist: match[1].trim(),
        };
      } else if (pattern === patterns[2]) {
        return {
          title: match[3].trim(),
          artist: match[2].trim(),
          track: parseInt(match[1], 10),
        };
      }
    }
  }

  // Fallback to filename as title
  return {
    title: nameWithoutExt,
  };
}

/**
 * Generate placeholder gradient colors
 */
export function getPlaceholderColors(): string[] {
  const colorSets = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
  ];

  const randomSet = colorSets[Math.floor(Math.random() * colorSets.length)];
  return [...randomSet, '#1a1a1a']; // Add dark fallback
}

/**
 * Check if device supports haptic feedback
 */
export function supportsHaptics(): boolean {
  return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 21);
}

/**
 * Format speed for playback rate display
 */
export function formatPlaybackSpeed(speed: number): string {
  if (speed === 1) return 'Normal';
  return `${speed}x`;
}

/**
 * Get recommended buffer size based on network conditions
 */
export function getRecommendedBufferSize(networkType: string): number {
  const bufferSizes = {
    wifi: 30000, // 30 seconds
    cellular: 15000, // 15 seconds
    '2g': 5000, // 5 seconds
    '3g': 10000, // 10 seconds
    '4g': 20000, // 20 seconds
    '5g': 30000, // 30 seconds
    unknown: 15000, // 15 seconds default
  };

  return bufferSizes[networkType as keyof typeof bufferSizes] || bufferSizes.unknown;
}

/**
 * Format file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${Math.round(size * 10) / 10} ${sizes[i]}`;
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss format
 */
export function formatDuration(seconds: number): string {
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
 * Format milliseconds to duration string
 */
export function formatMillisecondsToDuration(milliseconds: number): string {
  return formatDuration(Math.floor(milliseconds / 1000));
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if a URL is a valid image URL
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = getFileExtension(url);
  return imageExtensions.includes(extension);
}

/**
 * Check if a URL is a valid video URL
 */
export function isVideoUrl(url: string): boolean {
  const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
  const extension = getFileExtension(url);
  return videoExtensions.includes(extension);
}

/**
 * Check if a URL is a valid audio URL
 */
export function isAudioUrl(url: string): boolean {
  const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];
  const extension = getFileExtension(url);
  return audioExtensions.includes(extension);
}

/**
 * Format bytes per second to human readable speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  const speeds = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  let speed = bytesPerSecond;
  
  while (speed >= 1024 && i < speeds.length - 1) {
    speed /= 1024;
    i++;
  }
  
  return `${Math.round(speed * 10) / 10} ${speeds[i]}`;
}

/**
 * Parse hashtags from text
 */
export function parseHashtags(text: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  return text.match(hashtagRegex) || [];
}

/**
 * Parse mentions from text
 */
export function parseMentions(text: string): string[] {
  const mentionRegex = /@[a-zA-Z0-9_]+/g;
  return text.match(mentionRegex) || [];
}

/**
 * Remove HTML tags from text
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}
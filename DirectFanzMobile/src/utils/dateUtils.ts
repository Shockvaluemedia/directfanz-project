/**
 * Format timestamp for message display
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Check if it's today
  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Check if it's yesterday
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  
  // Check if it's this week
  const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  // Check if it's this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  // Different year
  return date.toLocaleDateString([], { year: '2-digit', month: 'short', day: 'numeric' });
}

/**
 * Format last seen timestamp
 */
export function formatLastSeen(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  }
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
  
  if (diffInDays < 30) {
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

/**
 * Format date for conversation list
 */
export function formatConversationDate(timestamp: string): string {
  return formatMessageTime(timestamp);
}

/**
 * Format full date and time
 */
export function formatFullDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(timestamp: string): string {
  return formatLastSeen(timestamp);
}

/**
 * Format time for message input (e.g., typing indicator)
 */
export function formatTypingTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'typing...';
  }
  
  return 'was typing';
}

/**
 * Check if timestamp is today
 */
export function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Check if timestamp is yesterday
 */
export function isYesterday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear();
}

/**
 * Format date for message grouping
 */
export function formatDateSeparator(timestamp: string): string {
  const date = new Date(timestamp);
  
  if (isToday(timestamp)) {
    return 'Today';
  }
  
  if (isYesterday(timestamp)) {
    return 'Yesterday';
  }
  
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  return date.toLocaleDateString([], { 
    weekday: 'long', 
    year: 'numeric',
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Create ISO timestamp string
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Parse timestamp to Date object
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Check if timestamp is within last N minutes
 */
export function isWithinLastMinutes(timestamp: string, minutes: number): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
  
  return diffInMinutes <= minutes;
}
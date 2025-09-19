export interface User {
  id: string;
  displayName: string;
  avatar?: string | null;
  role: 'FAN' | 'ARTIST' | 'ADMIN';
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO';
  attachmentUrl?: string | null;
  createdAt: Date | string;
  readAt?: Date | string | null;
  sender: User;
}

export interface TypingUser {
  userId: string;
  displayName: string;
  timestamp: number;
}

// WebSocket Event Types
export interface ServerToClientEvents {
  // Message events
  'message:new': (message: Message) => void;
  'message:read': (data: { messageId: string; readAt: string; readBy: string }) => void;
  'message:delivered': (data: { messageId: string; deliveredAt: string }) => void;

  // Typing events
  'typing:start': (data: { userId: string; displayName: string; conversationId: string }) => void;
  'typing:stop': (data: { userId: string; conversationId: string }) => void;

  // Presence events
  'user:online': (data: { userId: string; lastSeen: string }) => void;
  'user:offline': (data: { userId: string; lastSeen: string }) => void;

  // Connection events
  connect: () => void;
  disconnect: () => void;
  'auth:success': (data: { userId: string }) => void;
  'auth:error': (error: string) => void;

  // WebRTC Signaling Events
  offer: (data: { offer: RTCSessionDescriptionInit; senderId: string }) => void;
  answer: (data: { answer: RTCSessionDescriptionInit; senderId: string }) => void;
  'ice-candidate': (data: { candidate: RTCIceCandidateInit; senderId: string }) => void;
  'broadcaster-joined': () => void;
  'broadcaster-left': () => void;
  'broadcaster-ready': () => void;
  'broadcaster-available': () => void;
  'viewer-joined': (data: { viewerId: string; totalViewers: number }) => void;
  'viewer-count-update': (data: { count: number }) => void;
  'stream-started': () => void;
  'stream-ended': () => void;
  'stream-request': (data: { viewerId: string }) => void;
  'quality-changed': (data: { quality: string; bitrate?: number }) => void;

  // Error events
  error: (error: string) => void;
}

export interface ClientToServerEvents {
  // Authentication
  auth: (token: string) => void;

  // Message events
  'message:send': (data: {
    recipientId: string;
    content: string;
    type?: 'TEXT' | 'IMAGE' | 'AUDIO';
    attachmentUrl?: string;
  }) => void;
  'message:mark_read': (data: { messageId: string }) => void;

  // Typing events
  'typing:start': (data: { conversationWith: string }) => void;
  'typing:stop': (data: { conversationWith: string }) => void;

  // Conversation events
  'conversation:join': (data: { conversationWith: string }) => void;
  'conversation:leave': (data: { conversationWith: string }) => void;

  // WebRTC Signaling Events
  'stream:join': (data: { streamId: string; isOwner: boolean }) => void;
  'stream:leave': (data: { streamId: string }) => void;
  offer: (data: { offer: RTCSessionDescriptionInit; targetId: string }) => void;
  answer: (data: { answer: RTCSessionDescriptionInit; targetId: string }) => void;
  'ice-candidate': (data: { candidate: RTCIceCandidateInit; targetId: string }) => void;
  'broadcaster-ready': () => void;
  'request-stream': () => void;
  'start-stream': () => void;
  'stop-stream': () => void;
  'stream-quality-change': (data: { quality: string; bitrate?: number }) => void;

  // Presence events
  'presence:update': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  user: User;
  activeConversations: Set<string>;
  lastSeen: Date;

  // WebRTC specific data
  streamId?: string;
  isStreamOwner?: boolean;
  streamData?: any;
}

// Utility types
export interface ConversationRoom {
  participants: [string, string]; // Always exactly 2 participants for direct messaging
  roomId: string;
}

export interface OnlineUser {
  userId: string;
  displayName: string;
  lastSeen: Date;
  socketId: string;
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: Date;
}

// WebSocket connection states
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// Helper functions
export const createConversationId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

export const parseConversationId = (conversationId: string): [string, string] => {
  const parts = conversationId.split('_');
  if (parts.length !== 2) {
    throw new Error('Invalid conversation ID format');
  }
  return [parts[0], parts[1]];
};

export const getOtherUserId = (conversationId: string, currentUserId: string): string => {
  const [user1, user2] = parseConversationId(conversationId);
  return user1 === currentUserId ? user2 : user1;
};

// Message Types
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'SYSTEM';
export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type ConversationType = 'DIRECT' | 'GROUP' | 'BROADCAST';

// Core Message Interface
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderInfo: MessageSender;
  
  // Message content
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaMetadata?: MediaMetadata;
  
  // Message status
  status: MessageStatus;
  timestamp: string;
  editedAt?: string;
  
  // Special message properties
  isEdited: boolean;
  isDeleted: boolean;
  replyToMessageId?: string;
  replyToMessage?: Message;
  
  // System message data
  systemData?: SystemMessageData;
}

export interface MessageSender {
  id: string;
  name: string;
  avatar?: string;
  role?: 'ARTIST' | 'FAN' | 'ADMIN';
  verified?: boolean;
}

export interface MediaMetadata {
  fileName?: string;
  fileSize?: number;
  duration?: number; // for audio/video
  width?: number;    // for images/videos
  height?: number;   // for images/videos
  mimeType?: string;
}

export interface SystemMessageData {
  type: 'USER_JOINED' | 'USER_LEFT' | 'SUBSCRIPTION_STARTED' | 'SUBSCRIPTION_ENDED' | 'TIER_CHANGED';
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

// Conversation Interface
export interface Conversation {
  id: string;
  type: ConversationType;
  
  // Participants
  participants: ConversationParticipant[];
  creatorId?: string; // For creator-fan conversations
  
  // Conversation metadata
  title?: string;
  avatar?: string;
  description?: string;
  
  // Last message info
  lastMessage?: Message;
  lastMessageAt: string;
  lastReadAt?: Record<string, string>; // userId -> timestamp
  
  // Settings
  isArchived: boolean;
  isMuted: boolean;
  isPinned: boolean;
  
  // Subscription-related
  isSubscriptionRequired: boolean;
  subscriptionTier?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Computed properties
  unreadCount?: number;
  isOnline?: boolean;
  typingUsers?: string[];
}

export interface ConversationParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  role: 'CREATOR' | 'SUBSCRIBER' | 'FAN' | 'ADMIN';
  joinedAt: string;
  lastSeenAt?: string;
  permissions: ParticipantPermissions;
}

export interface ParticipantPermissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canDeleteMessages: boolean;
  canInviteUsers: boolean;
  isAdmin: boolean;
}

// Message Composition
export interface MessageDraft {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  replyToMessageId?: string;
  tempId?: string; // For optimistic updates
}

export interface MediaAttachment {
  id: string;
  type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE';
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  duration?: number;
  thumbnail?: string;
  uploadProgress?: number;
  isUploading?: boolean;
}

// Real-time Events
export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface MessageEvent {
  type: 'MESSAGE_SENT' | 'MESSAGE_RECEIVED' | 'MESSAGE_UPDATED' | 'MESSAGE_DELETED';
  message: Message;
  conversationId: string;
}

export interface ConversationEvent {
  type: 'CONVERSATION_UPDATED' | 'PARTICIPANT_JOINED' | 'PARTICIPANT_LEFT' | 'TYPING_START' | 'TYPING_STOP';
  conversationId: string;
  data: any;
}

// State Management
export interface MessagingState {
  // Conversations
  conversations: Record<string, Conversation>;
  conversationsList: string[]; // Sorted by lastMessageAt
  
  // Messages
  messages: Record<string, Message[]>; // conversationId -> messages
  messageDrafts: Record<string, string>; // conversationId -> draft content
  
  // Current state
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  
  // Real-time indicators
  typingIndicators: Record<string, TypingIndicator[]>; // conversationId -> typing users
  onlineUsers: Set<string>;
  
  // UI state
  searchQuery: string;
  selectedMessages: string[];
  isSelectionMode: boolean;
  
  // Media uploads
  uploadingMedia: Record<string, MediaAttachment>; // tempId -> attachment
  
  // Error handling
  error: string | null;
  connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
}

export type MessagingAction =
  // Conversations
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'REMOVE_CONVERSATION'; payload: string }
  
  // Messages
  | { type: 'SET_MESSAGES'; payload: { conversationId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: string; updates: Partial<Message> } }
  | { type: 'DELETE_MESSAGE'; payload: { conversationId: string; messageId: string } }
  
  // Drafts
  | { type: 'SET_DRAFT'; payload: { conversationId: string; draft: string } }
  | { type: 'CLEAR_DRAFT'; payload: string }
  
  // Active conversation
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | null }
  
  // Loading states
  | { type: 'SET_LOADING_CONVERSATIONS'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  
  // Real-time updates
  | { type: 'SET_TYPING_INDICATOR'; payload: TypingIndicator }
  | { type: 'REMOVE_TYPING_INDICATOR'; payload: { conversationId: string; userId: string } }
  | { type: 'SET_USER_ONLINE'; payload: string }
  | { type: 'SET_USER_OFFLINE'; payload: string }
  
  // Search
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  
  // Selection mode
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'SELECT_MESSAGE'; payload: string }
  | { type: 'DESELECT_MESSAGE'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  
  // Media uploads
  | { type: 'START_MEDIA_UPLOAD'; payload: MediaAttachment }
  | { type: 'UPDATE_MEDIA_UPLOAD'; payload: { tempId: string; progress: number } }
  | { type: 'COMPLETE_MEDIA_UPLOAD'; payload: { tempId: string; mediaUrl: string } }
  | { type: 'FAIL_MEDIA_UPLOAD'; payload: string }
  
  // Connection
  | { type: 'SET_CONNECTION_STATUS'; payload: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' }
  
  // Error handling
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

// API Interfaces
export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  replyToMessageId?: string;
}

export interface CreateConversationRequest {
  participantIds: string[];
  type?: ConversationType;
  title?: string;
  isSubscriptionRequired?: boolean;
  subscriptionTier?: string;
}

export interface ConversationListResponse {
  success: boolean;
  data: {
    conversations: Conversation[];
    hasMore: boolean;
    total: number;
  };
  message?: string;
}

export interface MessageHistoryResponse {
  success: boolean;
  data: {
    messages: Message[];
    hasMore: boolean;
    total: number;
  };
  message?: string;
}

export interface SendMessageResponse {
  success: boolean;
  data: Message;
  message?: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'MESSAGE' | 'TYPING' | 'CONVERSATION_UPDATE' | 'USER_STATUS' | 'CONNECTION';
  payload: any;
  timestamp: string;
  conversationId?: string;
}

// Search and Filtering
export interface MessageSearchQuery {
  query?: string;
  conversationId?: string;
  senderId?: string;
  messageType?: MessageType;
  dateRange?: {
    start: string;
    end: string;
  };
  hasMedia?: boolean;
}

export interface ConversationFilter {
  type?: ConversationType;
  hasUnread?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  participantId?: string;
}

// Permissions and Restrictions
export interface MessagingPermissions {
  canStartConversations: boolean;
  canSendMessages: boolean;
  canSendMedia: boolean;
  canDeleteOwnMessages: boolean;
  canDeleteAnyMessages: boolean;
  maxMediaFileSize: number;
  allowedMediaTypes: string[];
  dailyMessageLimit?: number;
  requiresSubscription: boolean;
}

// Push Notifications
export interface MessageNotification {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: MessageType;
}

// Analytics and Insights
export interface MessagingAnalytics {
  totalConversations: number;
  totalMessages: number;
  messagesThisMonth: number;
  averageResponseTime: number;
  mostActiveConversations: {
    conversationId: string;
    messageCount: number;
    participantNames: string[];
  }[];
  popularMessageTimes: {
    hour: number;
    messageCount: number;
  }[];
}

// Constants
export const MESSAGE_LIMITS = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_MEDIA_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CONVERSATIONS_PER_PAGE: 50,
  MAX_MESSAGES_PER_PAGE: 50,
  TYPING_TIMEOUT: 3000,
} as const;

export const SUPPORTED_MEDIA_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  AUDIO: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac'],
  VIDEO: ['video/mp4', 'video/mov', 'video/avi'],
  FILE: ['application/pdf', 'text/plain', 'application/msword'],
} as const;
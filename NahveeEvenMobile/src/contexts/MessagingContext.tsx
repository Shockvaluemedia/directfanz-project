import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  MessagingState, 
  MessagingAction, 
  Conversation, 
  Message, 
  MessageDraft,
  TypingIndicator,
  MediaAttachment,
  SendMessageRequest,
  CreateConversationRequest,
  ConversationFilter,
  MessageSearchQuery,
  MESSAGE_LIMITS,
} from '../types/messaging';
import WebSocketService, { WebSocketServiceConfig } from '../services/WebSocketService';
import NotificationService from '../services/NotificationService';

// Initial state
const initialState: MessagingState = {
  conversations: {},
  conversationsList: [],
  messages: {},
  messageDrafts: {},
  activeConversationId: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  typingIndicators: {},
  onlineUsers: new Set(),
  searchQuery: '',
  selectedMessages: [],
  isSelectionMode: false,
  uploadingMedia: {},
  error: null,
  connectionStatus: 'DISCONNECTED',
};

// Reducer function
function messagingReducer(state: MessagingState, action: MessagingAction): MessagingState {
  switch (action.type) {
    // Conversations
    case 'SET_CONVERSATIONS': {
      const conversations: Record<string, Conversation> = {};
      const conversationsList: string[] = [];
      
      action.payload
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        .forEach(conv => {
          conversations[conv.id] = conv;
          conversationsList.push(conv.id);
        });
      
      return {
        ...state,
        conversations,
        conversationsList,
        isLoadingConversations: false,
      };
    }
    
    case 'ADD_CONVERSATION': {
      const newConversation = action.payload;
      const updatedConversations = { ...state.conversations };
      updatedConversations[newConversation.id] = newConversation;
      
      const updatedList = [newConversation.id, ...state.conversationsList.filter(id => id !== newConversation.id)];
      
      return {
        ...state,
        conversations: updatedConversations,
        conversationsList: updatedList,
      };
    }
    
    case 'UPDATE_CONVERSATION': {
      const { id, updates } = action.payload;
      if (!state.conversations[id]) return state;
      
      const updatedConversation = { ...state.conversations[id], ...updates };
      const updatedConversations = { ...state.conversations };
      updatedConversations[id] = updatedConversation;
      
      // Resort conversations if lastMessageAt changed
      let updatedList = state.conversationsList;
      if (updates.lastMessageAt) {
        updatedList = [...state.conversationsList].sort((a, b) => {
          const aTime = new Date(updatedConversations[a].lastMessageAt).getTime();
          const bTime = new Date(updatedConversations[b].lastMessageAt).getTime();
          return bTime - aTime;
        });
      }
      
      return {
        ...state,
        conversations: updatedConversations,
        conversationsList: updatedList,
      };
    }
    
    case 'REMOVE_CONVERSATION': {
      const conversationId = action.payload;
      const updatedConversations = { ...state.conversations };
      delete updatedConversations[conversationId];
      
      const updatedList = state.conversationsList.filter(id => id !== conversationId);
      const updatedMessages = { ...state.messages };
      delete updatedMessages[conversationId];
      
      return {
        ...state,
        conversations: updatedConversations,
        conversationsList: updatedList,
        messages: updatedMessages,
        activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
      };
    }
    
    // Messages
    case 'SET_MESSAGES': {
      const { conversationId, messages } = action.payload;
      const sortedMessages = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: sortedMessages,
        },
        isLoadingMessages: false,
      };
    }
    
    case 'ADD_MESSAGE': {
      const message = action.payload;
      const existingMessages = state.messages[message.conversationId] || [];
      const updatedMessages = [...existingMessages, message].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [message.conversationId]: updatedMessages,
        },
      };
    }
    
    case 'UPDATE_MESSAGE': {
      const { messageId, updates } = action.payload;
      const updatedMessages = { ...state.messages };
      
      Object.keys(updatedMessages).forEach(conversationId => {
        const messages = updatedMessages[conversationId];
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          updatedMessages[conversationId] = [
            ...messages.slice(0, messageIndex),
            { ...messages[messageIndex], ...updates },
            ...messages.slice(messageIndex + 1),
          ];
        }
      });
      
      return {
        ...state,
        messages: updatedMessages,
      };
    }
    
    case 'DELETE_MESSAGE': {
      const { conversationId, messageId } = action.payload;
      const messages = state.messages[conversationId] || [];
      const updatedMessages = messages.filter(m => m.id !== messageId);
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    }
    
    // Drafts
    case 'SET_DRAFT': {
      const { conversationId, draft } = action.payload;
      return {
        ...state,
        messageDrafts: {
          ...state.messageDrafts,
          [conversationId]: draft,
        },
      };
    }
    
    case 'CLEAR_DRAFT': {
      const conversationId = action.payload;
      const updatedDrafts = { ...state.messageDrafts };
      delete updatedDrafts[conversationId];
      
      return {
        ...state,
        messageDrafts: updatedDrafts,
      };
    }
    
    // Active conversation
    case 'SET_ACTIVE_CONVERSATION': {
      return {
        ...state,
        activeConversationId: action.payload,
        selectedMessages: [],
        isSelectionMode: false,
      };
    }
    
    // Loading states
    case 'SET_LOADING_CONVERSATIONS': {
      return {
        ...state,
        isLoadingConversations: action.payload,
      };
    }
    
    case 'SET_LOADING_MESSAGES': {
      return {
        ...state,
        isLoadingMessages: action.payload,
      };
    }
    
    // Real-time updates
    case 'SET_TYPING_INDICATOR': {
      const indicator = action.payload;
      const currentIndicators = state.typingIndicators[indicator.conversationId] || [];
      const updatedIndicators = [
        ...currentIndicators.filter(i => i.userId !== indicator.userId),
        indicator,
      ];
      
      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [indicator.conversationId]: updatedIndicators,
        },
      };
    }
    
    case 'REMOVE_TYPING_INDICATOR': {
      const { conversationId, userId } = action.payload;
      const currentIndicators = state.typingIndicators[conversationId] || [];
      const updatedIndicators = currentIndicators.filter(i => i.userId !== userId);
      
      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [conversationId]: updatedIndicators,
        },
      };
    }
    
    case 'SET_USER_ONLINE': {
      const userId = action.payload;
      const updatedOnlineUsers = new Set(state.onlineUsers);
      updatedOnlineUsers.add(userId);
      
      return {
        ...state,
        onlineUsers: updatedOnlineUsers,
      };
    }
    
    case 'SET_USER_OFFLINE': {
      const userId = action.payload;
      const updatedOnlineUsers = new Set(state.onlineUsers);
      updatedOnlineUsers.delete(userId);
      
      return {
        ...state,
        onlineUsers: updatedOnlineUsers,
      };
    }
    
    // Search
    case 'SET_SEARCH_QUERY': {
      return {
        ...state,
        searchQuery: action.payload,
      };
    }
    
    // Selection mode
    case 'TOGGLE_SELECTION_MODE': {
      return {
        ...state,
        isSelectionMode: !state.isSelectionMode,
        selectedMessages: [],
      };
    }
    
    case 'SELECT_MESSAGE': {
      const messageId = action.payload;
      const updatedSelection = state.selectedMessages.includes(messageId)
        ? state.selectedMessages.filter(id => id !== messageId)
        : [...state.selectedMessages, messageId];
      
      return {
        ...state,
        selectedMessages: updatedSelection,
      };
    }
    
    case 'DESELECT_MESSAGE': {
      const messageId = action.payload;
      return {
        ...state,
        selectedMessages: state.selectedMessages.filter(id => id !== messageId),
      };
    }
    
    case 'CLEAR_SELECTION': {
      return {
        ...state,
        selectedMessages: [],
        isSelectionMode: false,
      };
    }
    
    // Media uploads
    case 'START_MEDIA_UPLOAD': {
      const attachment = action.payload;
      return {
        ...state,
        uploadingMedia: {
          ...state.uploadingMedia,
          [attachment.id]: attachment,
        },
      };
    }
    
    case 'UPDATE_MEDIA_UPLOAD': {
      const { tempId, progress } = action.payload;
      const attachment = state.uploadingMedia[tempId];
      if (!attachment) return state;
      
      return {
        ...state,
        uploadingMedia: {
          ...state.uploadingMedia,
          [tempId]: {
            ...attachment,
            uploadProgress: progress,
          },
        },
      };
    }
    
    case 'COMPLETE_MEDIA_UPLOAD': {
      const { tempId, mediaUrl } = action.payload;
      const updatedMedia = { ...state.uploadingMedia };
      delete updatedMedia[tempId];
      
      return {
        ...state,
        uploadingMedia: updatedMedia,
      };
    }
    
    case 'FAIL_MEDIA_UPLOAD': {
      const tempId = action.payload;
      const updatedMedia = { ...state.uploadingMedia };
      delete updatedMedia[tempId];
      
      return {
        ...state,
        uploadingMedia: updatedMedia,
      };
    }
    
    // Connection
    case 'SET_CONNECTION_STATUS': {
      return {
        ...state,
        connectionStatus: action.payload,
      };
    }
    
    // Error handling
    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
      };
    }
    
    case 'CLEAR_ERROR': {
      return {
        ...state,
        error: null,
      };
    }
    
    default:
      return state;
  }
}

// Context interface
interface MessagingContextType {
  state: MessagingState;
  dispatch: React.Dispatch<MessagingAction>;
  
  // Conversation actions
  loadConversations: () => Promise<void>;
  createConversation: (request: CreateConversationRequest) => Promise<string | null>;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => Promise<void>;
  
  // Message actions
  loadMessages: (conversationId: string, offset?: number) => Promise<void>;
  sendMessage: (request: SendMessageRequest) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  
  // Draft management
  saveDraft: (conversationId: string, draft: string) => void;
  clearDraft: (conversationId: string) => void;
  getDraft: (conversationId: string) => string;
  
  // Media handling
  uploadMedia: (conversationId: string, attachment: MediaAttachment) => Promise<string | null>;
  
  // Real-time actions
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  
  // Selection actions
  toggleSelectionMode: () => void;
  selectMessage: (messageId: string) => void;
  clearSelection: () => void;
  
  // Utility functions
  getConversation: (id: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getUnreadCount: (conversationId?: string) => number;
  searchConversations: (query: string) => Conversation[];
  searchMessages: (query: MessageSearchQuery) => Message[];
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  
  // Notification management
  updateBadgeCount: (count: number) => void;
  clearNotifications: () => void;
  requestNotificationPermissions: () => Promise<boolean>;
}

// Create context
const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

// API functions (these would be replaced with actual API calls)
const mockApi = {
  async getConversations(): Promise<Conversation[]> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  },
  
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: `conv_${Date.now()}`,
      type: request.type || 'DIRECT',
      participants: [],
      lastMessageAt: new Date().toISOString(),
      isArchived: false,
      isMuted: false,
      isPinned: false,
      isSubscriptionRequired: request.isSubscriptionRequired || false,
      subscriptionTier: request.subscriptionTier,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  
  async getMessages(conversationId: string, offset = 0): Promise<Message[]> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 800));
    return [];
  },
  
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      id: `msg_${Date.now()}`,
      conversationId: request.conversationId,
      senderId: 'current_user_id',
      senderInfo: {
        id: 'current_user_id',
        name: 'Current User',
        role: 'FAN',
      },
      type: request.type,
      content: request.content,
      mediaUrl: request.mediaUrl,
      status: 'SENT',
      timestamp: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
    };
  },
  
  async uploadMedia(attachment: MediaAttachment): Promise<string> {
    // Mock implementation with progress simulation
    await new Promise(resolve => setTimeout(resolve, 2000));
    return `https://mock-cdn.com/media/${attachment.id}`;
  },
};

// Provider component
export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(messagingReducer, initialState);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const notificationServiceRef = useRef<NotificationService | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING_CONVERSATIONS', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const conversations = await mockApi.getConversations();
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load conversations' });
    } finally {
      dispatch({ type: 'SET_LOADING_CONVERSATIONS', payload: false });
    }
  }, []);
  
  // Create conversation
  const createConversation = useCallback(async (request: CreateConversationRequest): Promise<string | null> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      const conversation = await mockApi.createConversation(request);
      dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
      
      return conversation.id;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create conversation' });
      return null;
    }
  }, []);
  
  // Update conversation
  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    dispatch({ type: 'UPDATE_CONVERSATION', payload: { id, updates } });
  }, []);
  
  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      // API call would go here
      dispatch({ type: 'REMOVE_CONVERSATION', payload: id });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete conversation' });
    }
  }, []);
  
  // Load messages
  const loadMessages = useCallback(async (conversationId: string, offset = 0) => {
    try {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const messages = await mockApi.getMessages(conversationId, offset);
      
      if (offset === 0) {
        dispatch({ type: 'SET_MESSAGES', payload: { conversationId, messages } });
      } else {
        // Append to existing messages for pagination
        messages.forEach(message => {
          dispatch({ type: 'ADD_MESSAGE', payload: message });
        });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load messages' });
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
    }
  }, []);
  
  // Send message
  const sendMessage = useCallback(async (request: SendMessageRequest) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      // Create optimistic message
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        conversationId: request.conversationId,
        senderId: 'current_user_id',
        senderInfo: {
          id: 'current_user_id',
          name: 'Current User',
          role: 'FAN',
        },
        type: request.type,
        content: request.content,
        mediaUrl: request.mediaUrl,
        status: 'SENDING',
        timestamp: new Date().toISOString(),
        isEdited: false,
        isDeleted: false,
      };
      
      // Add optimistic message
      dispatch({ type: 'ADD_MESSAGE', payload: tempMessage });
      
      // Clear draft
      dispatch({ type: 'CLEAR_DRAFT', payload: request.conversationId });
      
      // Send to API
      const sentMessage = await mockApi.sendMessage(request);
      
      // Update with real message
      dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId: tempMessage.id, updates: sentMessage } });
      
      // Update conversation's last message
      dispatch({
        type: 'UPDATE_CONVERSATION',
        payload: {
          id: request.conversationId,
          updates: {
            lastMessage: sentMessage,
            lastMessageAt: sentMessage.timestamp,
          },
        },
      });
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
    }
  }, []);
  
  // Draft management
  const saveDraft = useCallback((conversationId: string, draft: string) => {
    dispatch({ type: 'SET_DRAFT', payload: { conversationId, draft } });
    
    // Save to AsyncStorage for persistence
    AsyncStorage.setItem(`draft_${conversationId}`, draft);
  }, []);
  
  const clearDraft = useCallback((conversationId: string) => {
    dispatch({ type: 'CLEAR_DRAFT', payload: conversationId });
    AsyncStorage.removeItem(`draft_${conversationId}`);
  }, []);
  
  const getDraft = useCallback((conversationId: string): string => {
    return state.messageDrafts[conversationId] || '';
  }, [state.messageDrafts]);
  
  // Media upload
  const uploadMedia = useCallback(async (conversationId: string, attachment: MediaAttachment): Promise<string | null> => {
    try {
      dispatch({ type: 'START_MEDIA_UPLOAD', payload: attachment });
      
      const mediaUrl = await mockApi.uploadMedia(attachment);
      
      dispatch({ type: 'COMPLETE_MEDIA_UPLOAD', payload: { tempId: attachment.id, mediaUrl } });
      
      return mediaUrl;
    } catch (error) {
      dispatch({ type: 'FAIL_MEDIA_UPLOAD', payload: attachment.id });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to upload media' });
      return null;
    }
  }, []);
  
  // Typing indicators
  const startTyping = useCallback((conversationId: string) => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing event via WebSocket
    if (wsServiceRef.current?.isConnected) {
      wsServiceRef.current.sendTypingStart(conversationId);
    }
    
    // Auto-stop typing after timeout
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversationId);
    }, MESSAGE_LIMITS.TYPING_TIMEOUT);
  }, []);
  
  const stopTyping = useCallback((conversationId: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    // Send stop typing event via WebSocket
    if (wsServiceRef.current?.isConnected) {
      wsServiceRef.current.sendTypingStop(conversationId);
    }
  }, []);
  
  // Selection actions
  const toggleSelectionMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECTION_MODE' });
  }, []);
  
  const selectMessage = useCallback((messageId: string) => {
    dispatch({ type: 'SELECT_MESSAGE', payload: messageId });
  }, []);
  
  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);
  
  // Utility functions
  const getConversation = useCallback((id: string): Conversation | undefined => {
    return state.conversations[id];
  }, [state.conversations]);
  
  const getMessages = useCallback((conversationId: string): Message[] => {
    return state.messages[conversationId] || [];
  }, [state.messages]);
  
  const getUnreadCount = useCallback((conversationId?: string): number => {
    if (conversationId) {
      return state.conversations[conversationId]?.unreadCount || 0;
    }
    
    return Object.values(state.conversations).reduce(
      (total, conv) => total + (conv.unreadCount || 0),
      0
    );
  }, [state.conversations]);
  
  const searchConversations = useCallback((query: string): Conversation[] => {
    const lowercaseQuery = query.toLowerCase();
    return state.conversationsList
      .map(id => state.conversations[id])
      .filter(conv => 
        conv.title?.toLowerCase().includes(lowercaseQuery) ||
        conv.participants.some(p => p.userName.toLowerCase().includes(lowercaseQuery))
      );
  }, [state.conversations, state.conversationsList]);
  
  const searchMessages = useCallback((query: MessageSearchQuery): Message[] => {
    const results: Message[] = [];
    
    Object.entries(state.messages).forEach(([conversationId, messages]) => {
      if (query.conversationId && conversationId !== query.conversationId) {
        return;
      }
      
      messages.forEach(message => {
        let matches = true;
        
        if (query.query && !message.content.toLowerCase().includes(query.query.toLowerCase())) {
          matches = false;
        }
        
        if (query.senderId && message.senderId !== query.senderId) {
          matches = false;
        }
        
        if (query.messageType && message.type !== query.messageType) {
          matches = false;
        }
        
        if (query.hasMedia !== undefined && (!!message.mediaUrl) !== query.hasMedia) {
          matches = false;
        }
        
        if (query.dateRange) {
          const messageTime = new Date(message.timestamp).getTime();
          const startTime = new Date(query.dateRange.start).getTime();
          const endTime = new Date(query.dateRange.end).getTime();
          
          if (messageTime < startTime || messageTime > endTime) {
            matches = false;
          }
        }
        
        if (matches) {
          results.push(message);
        }
      });
    });
    
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.messages]);
  
  // WebSocket connection management
  const connect = useCallback(async () => {
    try {
      // Initialize NotificationService if not already initialized
      if (!notificationServiceRef.current) {
        notificationServiceRef.current = new NotificationService();
        await notificationServiceRef.current.initialize();
      }
      
      if (!wsServiceRef.current) {
        // Initialize WebSocket service
        const wsConfig: WebSocketServiceConfig = {
          url: process.env.EXPO_PUBLIC_WS_URL || 'wss://api.nahveeeven.com/ws',
          reconnectInterval: 3000,
          maxReconnectAttempts: 5,
          heartbeatInterval: 30000,
          token: undefined, // This should come from auth context
        };
        
        wsServiceRef.current = new WebSocketService(wsConfig, {
          onConnect: () => {
            dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'CONNECTED' });
            dispatch({ type: 'CLEAR_ERROR' });
          },
          onDisconnect: () => {
            dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'DISCONNECTED' });
          },
          onError: (error) => {
            console.error('WebSocket error:', error);
            dispatch({ type: 'SET_ERROR', payload: 'Connection error' });
          },
          onMessage: (message) => {
            dispatch({ type: 'ADD_MESSAGE', payload: message });
            
            // Schedule notification for new message if not from current user
            if (message.senderId !== 'current_user_id' && notificationServiceRef.current) {
              const conversation = state.conversations[message.conversationId];
              notificationServiceRef.current.showMessageNotification({
                messageId: message.id,
                senderId: message.senderId,
                senderName: message.senderInfo?.name || 'Unknown User',
                content: message.content,
                conversationId: message.conversationId,
                timestamp: message.timestamp,
                type: message.type,
              });
            }
          },
          onMessageUpdate: (messageId, updates) => {
            dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, updates } });
          },
          onConversationUpdate: (conversationId, updates) => {
            dispatch({ type: 'UPDATE_CONVERSATION', payload: { id: conversationId, updates } });
          },
          onTypingStart: (indicator) => {
            dispatch({ type: 'SET_TYPING_INDICATOR', payload: indicator });
            
            // Show typing notification if enabled and not from current user
            if (indicator.userId !== 'current_user_id' && notificationServiceRef.current) {
              notificationServiceRef.current.showTypingNotification(
                indicator.userName,
                indicator.conversationId
              );
            }
          },
          onTypingStop: (indicator) => {
            dispatch({ type: 'REMOVE_TYPING_INDICATOR', payload: { conversationId: indicator.conversationId, userId: indicator.userId } });
          },
          onUserStatusChange: (userId, isOnline) => {
            if (isOnline) {
              dispatch({ type: 'SET_USER_ONLINE', payload: userId });
            } else {
              dispatch({ type: 'SET_USER_OFFLINE', payload: userId });
            }
          },
          onConnectionStatusChange: (status) => {
            dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });
          },
        });
      }
      
      await wsServiceRef.current.connect();
    } catch (error) {
      console.error('Failed to connect to messaging service:', error);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'DISCONNECTED' });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to messaging service' });
    }
  }, []);
  
  const disconnect = useCallback(() => {
    if (wsServiceRef.current) {
      wsServiceRef.current.disconnect();
    }
    
    // Clear any active notifications when disconnecting
    if (notificationServiceRef.current) {
      notificationServiceRef.current.clearAllNotifications();
    }
  }, []);
  
  const reconnect = useCallback(async () => {
    if (wsServiceRef.current) {
      wsServiceRef.current.reconnect();
    } else {
      await connect();
    }
  }, [connect]);
  
  // Notification management methods
  const updateBadgeCount = useCallback((count: number) => {
    if (notificationServiceRef.current) {
      notificationServiceRef.current.setBadgeCount(count);
    }
  }, []);
  
  const clearNotifications = useCallback(() => {
    if (notificationServiceRef.current) {
      notificationServiceRef.current.clearAllNotifications();
    }
  }, []);
  
  const requestNotificationPermissions = useCallback(async (): Promise<boolean> => {
    if (notificationServiceRef.current) {
      return await notificationServiceRef.current.requestPermissions();
    }
    return false;
  }, []);
  
  // Load drafts from AsyncStorage on mount
  useEffect(() => {
    const loadSavedDrafts = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const draftKeys = keys.filter(key => key.startsWith('draft_'));
        
        for (const key of draftKeys) {
          const draft = await AsyncStorage.getItem(key);
          if (draft) {
            const conversationId = key.replace('draft_', '');
            dispatch({ type: 'SET_DRAFT', payload: { conversationId, draft } });
          }
        }
      } catch (error) {
        console.warn('Failed to load saved drafts:', error);
      }
    };
    
    loadSavedDrafts();
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Update badge count when conversation unread counts change
  useEffect(() => {
    if (notificationServiceRef.current) {
      const totalUnread = Object.values(state.conversations).reduce(
        (total, conv) => total + (conv.unreadCount || 0),
        0
      );
      notificationServiceRef.current.setBadgeCount(totalUnread);
    }
  }, [state.conversations]);
  
  // Additional context methods for completeness
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      // API call would go here
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          messageId,
          updates: {
            content: newContent,
            isEdited: true,
            editedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to edit message' });
    }
  }, []);
  
  const deleteMessage = useCallback(async (conversationId: string, messageId: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      // API call would go here
      dispatch({ type: 'DELETE_MESSAGE', payload: { conversationId, messageId } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete message' });
    }
  }, []);
  
  const contextValue: MessagingContextType = {
    state,
    dispatch,
    
    // Conversation actions
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    
    // Message actions
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    
    // Draft management
    saveDraft,
    clearDraft,
    getDraft,
    
    // Media handling
    uploadMedia,
    
    // Real-time actions
    startTyping,
    stopTyping,
    
    // Selection actions
    toggleSelectionMode,
    selectMessage,
    clearSelection,
    
    // Utility functions
    getConversation,
    getMessages,
    getUnreadCount,
    searchConversations,
    searchMessages,
    
    // Connection management
    connect,
    disconnect,
    reconnect,
    
    // Notification management
    updateBadgeCount,
    clearNotifications,
    requestNotificationPermissions,
  };
  
  return (
    <MessagingContext.Provider value={contextValue}>
      {children}
    </MessagingContext.Provider>
  );
}

// Hook for using messaging context
export function useMessaging(): MessagingContextType {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}

export default MessagingContext;
import { 
  WebSocketMessage, 
  MessageEvent, 
  ConversationEvent,
  TypingIndicator,
  Message,
  Conversation 
} from '../types/messaging';

export interface WebSocketServiceConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  token?: string;
}

export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: Message) => void;
  onMessageUpdate?: (messageId: string, updates: Partial<Message>) => void;
  onConversationUpdate?: (conversationId: string, updates: Partial<Conversation>) => void;
  onTypingStart?: (indicator: TypingIndicator) => void;
  onTypingStop?: (indicator: TypingIndicator) => void;
  onUserStatusChange?: (userId: string, isOnline: boolean) => void;
  onConnectionStatusChange?: (status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED') => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private handlers: WebSocketEventHandlers;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private lastPong = Date.now();

  constructor(config: WebSocketServiceConfig, handlers: WebSocketEventHandlers = {}) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...config,
    };
    this.handlers = handlers;
  }

  // Connection management
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.shouldReconnect = true;
      this.handlers.onConnectionStatusChange?.('CONNECTING');

      try {
        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl);
        this.setupEventListeners();

        const connectTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.handlers.onConnect?.();
          this.handlers.onConnectionStatusChange?.('CONNECTED');
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.handlers.onError?.(error);
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        this.handlers.onConnectionStatusChange?.('DISCONNECTED');
        reject(error);
      }
    });
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.handlers.onDisconnect?.();
    this.handlers.onConnectionStatusChange?.('DISCONNECTED');
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 1000);
  }

  // Message sending
  public sendMessage(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const wsMessage: WebSocketMessage = {
          type: 'MESSAGE',
          payload: message,
          timestamp: new Date().toISOString(),
        };
        this.ws.send(JSON.stringify(wsMessage));
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    }
    return false;
  }

  public sendTypingStart(conversationId: string): boolean {
    return this.sendMessage({
      type: 'TYPING_START',
      conversationId,
      userId: this.getCurrentUserId(),
    });
  }

  public sendTypingStop(conversationId: string): boolean {
    return this.sendMessage({
      type: 'TYPING_STOP',
      conversationId,
      userId: this.getCurrentUserId(),
    });
  }

  public joinConversation(conversationId: string): boolean {
    return this.sendMessage({
      type: 'JOIN_CONVERSATION',
      conversationId,
    });
  }

  public leaveConversation(conversationId: string): boolean {
    return this.sendMessage({
      type: 'LEAVE_CONVERSATION',
      conversationId,
    });
  }

  public markMessageAsRead(conversationId: string, messageId: string): boolean {
    return this.sendMessage({
      type: 'MARK_READ',
      conversationId,
      messageId,
    });
  }

  public updateUserStatus(isOnline: boolean): boolean {
    return this.sendMessage({
      type: 'USER_STATUS',
      isOnline,
    });
  }

  // Private methods
  private buildWebSocketUrl(): string {
    const { url, token } = this.config;
    const wsUrl = new URL(url);
    
    if (token) {
      wsUrl.searchParams.append('token', token);
    }
    
    // Add client info
    wsUrl.searchParams.append('client', 'mobile');
    wsUrl.searchParams.append('version', '1.0.0');
    
    return wsUrl.toString();
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(wsMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.stopHeartbeat();
      
      if (event.code !== 1000 && this.shouldReconnect) {
        this.handleReconnect();
      } else {
        this.handlers.onDisconnect?.();
        this.handlers.onConnectionStatusChange?.('DISCONNECTED');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handlers.onError?.(error);
    };
  }

  private handleMessage(wsMessage: WebSocketMessage): void {
    const { type, payload, conversationId } = wsMessage;

    switch (type) {
      case 'MESSAGE':
        this.handleMessageEvent(payload);
        break;
        
      case 'TYPING':
        this.handleTypingEvent(payload);
        break;
        
      case 'CONVERSATION_UPDATE':
        this.handleConversationUpdate(payload);
        break;
        
      case 'USER_STATUS':
        this.handleUserStatusChange(payload);
        break;
        
      case 'CONNECTION':
        this.handleConnectionEvent(payload);
        break;
        
      default:
        console.warn('Unknown WebSocket message type:', type);
    }
  }

  private handleMessageEvent(payload: any): void {
    const { type: eventType, message, messageId, updates } = payload;

    switch (eventType) {
      case 'MESSAGE_SENT':
      case 'MESSAGE_RECEIVED':
        if (message) {
          this.handlers.onMessage?.(message);
        }
        break;
        
      case 'MESSAGE_UPDATED':
        if (messageId && updates) {
          this.handlers.onMessageUpdate?.(messageId, updates);
        }
        break;
        
      case 'MESSAGE_DELETED':
        if (messageId) {
          this.handlers.onMessageUpdate?.(messageId, { isDeleted: true });
        }
        break;
    }
  }

  private handleTypingEvent(payload: any): void {
    const { type: eventType, conversationId, userId, userName } = payload;
    
    const indicator: TypingIndicator = {
      conversationId,
      userId,
      userName: userName || 'Unknown',
      isTyping: eventType === 'TYPING_START',
      timestamp: new Date().toISOString(),
    };

    if (eventType === 'TYPING_START') {
      this.handlers.onTypingStart?.(indicator);
    } else if (eventType === 'TYPING_STOP') {
      this.handlers.onTypingStop?.(indicator);
    }
  }

  private handleConversationUpdate(payload: any): void {
    const { conversationId, updates } = payload;
    
    if (conversationId && updates) {
      this.handlers.onConversationUpdate?.(conversationId, updates);
    }
  }

  private handleUserStatusChange(payload: any): void {
    const { userId, isOnline } = payload;
    
    if (userId !== undefined && isOnline !== undefined) {
      this.handlers.onUserStatusChange?.(userId, isOnline);
    }
  }

  private handleConnectionEvent(payload: any): void {
    const { type: eventType } = payload;
    
    switch (eventType) {
      case 'PING':
        // Respond with PONG
        this.sendMessage({ type: 'PONG' });
        break;
        
      case 'PONG':
        this.lastPong = Date.now();
        break;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnect attempts reached');
      this.handlers.onConnectionStatusChange?.('DISCONNECTED');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);
    
    this.handlers.onConnectionStatusChange?.('CONNECTING');
    
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch((error) => {
          console.error('Reconnect failed:', error);
          this.handleReconnect();
        });
      }
    }, Math.min(delay, 30000)); // Cap at 30 seconds
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const now = Date.now();
        
        // Check if we received a pong recently
        if (now - this.lastPong > this.config.heartbeatInterval! * 2) {
          console.warn('WebSocket heartbeat timeout, reconnecting...');
          this.reconnect();
          return;
        }
        
        // Send ping
        this.sendMessage({ type: 'PING' });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getCurrentUserId(): string {
    // This should be retrieved from user context or auth service
    return 'current_user_id';
  }

  // Public getters
  public get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public get connectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'DISCONNECTING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }

  // Update handlers
  public updateHandlers(newHandlers: Partial<WebSocketEventHandlers>): void {
    this.handlers = { ...this.handlers, ...newHandlers };
  }

  // Update config
  public updateConfig(newConfig: Partial<WebSocketServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default WebSocketService;
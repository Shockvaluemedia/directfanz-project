import { Server as SocketIOServer } from 'socket.io';
import {
  createConversationId,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from '@/types/websocket';
import { WebSocketHandler } from './websocket-handler';

class WebSocketSingleton {
  private static instance: WebSocketSingleton;
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null = null;
  private handler: WebSocketHandler | null = null;

  private constructor() {}

  public static getInstance(): WebSocketSingleton {
    if (!WebSocketSingleton.instance) {
      WebSocketSingleton.instance = new WebSocketSingleton();
    }
    return WebSocketSingleton.instance;
  }

  public setIO(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ) {
    this.io = io;
    this.handler = new WebSocketHandler(io);
    this.handler.initialize();
  }

  public getIO(): SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null {
    return this.io;
  }

  public getHandler(): WebSocketHandler | null {
    return this.handler;
  }

  // Convenience methods for API routes
  public emitToUser(userId: string, event: keyof ServerToClientEvents, data: any): void {
    if (this.handler) {
      this.handler.emitToUser(userId, event, data);
    }
  }

  public emitToConversation(
    userId1: string,
    userId2: string,
    event: keyof ServerToClientEvents,
    data: any
  ): void {
    if (this.handler) {
      this.handler.emitToConversation(userId1, userId2, event, data);
    }
  }

  public isUserOnline(userId: string): boolean {
    return this.handler ? this.handler.isUserOnline(userId) : false;
  }

  public getOnlineUsers(): any[] {
    return this.handler ? this.handler.getOnlineUsers() : [];
  }
}

// Export the singleton instance
export const webSocketInstance = WebSocketSingleton.getInstance();

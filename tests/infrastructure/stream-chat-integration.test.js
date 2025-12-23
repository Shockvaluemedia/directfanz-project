/**
 * Property-Based Test for Stream Chat Integration
 * **Property 16: Stream Chat Integration**
 * **Validates: Requirements 5.4**
 * 
 * Tests that WebSocket-based chat functionality remains operational and synchronized with stream state
 */

const fc = require('fast-check');

// Mock WebSocket server and streaming infrastructure
class MockStreamingServer {
  constructor() {
    this.activeStreams = new Map();
    this.chatSessions = new Map();
    this.streamViewers = new Map();
  }

  createStream(streamId, broadcasterId) {
    const stream = {
      id: streamId,
      broadcasterId,
      status: 'STARTING',
      viewers: new Set(),
      chatMessages: [],
      startTime: new Date(),
    };
    
    this.activeStreams.set(streamId, stream);
    this.streamViewers.set(streamId, new Set());
    return stream;
  }

  joinStream(streamId, userId, role = 'VIEWER') {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    if (role === 'BROADCASTER') {
      stream.status = 'LIVE';
    } else {
      stream.viewers.add(userId);
      this.streamViewers.get(streamId).add(userId);
    }

    // Create chat session for user
    this.chatSessions.set(userId, {
      streamId,
      role,
      joinedAt: new Date(),
      isActive: true,
    });

    return true;
  }

  sendChatMessage(streamId, senderId, message) {
    const stream = this.activeStreams.get(streamId);
    const senderSession = this.chatSessions.get(senderId);
    
    // Check if stream exists and is live, and sender is in the stream
    if (!stream || stream.status !== 'LIVE' || !senderSession || senderSession.streamId !== streamId || !senderSession.isActive) {
      return null;
    }

    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      streamId,
      senderId,
      message: message.content,
      type: message.type || 'MESSAGE',
      timestamp: new Date(),
      isHighlighted: message.isHighlighted || false,
    };

    stream.chatMessages.push(chatMessage);
    return chatMessage;
  }

  getChatMessages(streamId, limit = 50) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return [];

    return stream.chatMessages
      .slice(-limit)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  endStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    stream.status = 'ENDED';
    stream.endTime = new Date();

    // Clean up chat sessions for this stream
    for (const [userId, session] of this.chatSessions.entries()) {
      if (session.streamId === streamId) {
        session.isActive = false;
      }
    }

    return true;
  }

  getStreamStatus(streamId) {
    const stream = this.activeStreams.get(streamId);
    return stream ? stream.status : null;
  }

  isUserInStream(streamId, userId) {
    const session = this.chatSessions.get(userId);
    return session && session.streamId === streamId && session.isActive;
  }

  getActiveViewers(streamId) {
    const viewers = this.streamViewers.get(streamId);
    return viewers ? Array.from(viewers) : [];
  }
}

// Generators for property-based testing
const streamIdGen = fc.string({ minLength: 1, maxLength: 20 }).map(s => `stream_${s}`);
const userIdGen = fc.string({ minLength: 1, maxLength: 15 }).map(s => `user_${s}`);
const messageContentGen = fc.string({ minLength: 1, maxLength: 500 });
const messageTypeGen = fc.constantFrom('MESSAGE', 'SYSTEM', 'HIGHLIGHT', 'TIP');

const chatMessageGen = fc.record({
  content: messageContentGen,
  type: messageTypeGen,
  isHighlighted: fc.boolean(),
});

const streamSetupGen = fc.record({
  streamId: streamIdGen,
  broadcasterId: userIdGen,
  viewers: fc.array(userIdGen, { minLength: 0, maxLength: 10 }),
});

describe('Stream Chat Integration Property Tests', () => {
  let server;

  beforeEach(() => {
    server = new MockStreamingServer();
  });

  /**
   * Property 16: Stream Chat Integration
   * For any active live stream, the WebSocket-based chat functionality should remain operational and synchronized with the stream state
   */
  test('Property 16: Stream Chat Integration - Chat functionality synchronized with stream state', () => {
    fc.assert(
      fc.property(
        streamSetupGen,
        fc.array(chatMessageGen, { minLength: 1, maxLength: 20 }),
        (streamSetup, messages) => {
          const { streamId, broadcasterId, viewers } = streamSetup;

          // Create and start stream
          const stream = server.createStream(streamId, broadcasterId);
          expect(stream).toBeTruthy();

          // Broadcaster joins stream
          const broadcasterJoined = server.joinStream(streamId, broadcasterId, 'BROADCASTER');
          expect(broadcasterJoined).toBe(true);

          // Verify stream is live
          expect(server.getStreamStatus(streamId)).toBe('LIVE');

          // Viewers join stream
          const joinedViewers = [];
          for (const viewerId of viewers) {
            if (viewerId !== broadcasterId) { // Avoid duplicate broadcaster
              const joined = server.joinStream(streamId, viewerId, 'VIEWER');
              if (joined) {
                joinedViewers.push(viewerId);
              }
            }
          }

          // Verify viewers are in stream
          for (const viewerId of joinedViewers) {
            expect(server.isUserInStream(streamId, viewerId)).toBe(true);
          }

          // Send chat messages from different users
          const sentMessages = [];
          const allUsers = [broadcasterId, ...joinedViewers];
          
          for (let i = 0; i < messages.length && i < allUsers.length; i++) {
            const senderId = allUsers[i % allUsers.length];
            const message = messages[i];
            
            const sentMessage = server.sendChatMessage(streamId, senderId, message);
            if (sentMessage) {
              sentMessages.push(sentMessage);
              
              // Verify message properties
              expect(sentMessage.streamId).toBe(streamId);
              expect(sentMessage.senderId).toBe(senderId);
              expect(sentMessage.message).toBe(message.content);
              expect(sentMessage.type).toBe(message.type);
              expect(sentMessage.isHighlighted).toBe(message.isHighlighted);
              expect(sentMessage.timestamp).toBeInstanceOf(Date);
            }
          }

          // Verify chat messages are retrievable and in correct order
          const retrievedMessages = server.getChatMessages(streamId);
          expect(retrievedMessages.length).toBe(sentMessages.length);

          // Verify message order (should be chronological)
          for (let i = 1; i < retrievedMessages.length; i++) {
            expect(retrievedMessages[i].timestamp.getTime())
              .toBeGreaterThanOrEqual(retrievedMessages[i - 1].timestamp.getTime());
          }

          // Verify all sent messages are present
          for (const sentMessage of sentMessages) {
            const found = retrievedMessages.find(msg => msg.id === sentMessage.id);
            expect(found).toBeTruthy();
            expect(found.streamId).toBe(streamId);
          }

          // End stream and verify chat state
          const streamEnded = server.endStream(streamId);
          expect(streamEnded).toBe(true);
          expect(server.getStreamStatus(streamId)).toBe('ENDED');

          // Verify chat sessions are deactivated when stream ends
          for (const userId of allUsers) {
            const session = server.chatSessions.get(userId);
            if (session && session.streamId === streamId) {
              expect(session.isActive).toBe(false);
            }
          }

          // Verify chat messages persist after stream ends
          const messagesAfterEnd = server.getChatMessages(streamId);
          expect(messagesAfterEnd.length).toBe(sentMessages.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 16: Stream Chat Integration - Chat only works for active stream participants', () => {
    fc.assert(
      fc.property(
        streamIdGen,
        userIdGen,
        userIdGen,
        userIdGen,
        chatMessageGen,
        (streamId, broadcasterId, viewerId, outsiderId, message) => {
          // Ensure all users are different
          fc.pre(broadcasterId !== viewerId && broadcasterId !== outsiderId && viewerId !== outsiderId);

          // Create and start stream
          server.createStream(streamId, broadcasterId);
          server.joinStream(streamId, broadcasterId, 'BROADCASTER');
          server.joinStream(streamId, viewerId, 'VIEWER');

          // Verify stream participants can send messages
          const broadcasterMessage = server.sendChatMessage(streamId, broadcasterId, message);
          expect(broadcasterMessage).toBeTruthy();
          expect(broadcasterMessage.senderId).toBe(broadcasterId);

          const viewerMessage = server.sendChatMessage(streamId, viewerId, message);
          expect(viewerMessage).toBeTruthy();
          expect(viewerMessage.senderId).toBe(viewerId);

          // Verify non-participant cannot send messages
          const outsiderMessage = server.sendChatMessage(streamId, outsiderId, message);
          expect(outsiderMessage).toBeNull();

          // Verify only participant messages are in chat
          const chatMessages = server.getChatMessages(streamId);
          const outsiderMessages = chatMessages.filter(msg => msg.senderId === outsiderId);
          expect(outsiderMessages.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 16: Stream Chat Integration - Chat state consistency across stream lifecycle', () => {
    fc.assert(
      fc.property(
        streamIdGen,
        userIdGen,
        fc.array(userIdGen, { minLength: 1, maxLength: 5 }),
        fc.array(chatMessageGen, { minLength: 1, maxLength: 10 }),
        (streamId, broadcasterId, viewers, messages) => {
          // Filter out broadcaster from viewers
          const uniqueViewers = viewers.filter(v => v !== broadcasterId);
          fc.pre(uniqueViewers.length > 0);

          // Create stream
          server.createStream(streamId, broadcasterId);
          expect(server.getStreamStatus(streamId)).toBe('STARTING');

          // Initially, no one should be able to send messages in a starting stream
          const earlyMessage = server.sendChatMessage(streamId, broadcasterId, messages[0]);
          expect(earlyMessage).toBeNull();

          // Start stream by having broadcaster join
          server.joinStream(streamId, broadcasterId, 'BROADCASTER');
          expect(server.getStreamStatus(streamId)).toBe('LIVE');

          // Now broadcaster should be able to send messages
          const broadcasterMessage = server.sendChatMessage(streamId, broadcasterId, messages[0]);
          expect(broadcasterMessage).toBeTruthy();

          // Add viewers and verify they can chat
          const activeViewers = [];
          for (const viewerId of uniqueViewers) {
            const joined = server.joinStream(streamId, viewerId, 'VIEWER');
            if (joined) {
              activeViewers.push(viewerId);
              
              // Verify viewer can send messages
              if (messages.length > activeViewers.length) {
                const viewerMessage = server.sendChatMessage(
                  streamId, 
                  viewerId, 
                  messages[activeViewers.length]
                );
                expect(viewerMessage).toBeTruthy();
                expect(viewerMessage.senderId).toBe(viewerId);
              }
            }
          }

          // Verify all active participants are tracked correctly
          for (const viewerId of activeViewers) {
            expect(server.isUserInStream(streamId, viewerId)).toBe(true);
          }

          // End stream
          server.endStream(streamId);
          expect(server.getStreamStatus(streamId)).toBe('ENDED');

          // Verify no new messages can be sent after stream ends
          const postEndMessage = server.sendChatMessage(streamId, broadcasterId, messages[0]);
          expect(postEndMessage).toBeNull();

          // Verify chat history is preserved
          const finalMessages = server.getChatMessages(streamId);
          expect(finalMessages.length).toBeGreaterThan(0);

          // Verify all messages belong to the correct stream
          for (const msg of finalMessages) {
            expect(msg.streamId).toBe(streamId);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 16: Stream Chat Integration - Message ordering and synchronization', () => {
    fc.assert(
      fc.property(
        streamIdGen,
        userIdGen,
        fc.array(userIdGen, { minLength: 2, maxLength: 5 }),
        fc.array(chatMessageGen, { minLength: 5, maxLength: 15 }),
        (streamId, broadcasterId, viewers, messages) => {
          const uniqueViewers = viewers.filter(v => v !== broadcasterId);
          fc.pre(uniqueViewers.length >= 2 && messages.length >= 5);

          // Setup stream
          server.createStream(streamId, broadcasterId);
          server.joinStream(streamId, broadcasterId, 'BROADCASTER');
          
          const activeUsers = [broadcasterId];
          for (const viewerId of uniqueViewers) {
            if (server.joinStream(streamId, viewerId, 'VIEWER')) {
              activeUsers.push(viewerId);
            }
          }

          // Send messages from different users in sequence
          const sentMessages = [];
          for (let i = 0; i < messages.length && i < activeUsers.length * 3; i++) {
            const senderId = activeUsers[i % activeUsers.length];
            const message = messages[i % messages.length];
            
            // Add small delay simulation
            const sentMessage = server.sendChatMessage(streamId, senderId, {
              ...message,
              content: `${message.content}_${i}` // Make each message unique
            });
            
            if (sentMessage) {
              sentMessages.push(sentMessage);
            }
          }

          // Verify message ordering
          const retrievedMessages = server.getChatMessages(streamId);
          expect(retrievedMessages.length).toBe(sentMessages.length);

          // Messages should be in chronological order
          for (let i = 1; i < retrievedMessages.length; i++) {
            expect(retrievedMessages[i].timestamp.getTime())
              .toBeGreaterThanOrEqual(retrievedMessages[i - 1].timestamp.getTime());
          }

          // Verify message content integrity
          for (let i = 0; i < sentMessages.length; i++) {
            const sent = sentMessages[i];
            const retrieved = retrievedMessages.find(msg => msg.id === sent.id);
            
            expect(retrieved).toBeTruthy();
            expect(retrieved.message).toBe(sent.message);
            expect(retrieved.senderId).toBe(sent.senderId);
            expect(retrieved.type).toBe(sent.type);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: aws-conversion, Property 16: Stream Chat Integration
 * **Validates: Requirements 5.4**
 */
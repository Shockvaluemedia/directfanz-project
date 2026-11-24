# Real-Time WebSocket Messaging Implementation

This project now includes a comprehensive real-time messaging system using
WebSockets (Socket.IO). The implementation provides live chat functionality with
typing indicators, message status tracking, and user presence detection.

## 🚀 Features

- **Real-time messaging**: Instant message delivery and receipt
- **Typing indicators**: See when someone is typing
- **User presence**: Online/offline status indicators
- **Message status**: Sent, delivered, and read receipts
- **Auto-reconnection**: Automatic reconnection on connection loss
- **Message grouping**: Smart message grouping by time and sender
- **Responsive design**: Mobile-friendly chat interface
- **Authentication**: Secure WebSocket connections with JWT tokens

## 📁 Project Structure

```
src/
├── types/websocket.ts              # WebSocket event types and utilities
├── lib/
│   ├── websocket-handler.ts        # Server-side WebSocket event handlers
│   └── websocket-instance.ts       # WebSocket singleton for API routes
├── hooks/
│   └── use-websocket.ts           # React hook for WebSocket connections
├── components/chat/
│   ├── RealTimeChat.tsx           # Main chat component
│   ├── MessageList.tsx            # Message list with read receipts
│   ├── MessageBubble.tsx          # Individual message bubbles
│   ├── MessageInput.tsx           # Message input with typing detection
│   ├── MessageStatusIndicator.tsx  # Message delivery status icons
│   ├── TypingIndicator.tsx        # Typing indicator component
│   ├── ConnectionIndicator.tsx    # WebSocket connection status
│   └── UserPresenceIndicator.tsx  # User online/offline indicator
├── app/
│   ├── chat/[userId]/page.tsx     # Example chat page
│   └── api/messages/route.ts      # Updated with WebSocket events
└── server.ts                      # Custom Next.js server with Socket.IO
```

## 🛠 Installation & Setup

### 1. Dependencies are already installed:

- `socket.io` - WebSocket server
- `socket.io-client` - WebSocket client
- `date-fns` - Date formatting utilities

### 2. Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3000  # socket.io URL; unset = same origin
NEXTAUTH_SECRET=your-secret-here          # Required for JWT token verification
```

### 3. Database Schema Updates

Ensure your Prisma schema includes these fields in the Message model:

```prisma
model Message {
  id            String    @id @default(cuid())
  senderId      String
  recipientId   String
  content       String
  type          MessageType @default(TEXT)
  attachmentUrl String?
  createdAt     DateTime  @default(now())
  readAt        DateTime?
  deliveredAt   DateTime?

  sender        User      @relation("SentMessages", fields: [senderId], references: [id])
  recipient     User      @relation("ReceivedMessages", fields: [recipientId], references: [id])

  @@map("messages")
}

model User {
  id            String    @id @default(cuid())
  displayName   String
  avatar        String?
  role          UserRole
  lastSeenAt    DateTime?

  sentMessages     Message[] @relation("SentMessages")
  receivedMessages Message[] @relation("ReceivedMessages")

  @@map("users")
}

enum MessageType {
  TEXT
  IMAGE
  AUDIO
}
```

## 🚀 Running the Application

### Development

```bash
npm run dev
```

This starts the custom server with WebSocket support on `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

### Legacy Next.js (without WebSockets)

```bash
npm run dev:next    # Development
npm run start:next  # Production
```

## 💻 Usage

### Basic Chat Component

```tsx
import { RealTimeChat } from '@/components/chat/RealTimeChat';
import { User } from '@/types/websocket';

function ChatPage() {
  const otherUser: User = {
    id: 'user-id',
    displayName: 'John Doe',
    avatar: '/avatar.jpg',
    role: 'ARTIST',
  };

  return (
    <div className='h-screen'>
      <RealTimeChat
        otherUser={otherUser}
        initialMessages={[]}
        onMessageSent={message => console.log('Sent:', message)}
      />
    </div>
  );
}
```

### Using the WebSocket Hook

```tsx
import { useWebSocket } from '@/hooks/use-websocket';

function CustomChat() {
  const {
    isConnected,
    sendMessage,
    messages,
    typingUsers,
    onlineUsers,
    connectionStatus,
    error,
  } = useWebSocket();

  const handleSend = () => {
    sendMessage('recipient-id', 'Hello World!');
  };

  return (
    <div>
      <p>Status: {connectionStatus}</p>
      <p>Online users: {onlineUsers.length}</p>
      <button onClick={handleSend} disabled={!isConnected}>
        Send Message
      </button>
    </div>
  );
}
```

### API Integration

The message API routes automatically emit WebSocket events:

```typescript
// In your API routes
import { webSocketInstance } from '@/lib/websocket-instance';

// Emit to specific user
webSocketInstance.emitToUser(userId, 'message:new', message);

// Emit to conversation
webSocketInstance.emitToConversation(userId1, userId2, 'message:read', data);

// Check if user is online
const isOnline = webSocketInstance.isUserOnline(userId);
```

## 🔧 Configuration

### WebSocket Options

Configure the `useWebSocket` hook:

```tsx
const websocket = useWebSocket({
  autoConnect: true, // Auto-connect when session available
  reconnection: true, // Enable auto-reconnection
  reconnectionAttempts: 5, // Max reconnection attempts
  reconnectionDelay: 1000, // Delay between attempts (ms)
});
```

### Server Configuration

Customize the Socket.IO server in `server.ts`:

```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000, // Connection timeout
  pingInterval: 25000, // Heartbeat interval
  transports: ['websocket', 'polling'],
});
```

## 📱 Features Overview

### Real-Time Messaging

- Instant message delivery
- Message deduplication
- Automatic message ordering
- Support for text, images, and audio

### Typing Indicators

- Shows when users are typing
- Auto-timeout after inactivity
- Multiple users typing support

### Message Status

- **Sent**: Message saved to database
- **Delivered**: Recipient is online and received message
- **Read**: Recipient has viewed the message

### User Presence

- Real-time online/offline status
- Visual presence indicators
- Last seen timestamps

### Connection Management

- Automatic reconnection on network issues
- Connection status indicators
- Graceful error handling

## 🎨 Styling

The components use Tailwind CSS classes and support dark mode. Key styling
features:

- Responsive design (mobile-first)
- Dark mode support
- Smooth animations
- Accessibility-friendly colors
- Custom message bubbles

## 🔐 Security

### Authentication

- JWT token-based authentication
- Server-side token verification
- Secure WebSocket handshake

### Authorization

- Users can only join conversations they're part of
- Message access control
- API endpoint protection

### Data Validation

- Input sanitization
- Message length limits
- File upload restrictions

## 📊 Performance

### Optimization Features

- Message pagination
- Automatic message cleanup
- Efficient re-rendering with React hooks
- Lazy loading of message history
- WebSocket connection pooling

### Memory Management

- Automatic cleanup of typing indicators
- Connection timeout handling
- Event listener cleanup on unmount

## 🐛 Troubleshooting

### Common Issues

**WebSocket connection fails**

- Check the `NEXT_PUBLIC_WEBSOCKET_URL` environment variable (unset means same origin)
- Ensure custom server is running (`npm run dev`)
- Verify JWT token is valid

**Messages not appearing**

- Check browser console for errors
- Verify user authentication
- Ensure database schema is updated

**Typing indicators not working**

- Check WebSocket connection status
- Verify conversation room joining
- Look for JavaScript errors

**Performance issues**

- Limit message history (pagination)
- Check for memory leaks in console
- Monitor WebSocket connection count

### Debug Mode

Enable debug logging:

```typescript
// In your component
const websocket = useWebSocket();
websocket.on('connect', () => console.log('Connected!'));
websocket.on('disconnect', () => console.log('Disconnected!'));
websocket.on('error', error => console.error('WebSocket error:', error));
```

## 🚀 Future Enhancements

Potential improvements to consider:

- **Message Reactions**: Emoji reactions to messages
- **File Sharing**: Image and file upload support
- **Voice Messages**: Audio recording and playback
- **Group Chats**: Multi-user conversations
- **Message Search**: Full-text search across conversations
- **Push Notifications**: Browser notifications for new messages
- **Message Encryption**: End-to-end encryption
- **Chat Moderation**: Automated content filtering

## 📄 License

This WebSocket implementation is part of the DirectFanZ Project platform and follows
the same licensing terms as the main project.

---

For questions or issues with the WebSocket implementation, please check the
troubleshooting section above or review the component documentation in the
source code.

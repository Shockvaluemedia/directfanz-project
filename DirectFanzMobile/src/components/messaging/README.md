# Messaging System Integration Guide

## Overview

The messaging system is now fully integrated into the DirectFanZ Project mobile app with real-time messaging, push notifications, and seamless navigation.

## Key Components

### 1. Navigation Integration

The messaging system is integrated into the main tab navigation:
- **Messages Tab**: Accessible from the bottom tab bar with unread count badge
- **Deep Linking**: Notifications automatically navigate to relevant conversations
- **Navigation Service**: Handles messaging navigation from any part of the app

### 2. Core Components

- **MessagingContext**: Central state management for all messaging features
- **WebSocketService**: Real-time messaging and typing indicators
- **NotificationService**: Push notifications and badge management
- **MessagingNavigator**: Navigation stack for messaging screens

### 3. UI Components

- **ConversationListScreen**: Lists all user conversations with search and filters
- **ChatScreen**: Individual conversation with messages, media, and typing indicators
- **MessageButton**: Button to start conversations from user profiles
- **MessagingBadge**: Shows unread count on the Messages tab

## Usage in Existing Components

### Adding Message Buttons to Profile Screens

```tsx
import MessageButton, { CompactMessageButton } from '../components/messaging/MessageButton';

// In a profile screen component
<MessageButton 
  userId={profile.id}
  userName={profile.name}
  variant="primary"
  size="medium"
/>

// Compact version for smaller spaces
<CompactMessageButton 
  userId={profile.id}
  userName={profile.name}
/>
```

### Navigation to Messaging

```tsx
import { useMessagingNavigation, messageUser } from '../hooks/useMessagingNavigation';

const MyComponent = () => {
  const { navigateToConversation, navigateToMessages } = useMessagingNavigation();
  
  // Navigate to specific conversation
  const openChat = () => {
    navigateToConversation('conversation_id', 'User Name');
  };
  
  // Navigate to messages list
  const openMessages = () => {
    navigateToMessages();
  };
  
  // Start new conversation with user
  const startChat = () => {
    messageUser('user_id', 'User Name');
  };
};
```

### Using Messaging Context

```tsx
import { useMessaging } from '../contexts/MessagingContext';

const MyComponent = () => {
  const { 
    state, 
    sendMessage, 
    getUnreadCount,
    clearNotifications 
  } = useMessaging();
  
  const unreadCount = getUnreadCount();
  // Use messaging functionality...
};
```

## App Setup Requirements

### 1. Wrap App with MessagingProvider

```tsx
// In App.tsx or similar root component
import { MessagingProvider } from './src/contexts/MessagingContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MessagingProvider>
          {/* Your app navigation */}
        </MessagingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### 2. Initialize NavigationService

```tsx
// In your root navigation component
import NavigationService from './src/services/NavigationService';

export default function AppNavigator() {
  return (
    <NavigationContainer 
      ref={(ref) => NavigationService.setNavigationRef(ref)}
    >
      {/* Your navigation stacks */}
    </NavigationContainer>
  );
}
```

## Environment Variables

Ensure these are set in your `.env` file:

```env
EXPO_PUBLIC_WS_URL=wss://api.nahveeeven.com/ws
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

## Real-time Features

### Message Notifications
- Automatic notifications for new messages from other users
- Smart notification suppression when user is in the conversation
- Badge count updates in real-time

### Typing Indicators
- Shows when other users are typing
- Auto-dismisses after inactivity
- Only shown for active conversations

### Online Presence
- Real-time user online/offline status
- Integrated with conversation list and chat screens

## Deep Linking

The system automatically handles deep linking from notifications:

- Message notifications → Navigate to specific conversation
- Typing notifications → Navigate to conversation
- General messaging notifications → Navigate to conversation list

## Customization

### Themes
The messaging system uses the app's ThemeContext for consistent styling.

### Permissions
Notification permissions are automatically requested when the messaging system initializes.

### Mock Data
Mock data is available for development and testing in:
- `src/data/mockMessagingData.ts`

## Future Enhancements

1. **Media Gallery Screen**: View all media shared in a conversation
2. **Message Search**: Search messages across all conversations  
3. **Conversation Settings**: Mute, archive, and manage conversations
4. **New Conversation Screen**: Search and select users to message
5. **Voice Messages**: Record and send audio messages
6. **Message Reactions**: React to messages with emojis
7. **Read Receipts**: See when messages are read by recipients

## Troubleshooting

### Common Issues

1. **Notifications not working**: Check notification permissions and push token registration
2. **WebSocket not connecting**: Verify WS_URL and network connectivity  
3. **Navigation not working**: Ensure NavigationService is properly initialized
4. **Messages not updating**: Check MessagingProvider is wrapping the app

### Debug Tools

- Check WebSocket connection status in MessagingContext state
- Monitor notification registration in NotificationService logs
- Use navigation debug tools to trace deep linking issues
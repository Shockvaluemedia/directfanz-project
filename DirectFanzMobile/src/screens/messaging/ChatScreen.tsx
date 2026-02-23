import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useMessaging } from '../../contexts/MessagingContext';
import {
  MessageBubble,
  MessageInput,
  ConversationHeader,
  TypingIndicator,
} from '../../components/messaging';
import { Message, SendMessageRequest, MediaAttachment } from '../../types/messaging';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDateSeparator, isSameDay } from '../../utils/dateUtils';

type ChatScreenNavigationProp = any; // Replace with proper navigation type
type ChatScreenRouteProp = RouteProp<any, 'ChatScreen'>;

interface DateSeparator {
  type: 'date-separator';
  id: string;
  date: string;
}

type MessageListItem = Message | DateSeparator;

const { height: screenHeight } = Dimensions.get('window');

const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { theme, colors } = useTheme();
  const styles = createStyles(colors, theme);
  const insets = useSafeAreaInsets();
  
  const { conversationId } = route.params as { conversationId: string };
  
  const {
    state,
    loadMessages,
    sendMessage,
    getConversation,
    getMessages,
    getDraft,
    saveDraft,
    clearDraft,
    startTyping,
    stopTyping,
    uploadMedia,
  } = useMessaging();

  // Local state
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = 'current_user_id'; // This should come from user context

  const conversation = getConversation(conversationId);
  const messages = getMessages(conversationId);
  const typingUsers = state.typingIndicators[conversationId] || [];
  
  // Load initial messages
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
      // Load saved draft
      const draft = getDraft(conversationId);
      setMessageInput(draft);
    }
  }, [conversationId, loadMessages, getDraft]);

  // Set header
  useEffect(() => {
    if (conversation) {
      navigation.setOptions({
        headerShown: false, // We'll use custom header
      });
    }
  }, [conversation, navigation]);

  // Group messages with date separators
  const messagesWithSeparators = useCallback((): MessageListItem[] => {
    if (!messages.length) return [];
    
    const items: MessageListItem[] = [];
    let lastDate = '';
    
    messages.forEach((message, index) => {
      const messageDate = message.timestamp;
      
      // Add date separator if needed
      if (!lastDate || !isSameDay(lastDate, messageDate)) {
        items.push({
          type: 'date-separator',
          id: `date-${messageDate}`,
          date: formatDateSeparator(messageDate),
        });
        lastDate = messageDate;
      }
      
      items.push(message);
    });
    
    return items;
  }, [messages]);

  const messageItems = messagesWithSeparators();

  // Handle message input changes
  const handleMessageInputChange = (text: string) => {
    setMessageInput(text);
    saveDraft(conversationId, text);
    
    // Handle typing indicators
    if (text.trim()) {
      startTyping(conversationId);
      
      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 3000);
    } else {
      stopTyping(conversationId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  // Send message
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !conversation) return;

    const request: SendMessageRequest = {
      conversationId: conversation.id,
      type: 'TEXT',
      content: messageText.trim(),
    };

    try {
      await sendMessage(request);
      setMessageInput('');
      clearDraft(conversationId);
      stopTyping(conversationId);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Handle media attachment
  const handleMediaSelected = async (attachment: MediaAttachment) => {
    if (!conversation) return;

    try {
      // First upload the media
      const mediaUrl = await uploadMedia(conversationId, attachment);
      
      if (mediaUrl) {
        // Then send the message with media
        const request: SendMessageRequest = {
          conversationId: conversation.id,
          type: attachment.type,
          content: '', // No text content for pure media messages
          mediaUrl,
        };

        await sendMessage(request);
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send media. Please try again.');
    }
  };


  // Handle message press
  const handleMessagePress = (message: Message) => {
    if (isSelectionMode) {
      toggleMessageSelection(message.id);
    }
  };

  // Handle message long press
  const handleMessageLongPress = (message: Message) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMessages([message.id]);
    } else {
      toggleMessageSelection(message.id);
    }
  };

  // Toggle message selection
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const isSelected = prev.includes(messageId);
      const updated = isSelected
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId];
      
      if (updated.length === 0) {
        setIsSelectionMode(false);
      }
      
      return updated;
    });
  };

  // Handle media press in message
  const handleMessageMediaPress = (mediaUrl: string) => {
    // TODO: Open media viewer
    console.log('View media:', mediaUrl);
  };

  // Handle reply to message
  const handleReplyToMessage = (message: Message) => {
    // TODO: Set reply context
    console.log('Reply to message:', message.id);
  };

  // Load more messages (pagination)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const offset = messages.length;
      await loadMessages(conversationId, offset);
      // Check if we got fewer messages than expected (no more messages)
      // This would be determined by the API response
      // setHasMore(response.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle back press
  const handleBackPress = () => {
    navigation.goBack();
  };

  // Handle conversation info
  const handleConversationInfo = () => {
    navigation.navigate('ConversationInfoScreen', { conversationId });
  };

  // Handle call
  const handleCall = () => {
    Alert.alert('Voice Call', 'Voice calling feature coming soon!');
  };

  // Handle video call
  const handleVideoCall = () => {
    Alert.alert('Video Call', 'Video calling feature coming soon!');
  };

  // Render message item
  const renderMessageItem = ({ item, index }: { item: MessageListItem; index: number }) => {
    if ('type' in item && item.type === 'date-separator') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.date}</Text>
        </View>
      );
    }

    const message = item as Message;
    const isOwn = message.senderId === currentUserId;
    const prevMessage = index > 0 ? messageItems[index - 1] as Message : null;
    const nextMessage = index < messageItems.length - 1 ? messageItems[index + 1] as Message : null;
    
    // Determine if we should show avatar and timestamp
    const showAvatar = !isOwn && (
      !nextMessage || 
      nextMessage.senderId !== message.senderId ||
      'type' in nextMessage
    );
    
    const showTimestamp = (
      !nextMessage ||
      nextMessage.senderId !== message.senderId ||
      'type' in nextMessage ||
      (new Date(nextMessage.timestamp).getTime() - new Date(message.timestamp).getTime()) > 5 * 60 * 1000 // 5 minutes
    );

    return (
      <MessageBubble
        message={message}
        isOwn={isOwn}
        showAvatar={showAvatar}
        showTimestamp={showTimestamp}
        isSelected={selectedMessages.includes(message.id)}
        onPress={() => handleMessagePress(message)}
        onLongPress={() => handleMessageLongPress(message)}
        onMediaPress={handleMessageMediaPress}
        onReply={handleReplyToMessage}
      />
    );
  };

  // Render loading indicator
  const renderLoadingMore = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.loadingMore}>
        <LoadingSpinner size="small" />
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LoadingSpinner size="large" />
      </View>
    );
  }

  const isOnline = conversation.type === 'DIRECT' && 
    conversation.participants.some(p => 
      p.userId !== currentUserId && state.onlineUsers.has(p.userId)
    );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Custom Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <ConversationHeader
          conversation={conversation}
          currentUserId={currentUserId}
          isOnline={isOnline}
          typingUsers={typingUsers.map(t => t.userId)}
          onBackPress={handleBackPress}
          onPress={handleConversationInfo}
          onCallPress={handleCall}
          onVideoCallPress={handleVideoCall}
          onInfoPress={handleConversationInfo}
        />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messageItems}
        renderItem={renderMessageItem}
        keyExtractor={(item) => 'type' in item ? item.id : item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderLoadingMore}
        showsVerticalScrollIndicator={false}
        inverted={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <TypingIndicator
          typingUsers={typingUsers}
          style={styles.typingIndicator}
        />
      )}

      {/* Message Input */}
      <MessageInput
        value={messageInput}
        onChangeText={handleMessageInputChange}
        onSend={handleSendMessage}
        onMediaSelected={handleMediaSelected}
        disabled={state.isLoadingMessages}
        placeholder={
          conversation.isSubscriptionRequired && !conversation.participants.some(p => p.role === 'SUBSCRIBER')
            ? 'Subscribe to send messages...'
            : 'Type a message...'
        }
        allowedMediaTypes={conversation.participants.some(p => p.permissions.canSendMedia) ? ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'] : []}
      />

      {/* Selection toolbar */}
      {isSelectionMode && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedMessages([]);
            }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.selectionCount}>
            {selectedMessages.length} selected
          </Text>
          
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => {
                // TODO: Forward messages
                console.log('Forward messages');
              }}
            >
              <Ionicons name="arrow-forward" size={20} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => {
                // TODO: Delete messages
                Alert.alert(
                  'Delete Messages',
                  `Delete ${selectedMessages.length} message(s)?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => {
                      // TODO: Implement delete messages
                      setIsSelectionMode(false);
                      setSelectedMessages([]);
                    }},
                  ]
                );
              }}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header
  headerContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  
  // Messages
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  
  // Date separator
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  
  // Typing indicator
  typingIndicator: {
    backgroundColor: colors.background,
  },
  
  // Selection toolbar
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolbarButton: {
    padding: 8,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default ChatScreen;
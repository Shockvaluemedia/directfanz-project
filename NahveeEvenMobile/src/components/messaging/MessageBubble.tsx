import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message, MessageType, MessageStatus as MessageStatusType } from '../../types/messaging';
import { useTheme } from '../../hooks/useTheme';
import MediaPreview from './MediaPreview';
import MessageStatusComponent from './MessageStatus';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onMediaPress?: (mediaUrl: string) => void;
  onReply?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = false,
  showTimestamp = false,
  isSelected = false,
  onPress,
  onLongPress,
  onMediaPress,
  onReply,
}) => {
  const { theme, colors } = useTheme();
  const styles = createStyles(colors, theme);

  const renderMessageContent = () => {
    switch (message.type) {
      case 'TEXT':
        return (
          <Text style={[
            styles.messageText,
            isOwn ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
        );

      case 'IMAGE':
      case 'VIDEO':
      case 'AUDIO':
      case 'FILE':
        return (
          <View>
            <MediaPreview
              mediaUrl={message.mediaUrl!}
              mediaType={message.type}
              mediaThumbnail={message.mediaThumbnail}
              metadata={message.mediaMetadata}
              onPress={() => onMediaPress?.(message.mediaUrl!)}
            />
            {message.content && (
              <Text style={[
                styles.messageText,
                styles.mediaCaption,
                isOwn ? styles.ownMessageText : styles.otherMessageText
              ]}>
                {message.content}
              </Text>
            )}
          </View>
        );

      case 'SYSTEM':
        return (
          <Text style={styles.systemMessageText}>
            {message.content}
          </Text>
        );

      default:
        return (
          <Text style={[
            styles.messageText,
            isOwn ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
        );
    }
  };

  const renderReplyPreview = () => {
    if (!message.replyToMessage) return null;

    return (
      <View style={[
        styles.replyPreview,
        isOwn ? styles.ownReplyPreview : styles.otherReplyPreview
      ]}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replyAuthor}>
            {message.replyToMessage.senderInfo.name}
          </Text>
          <Text 
            style={styles.replyText} 
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {message.replyToMessage.type === 'TEXT' 
              ? message.replyToMessage.content 
              : `📎 ${message.replyToMessage.type.toLowerCase()}`
            }
          </Text>
        </View>
      </View>
    );
  };

  if (message.type === 'SYSTEM') {
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessageBubble}>
          {renderMessageContent()}
          {showTimestamp && (
            <Text style={styles.systemTimestamp}>
              {formatMessageTime(message.timestamp)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.messageContainer,
      isOwn ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      {/* Avatar for other users */}
      {!isOwn && showAvatar && (
        <TouchableOpacity style={styles.avatarContainer}>
          {message.senderInfo.avatar ? (
            <Image 
              source={{ uri: message.senderInfo.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.avatarInitial}>
                {message.senderInfo.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {message.senderInfo.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Message bubble */}
      <Pressable
        style={[
          styles.messageBubble,
          isOwn ? styles.ownMessageBubble : styles.otherMessageBubble,
          isSelected && styles.selectedMessage
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={200}
      >
        {/* Sender name for group chats */}
        {!isOwn && !showAvatar && message.senderInfo.name && (
          <Text style={styles.senderName}>
            {message.senderInfo.name}
            {message.senderInfo.verified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            )}
          </Text>
        )}

        {/* Reply preview */}
        {renderReplyPreview()}

        {/* Message content */}
        {renderMessageContent()}

        {/* Edited indicator */}
        {message.isEdited && (
          <Text style={styles.editedIndicator}>edited</Text>
        )}

        {/* Message metadata */}
        <View style={[
          styles.messageFooter,
          isOwn ? styles.ownMessageFooter : styles.otherMessageFooter
        ]}>
          {showTimestamp && (
            <Text style={[
              styles.timestamp,
              isOwn ? styles.ownTimestamp : styles.otherTimestamp
            ]}>
              {formatMessageTime(message.timestamp)}
            </Text>
          )}
          
          {isOwn && (
            <MessageStatusComponent status={message.status} />
          )}
        </View>

        {/* Reply button */}
        {onReply && !isOwn && (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(message)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-undo" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </Pressable>

      {/* Selection indicator */}
      {isSelected && (
        <View style={styles.selectionIndicator}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: any, theme: any) => StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  
  // Avatar styles
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 4,
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  placeholderAvatar: {
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 1,
  },
  
  // Message bubble styles
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    marginLeft: 'auto',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: colors.surfaceVariant,
    marginRight: 'auto',
    borderBottomLeftRadius: 4,
  },
  selectedMessage: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  
  // Message content styles
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.onPrimary,
  },
  otherMessageText: {
    color: colors.text,
  },
  mediaCaption: {
    marginTop: 8,
    fontSize: 14,
  },
  editedIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 2,
  },
  
  // Reply preview styles
  replyPreview: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    opacity: 0.8,
  },
  ownReplyPreview: {
    borderLeftColor: colors.onPrimary,
  },
  otherReplyPreview: {
    borderLeftColor: colors.primary,
  },
  replyLine: {
    width: 3,
    backgroundColor: 'currentColor',
    borderRadius: 1,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
  },
  
  // Footer styles
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  ownMessageFooter: {
    justifyContent: 'flex-end',
  },
  otherMessageFooter: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  ownTimestamp: {
    color: colors.onPrimary,
    opacity: 0.7,
  },
  otherTimestamp: {
    color: colors.textSecondary,
  },
  
  // System message styles
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemMessageBubble: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '80%',
  },
  systemMessageText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  systemTimestamp: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  
  // Action buttons
  replyButton: {
    position: 'absolute',
    top: -20,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Selection indicator
  selectionIndicator: {
    position: 'absolute',
    top: 4,
    right: -24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default memo(MessageBubble);
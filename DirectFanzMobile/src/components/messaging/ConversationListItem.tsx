import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../../types/messaging';
import { useTheme } from '../../hooks/useTheme';
import { formatMessageTime, formatLastSeen } from '../../utils/dateUtils';
import OnlineStatus from './OnlineStatus';

interface ConversationListItemProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: (conversation: Conversation) => void;
  onLongPress?: (conversation: Conversation) => void;
  isOnline?: boolean;
  typingUsers?: string[];
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  currentUserId,
  onPress,
  onLongPress,
  isOnline = false,
  typingUsers = [],
}) => {
  const { theme, colors } = useTheme();
  const styles = createStyles(colors, theme);

  // Get the other participant(s) for display
  const getDisplayInfo = () => {
    if (conversation.type === 'DIRECT') {
      const otherParticipant = conversation.participants.find(
        p => p.userId !== currentUserId
      );
      
      if (otherParticipant) {
        return {
          title: otherParticipant.userName,
          avatar: otherParticipant.userAvatar,
          subtitle: getLastMessagePreview(),
          isVerified: otherParticipant.role === 'CREATOR',
          role: otherParticipant.role,
        };
      }
    }
    
    return {
      title: conversation.title || 'Group Chat',
      avatar: conversation.avatar,
      subtitle: getLastMessagePreview(),
      isVerified: false,
      role: null,
    };
  };

  const getLastMessagePreview = () => {
    if (typingUsers.length > 0) {
      const typingNames = typingUsers.map(userId => {
        const user = conversation.participants.find(p => p.userId === userId);
        return user?.userName || 'Someone';
      });
      
      if (typingNames.length === 1) {
        return `${typingNames[0]} is typing...`;
      } else {
        return 'Multiple people are typing...';
      }
    }

    if (!conversation.lastMessage) {
      return 'Start a conversation';
    }

    const message = conversation.lastMessage;
    const senderName = message.senderId === currentUserId 
      ? 'You' 
      : message.senderInfo.name;

    switch (message.type) {
      case 'TEXT':
        const content = message.content.length > 50 
          ? message.content.substring(0, 50) + '...'
          : message.content;
        return conversation.type === 'DIRECT' 
          ? content 
          : `${senderName}: ${content}`;
      
      case 'IMAGE':
        const imageText = '📷 Photo';
        return conversation.type === 'DIRECT' 
          ? imageText 
          : `${senderName}: ${imageText}`;
      
      case 'VIDEO':
        const videoText = '🎥 Video';
        return conversation.type === 'DIRECT' 
          ? videoText 
          : `${senderName}: ${videoText}`;
      
      case 'AUDIO':
        const audioText = '🎵 Audio';
        return conversation.type === 'DIRECT' 
          ? audioText 
          : `${senderName}: ${audioText}`;
      
      case 'FILE':
        const fileText = '📎 File';
        return conversation.type === 'DIRECT' 
          ? fileText 
          : `${senderName}: ${fileText}`;
      
      case 'SYSTEM':
        return message.content;
      
      default:
        return 'New message';
    }
  };

  const displayInfo = getDisplayInfo();
  const hasUnread = (conversation.unreadCount || 0) > 0;
  const isTyping = typingUsers.length > 0;

  return (
    <TouchableOpacity
      style={[styles.container, hasUnread && styles.unreadContainer]}
      onPress={() => onPress(conversation)}
      onLongPress={() => onLongPress?.(conversation)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {displayInfo.avatar ? (
          <Image source={{ uri: displayInfo.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Text style={styles.avatarInitial}>
              {displayInfo.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        {/* Online status indicator */}
        {conversation.type === 'DIRECT' && (
          <OnlineStatus 
            isOnline={isOnline}
            style={styles.onlineIndicator}
          />
        )}

        {/* Creator/Artist badge */}
        {displayInfo.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text 
              style={[
                styles.title,
                hasUnread && styles.unreadTitle,
              ]} 
              numberOfLines={1}
            >
              {displayInfo.title}
            </Text>
            
            {displayInfo.isVerified && (
              <Ionicons 
                name="checkmark-circle" 
                size={16} 
                color={colors.primary} 
                style={styles.verifiedIcon}
              />
            )}

            {/* Subscription indicator */}
            {conversation.isSubscriptionRequired && (
              <Ionicons 
                name="diamond" 
                size={14} 
                color={colors.warning} 
                style={styles.subscriptionIcon}
              />
            )}
          </View>

          <View style={styles.rightSection}>
            {conversation.lastMessage && !isTyping && (
              <Text style={styles.timestamp}>
                {formatMessageTime(conversation.lastMessage.timestamp)}
              </Text>
            )}
            
            {/* Message status for own messages */}
            {conversation.lastMessage?.senderId === currentUserId && !isTyping && (
              <View style={styles.messageStatus}>
                {conversation.lastMessage.status === 'READ' && (
                  <Ionicons name="checkmark-done" size={14} color={colors.primary} />
                )}
                {conversation.lastMessage.status === 'DELIVERED' && (
                  <Ionicons name="checkmark-done" size={14} color={colors.textSecondary} />
                )}
                {conversation.lastMessage.status === 'SENT' && (
                  <Ionicons name="checkmark" size={14} color={colors.textSecondary} />
                )}
                {conversation.lastMessage.status === 'SENDING' && (
                  <Ionicons name="time" size={14} color={colors.textSecondary} />
                )}
                {conversation.lastMessage.status === 'FAILED' && (
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text 
            style={[
              styles.subtitle,
              hasUnread && styles.unreadSubtitle,
              isTyping && styles.typingText,
            ]} 
            numberOfLines={1}
          >
            {displayInfo.subtitle}
          </Text>

          {/* Right indicators */}
          <View style={styles.indicators}>
            {/* Mute indicator */}
            {conversation.isMuted && (
              <Ionicons 
                name="volume-mute" 
                size={14} 
                color={colors.textSecondary} 
                style={styles.muteIcon}
              />
            )}

            {/* Pin indicator */}
            {conversation.isPinned && (
              <Ionicons 
                name="pin" 
                size={14} 
                color={colors.textSecondary} 
                style={styles.pinIcon}
              />
            )}

            {/* Unread count badge */}
            {hasUnread && !conversation.isMuted && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {conversation.unreadCount! > 99 ? '99+' : conversation.unreadCount}
                </Text>
              </View>
            )}

            {/* Muted unread indicator */}
            {hasUnread && conversation.isMuted && (
              <View style={styles.mutedUnreadIndicator} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any, theme: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unreadContainer: {
    backgroundColor: colors.surface,
  },
  
  // Avatar section
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderAvatar: {
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 1,
  },
  
  // Content section
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 4,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  verifiedIcon: {
    marginLeft: 2,
  },
  subscriptionIcon: {
    marginLeft: 4,
  },
  
  // Right section
  rightSection: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  messageStatus: {
    alignItems: 'center',
  },
  
  // Footer section
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  unreadSubtitle: {
    color: colors.text,
    fontWeight: '500',
  },
  typingText: {
    color: colors.primary,
    fontStyle: 'italic',
  },
  
  // Indicators section
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muteIcon: {
    marginRight: 4,
  },
  pinIcon: {
    marginRight: 4,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  mutedUnreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
});

export default memo(ConversationListItem);
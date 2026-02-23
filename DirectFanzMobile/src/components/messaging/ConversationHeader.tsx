import React from 'react';
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
import OnlineStatus from './OnlineStatus';

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUserId: string;
  isOnline?: boolean;
  typingUsers?: string[];
  onPress?: () => void;
  onBackPress?: () => void;
  onCallPress?: () => void;
  onVideoCallPress?: () => void;
  onInfoPress?: () => void;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  currentUserId,
  isOnline = false,
  typingUsers = [],
  onPress,
  onBackPress,
  onCallPress,
  onVideoCallPress,
  onInfoPress,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getDisplayInfo = () => {
    if (conversation.type === 'DIRECT') {
      const otherParticipant = conversation.participants.find(
        p => p.userId !== currentUserId
      );
      
      if (otherParticipant) {
        return {
          title: otherParticipant.userName,
          avatar: otherParticipant.userAvatar,
          subtitle: getSubtitle(),
          isVerified: otherParticipant.role === 'CREATOR',
        };
      }
    }
    
    return {
      title: conversation.title || 'Group Chat',
      avatar: conversation.avatar,
      subtitle: getSubtitle(),
      isVerified: false,
    };
  };

  const getSubtitle = () => {
    if (typingUsers.length > 0) {
      if (typingUsers.length === 1) {
        const user = conversation.participants.find(p => p.userId === typingUsers[0]);
        return `${user?.userName || 'Someone'} is typing...`;
      }
      return 'Multiple people are typing...';
    }

    if (conversation.type === 'DIRECT') {
      return isOnline ? 'Online' : 'Offline';
    } else {
      return `${conversation.participants.length} members`;
    }
  };

  const displayInfo = getDisplayInfo();
  const isTyping = typingUsers.length > 0;

  return (
    <View style={styles.container}>
      {/* Back button */}
      {onBackPress && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      )}

      {/* Avatar and info */}
      <TouchableOpacity 
        style={styles.infoSection}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {displayInfo.avatar ? (
            <Image 
              source={{ uri: displayInfo.avatar }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.avatarInitial}>
                {displayInfo.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* Online status */}
          {conversation.type === 'DIRECT' && (
            <OnlineStatus 
              isOnline={isOnline}
              style={styles.onlineIndicator}
            />
          )}
        </View>

        <View style={styles.textInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
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
            {conversation.isSubscriptionRequired && (
              <Ionicons 
                name="diamond" 
                size={14} 
                color={colors.warning} 
                style={styles.subscriptionIcon}
              />
            )}
          </View>
          <Text 
            style={[
              styles.subtitle,
              isTyping && styles.typingText,
            ]} 
            numberOfLines={1}
          >
            {displayInfo.subtitle}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actions}>
        {onCallPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCallPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="call" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        {onVideoCallPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onVideoCallPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="videocam" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        {onInfoPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onInfoPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="information-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 60,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  infoSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  placeholderAvatar: {
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
  textInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 4,
  },
  verifiedIcon: {
    marginLeft: 2,
  },
  subscriptionIcon: {
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  typingText: {
    color: colors.primary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
});

export default ConversationHeader;
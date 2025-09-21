import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { ContentItem as ContentItemType, CONTENT_TYPE_LABELS, VISIBILITY_LABELS } from '../../types/discovery';
import Avatar from '../profile/Avatar';

interface ContentItemProps {
  content: ContentItemType;
  onPress?: () => void;
  onCreatorPress?: () => void;
  style?: 'card' | 'list' | 'feed';
  showCreator?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40; // Full width with padding

const ContentItem: React.FC<ContentItemProps> = ({
  content,
  onPress,
  onCreatorPress,
  style = 'feed',
  showCreator = true,
}) => {
  const { theme } = useTheme();
  const { interactWithContent, isContentLiked, isContentBookmarked } = useDiscovery();
  
  const isLiked = isContentLiked(content.id);
  const isBookmarked = isContentBookmarked(content.id);

  const handleLikeToggle = async () => {
    try {
      await interactWithContent({
        contentId: content.id,
        type: isLiked ? 'unlike' : 'like',
      });
    } catch (error) {
      console.error('Like toggle error:', error);
    }
  };

  const handleBookmarkToggle = async () => {
    try {
      await interactWithContent({
        contentId: content.id,
        type: isBookmarked ? 'unbookmark' : 'bookmark',
      });
    } catch (error) {
      console.error('Bookmark toggle error:', error);
    }
  };

  const handleShare = async () => {
    try {
      await interactWithContent({
        contentId: content.id,
        type: 'share',
      });
      // TODO: Implement actual sharing functionality
      console.log('Share content:', content.id);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getContentTypeIcon = (): string => {
    switch (content.type) {
      case 'AUDIO': return '🎵';
      case 'VIDEO': return '🎥';
      case 'IMAGE': return '📸';
      case 'TEXT': return '📝';
      case 'LIVE': return '🔴';
      default: return '📄';
    }
  };

  const getVisibilityColor = (): string => {
    switch (content.visibility) {
      case 'PUBLIC': return theme.colors.success;
      case 'SUBSCRIBERS_ONLY': return theme.colors.warning;
      case 'PREMIUM': return theme.colors.primary;
      default: return theme.colors.textSecondary;
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    
    listContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    
    cardContainer: {
      width: CARD_WIDTH * 0.7,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginRight: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    
    // Header with creator info
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      paddingBottom: 12,
    },
    
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    
    creatorDetails: {
      marginLeft: 12,
      flex: 1,
    },
    
    creatorName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    
    creatorHandle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    timestampAndType: {
      alignItems: 'flex-end',
    },
    
    timestamp: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    
    contentTypeLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    
    typeIcon: {
      fontSize: 12,
      marginRight: 4,
    },
    
    typeText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    
    // Media content
    mediaContainer: {
      position: 'relative',
    },
    
    thumbnail: {
      width: '100%',
      aspectRatio: content.type === 'IMAGE' ? 1 : 16/9,
      backgroundColor: theme.colors.border,
    },
    
    mediaOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    
    playButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    playIcon: {
      fontSize: 24,
      marginLeft: 4,
    },
    
    duration: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    
    durationText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '500',
    },
    
    visibilityBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    
    visibilityText: {
      fontSize: 10,
      fontWeight: '500',
    },
    
    premiumOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    premiumIcon: {
      fontSize: 36,
      marginBottom: 8,
    },
    
    premiumText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    
    premiumPrice: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 4,
    },
    
    // Content info
    contentInfo: {
      padding: 16,
    },
    
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    
    // Tags and genres
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    
    tag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
      marginBottom: 4,
    },
    
    tagText: {
      fontSize: 10,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    
    // Actions bar
    actionsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    
    actionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 20,
      padding: 8,
    },
    
    actionIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    
    actionText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    
    likedIcon: {
      color: theme.colors.error,
    },
    
    bookmarkedIcon: {
      color: theme.colors.primary,
    },
    
    rightActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

  const renderMediaContent = () => {
    if (!content.thumbnailUrl && content.type !== 'TEXT') {
      return null;
    }

    const showPremiumOverlay = content.visibility === 'PREMIUM' && !content.isPurchased;
    const showPlayButton = content.type === 'AUDIO' || content.type === 'VIDEO';

    return (
      <TouchableOpacity style={styles.mediaContainer} onPress={onPress}>
        {content.thumbnailUrl && (
          <FastImage
            source={{ uri: content.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode={FastImage.resizeMode.cover}
          />
        )}
        
        {content.visibility !== 'PUBLIC' && (
          <View style={styles.visibilityBadge}>
            <Text style={[styles.visibilityText, { color: getVisibilityColor() }]}>
              {VISIBILITY_LABELS[content.visibility]}
            </Text>
          </View>
        )}
        
        {showPlayButton && !showPremiumOverlay && (
          <View style={styles.mediaOverlay}>
            <TouchableOpacity style={styles.playButton} onPress={onPress}>
              <Text style={styles.playIcon}>▶️</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {content.duration && (
          <View style={styles.duration}>
            <Text style={styles.durationText}>
              {formatDuration(content.duration)}
            </Text>
          </View>
        )}
        
        {showPremiumOverlay && (
          <View style={styles.premiumOverlay}>
            <Text style={styles.premiumIcon}>🔒</Text>
            <Text style={styles.premiumText}>Premium Content</Text>
            {content.price && (
              <Text style={styles.premiumPrice}>
                ${content.price}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (!showCreator) return null;

    const timeAgo = new Date(content.createdAt).toLocaleDateString();

    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.creatorInfo} onPress={onCreatorPress}>
          <Avatar
            uri={content.creator.avatar}
            name={content.creator.name}
            size="small"
          />
          <View style={styles.creatorDetails}>
            <Text style={styles.creatorName}>{content.creator.name}</Text>
            <Text style={styles.creatorHandle}>
              @{content.creator.artistName || content.creator.name.toLowerCase().replace(' ', '')}
            </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.timestampAndType}>
          <Text style={styles.timestamp}>{timeAgo}</Text>
          <View style={styles.contentTypeLabel}>
            <Text style={styles.typeIcon}>{getContentTypeIcon()}</Text>
            <Text style={styles.typeText}>
              {CONTENT_TYPE_LABELS[content.type]}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    return (
      <TouchableOpacity style={styles.contentInfo} onPress={onPress}>
        <Text style={styles.title}>{content.title}</Text>
        {content.description && (
          <Text style={styles.description} numberOfLines={3}>
            {content.description}
          </Text>
        )}
        
        {content.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {content.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderActions = () => {
    return (
      <View style={styles.actionsBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
            <Text style={[styles.actionIcon, isLiked && styles.likedIcon]}>
              {isLiked ? '❤️' : '🤍'}
            </Text>
            <Text style={styles.actionText}>
              {formatNumber(content.likeCount + (isLiked ? 1 : 0))}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>
              {formatNumber(content.commentCount)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>
              {formatNumber(content.shareCount)}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleBookmarkToggle}>
            <Text style={[styles.actionIcon, isBookmarked && styles.bookmarkedIcon]}>
              {isBookmarked ? '🔖' : '🏷️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const containerStyle = style === 'list' ? styles.listContainer : 
                       style === 'card' ? styles.cardContainer : 
                       styles.container;

  return (
    <View style={containerStyle}>
      {renderHeader()}
      {renderMediaContent()}
      {renderContent()}
      {renderActions()}
    </View>
  );
};

export default ContentItem;
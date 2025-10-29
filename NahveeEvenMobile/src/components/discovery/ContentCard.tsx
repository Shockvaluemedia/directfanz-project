import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { ContentItem } from '../../types/discovery';

const { width: screenWidth } = Dimensions.get('window');

export type ContentCardLayout = 'horizontal' | 'vertical' | 'grid' | 'list';
export type ContentCardSize = 'small' | 'medium' | 'large';

interface ContentCardProps {
  content: ContentItem;
  layout?: ContentCardLayout;
  size?: ContentCardSize;
  showActions?: boolean;
  showCreator?: boolean;
  showStats?: boolean;
  showPricing?: boolean;
  onPress?: (content: ContentItem) => void;
  onCreatorPress?: (creatorId: string) => void;
  onPlayPress?: (content: ContentItem) => void;
  style?: any;
}

const ContentCard: React.FC<ContentCardProps> = memo(({
  content,
  layout = 'vertical',
  size = 'medium',
  showActions = true,
  showCreator = true,
  showStats = true,
  showPricing = true,
  onPress,
  onCreatorPress,
  onPlayPress,
  style,
}) => {
  const { theme } = useTheme();
  const {
    isContentLiked,
    isContentBookmarked,
    isCreatorFollowed,
    followCreator,
    unfollowCreator,
    interactWithContent,
  } = useDiscovery();

  // Card dimensions based on layout and size
  const getDimensions = useCallback(() => {
    const baseWidth = screenWidth - 40; // Default margins
    
    switch (layout) {
      case 'horizontal':
        return {
          width: size === 'small' ? 120 : size === 'medium' ? 160 : 200,
          height: size === 'small' ? 120 : size === 'medium' ? 160 : 200,
          imageHeight: size === 'small' ? 80 : size === 'medium' ? 100 : 120,
        };
      case 'grid':
        return {
          width: (screenWidth - 60) / 2, // 2 columns with margins
          height: size === 'small' ? 180 : size === 'medium' ? 220 : 260,
          imageHeight: size === 'small' ? 100 : size === 'medium' ? 120 : 140,
        };
      case 'list':
        return {
          width: baseWidth,
          height: size === 'small' ? 100 : size === 'medium' ? 120 : 140,
          imageHeight: size === 'small' ? 100 : size === 'medium' ? 120 : 140,
        };
      case 'vertical':
      default:
        return {
          width: baseWidth,
          height: 'auto' as any,
          imageHeight: size === 'small' ? 140 : size === 'medium' ? 180 : 220,
        };
    }
  }, [layout, size]);

  const dimensions = getDimensions();
  const isHorizontalLayout = layout === 'horizontal' || layout === 'list';
  const isCompactLayout = layout === 'grid' || size === 'small';

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      width: dimensions.width,
      height: dimensions.height,
    },
    horizontalContainer: {
      flexDirection: 'row',
    },
    imageContainer: {
      position: 'relative',
    },
    image: {
      width: isHorizontalLayout ? dimensions.imageHeight : '100%',
      height: dimensions.imageHeight,
      backgroundColor: theme.colors.border,
    },
    overlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      gap: 4,
    },
    badge: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
    },
    badgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: '600',
    },
    liveBadge: {
      backgroundColor: theme.colors.error,
    },
    trendingBadge: {
      backgroundColor: theme.colors.warning,
    },
    contentInfo: {
      padding: isCompactLayout ? 8 : 12,
      flex: isHorizontalLayout ? 1 : undefined,
    },
    title: {
      fontSize: isCompactLayout ? 14 : 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      lineHeight: isCompactLayout ? 18 : 20,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      lineHeight: 18,
    },
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isCompactLayout ? 6 : 8,
    },
    creatorAvatar: {
      width: isCompactLayout ? 20 : 24,
      height: isCompactLayout ? 20 : 24,
      borderRadius: isCompactLayout ? 10 : 12,
      backgroundColor: theme.colors.border,
      marginRight: 6,
    },
    creatorName: {
      fontSize: isCompactLayout ? 11 : 12,
      color: theme.colors.text,
      fontWeight: '500',
      flex: 1,
    },
    verifiedIcon: {
      fontSize: isCompactLayout ? 10 : 12,
      color: theme.colors.primary,
      marginLeft: 4,
    },
    followButton: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary,
    },
    followButtonFollowing: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    followButtonText: {
      fontSize: 9,
      color: 'white',
      fontWeight: '600',
    },
    followButtonTextFollowing: {
      color: theme.colors.primary,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isCompactLayout ? 6 : 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: isCompactLayout ? 12 : 16,
    },
    statIcon: {
      marginRight: 3,
      fontSize: isCompactLayout ? 10 : 12,
    },
    statText: {
      fontSize: isCompactLayout ? 10 : 11,
      color: theme.colors.textSecondary,
    },
    pricingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isCompactLayout ? 6 : 8,
    },
    priceTag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
      marginRight: 6,
    },
    priceText: {
      fontSize: isCompactLayout ? 10 : 11,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    freeTag: {
      backgroundColor: theme.colors.success + '20',
    },
    freeText: {
      color: theme.colors.success,
    },
    originalPrice: {
      fontSize: isCompactLayout ? 9 : 10,
      color: theme.colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: isCompactLayout ? 8 : 12,
    },
    actionButton: {
      padding: isCompactLayout ? 4 : 6,
      borderRadius: theme.borderRadius.small,
      backgroundColor: 'transparent',
    },
    actionButtonActive: {
      backgroundColor: theme.colors.primary + '20',
    },
    playButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: isCompactLayout ? 12 : 16,
      paddingVertical: isCompactLayout ? 6 : 8,
      borderRadius: theme.borderRadius.medium,
    },
    playButtonText: {
      color: 'white',
      fontSize: isCompactLayout ? 11 : 12,
      fontWeight: '600',
    },
  });

  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }, []);

  const formatDuration = useCallback((seconds?: number): string => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const handlePress = useCallback(() => {
    onPress?.(content);
  }, [onPress, content]);

  const handleCreatorPress = useCallback(() => {
    onCreatorPress?.(content.creator.id);
  }, [onCreatorPress, content.creator.id]);

  const handlePlayPress = useCallback(() => {
    onPlayPress?.(content);
  }, [onPlayPress, content]);

  const handleFollowToggle = useCallback(async () => {
    try {
      const isFollowing = isCreatorFollowed(content.creator.id);
      if (isFollowing) {
        await unfollowCreator(content.creator.id);
      } else {
        await followCreator(content.creator.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  }, [content.creator.id, isCreatorFollowed, followCreator, unfollowCreator]);

  const handleLikeToggle = useCallback(async () => {
    try {
      const isLiked = isContentLiked(content.id);
      await interactWithContent({
        contentId: content.id,
        type: isLiked ? 'unlike' : 'like',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  }, [content.id, isContentLiked, interactWithContent]);

  const handleBookmarkToggle = useCallback(async () => {
    try {
      const isBookmarked = isContentBookmarked(content.id);
      await interactWithContent({
        contentId: content.id,
        type: isBookmarked ? 'unbookmark' : 'bookmark',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update bookmark status. Please try again.');
    }
  }, [content.id, isContentBookmarked, interactWithContent]);

  const handleSharePress = useCallback(() => {
    // Implement share functionality
    Alert.alert('Share', `Share "${content.title}"`);
  }, [content.title]);

  const isLiked = isContentLiked(content.id);
  const isBookmarked = isContentBookmarked(content.id);
  const isFollowing = isCreatorFollowed(content.creator.id);

  return (
    <TouchableOpacity 
      style={[styles.container, isHorizontalLayout && styles.horizontalContainer, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Image/Thumbnail */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: content.thumbnailUrl || 'https://via.placeholder.com/300x200' }}
          style={styles.image}
          resizeMode="cover"
        />
        
        {/* Overlay Badges */}
        <View style={styles.overlay}>
          {content.isLive && (
            <View style={[styles.badge, styles.liveBadge]}>
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          )}
          {content.metadata.duration && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{formatDuration(content.metadata.duration)}</Text>
            </View>
          )}
          {content.trending && (
            <View style={[styles.badge, styles.trendingBadge]}>
              <Text style={styles.badgeText}>🔥</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Info */}
      <View style={styles.contentInfo}>
        <Text
          style={styles.title}
          numberOfLines={isCompactLayout ? 2 : 2}
        >
          {content.title}
        </Text>

        {!isCompactLayout && content.description && (
          <Text style={styles.description} numberOfLines={2}>
            {content.description}
          </Text>
        )}

        {/* Creator Info */}
        {showCreator && (
          <View style={styles.creatorInfo}>
            <TouchableOpacity onPress={handleCreatorPress}>
              <Image
                source={{ uri: content.creator.avatar || 'https://via.placeholder.com/40' }}
                style={styles.creatorAvatar}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreatorPress} style={{ flex: 1 }}>
              <Text style={styles.creatorName} numberOfLines={1}>
                {content.creator.name}
              </Text>
            </TouchableOpacity>
            {content.creator.verified && (
              <Text style={styles.verifiedIcon}>✓</Text>
            )}
            {!isCompactLayout && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonFollowing]}
                onPress={handleFollowToggle}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextFollowing]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content Stats */}
        {showStats && !isCompactLayout && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statIcon, { color: theme.colors.textSecondary }]}>👁</Text>
              <Text style={styles.statText}>{formatNumber(content.stats.views)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statIcon, { color: theme.colors.error }]}>❤️</Text>
              <Text style={styles.statText}>{formatNumber(content.stats.likes)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statIcon, { color: theme.colors.warning }]}>⭐</Text>
              <Text style={styles.statText}>{content.stats.rating.average.toFixed(1)}</Text>
            </View>
          </View>
        )}

        {/* Pricing */}
        {showPricing && !isCompactLayout && (
          <View style={styles.pricingContainer}>
            <View style={[styles.priceTag, content.pricing.type === 'free' && styles.freeTag]}>
              <Text style={[styles.priceText, content.pricing.type === 'free' && styles.freeText]}>
                {content.pricing.type === 'free' 
                  ? 'FREE' 
                  : `$${content.pricing.amount?.toFixed(2)}`
                }
              </Text>
            </View>
            {content.pricing.originalPrice && content.pricing.originalPrice > (content.pricing.amount || 0) && (
              <Text style={styles.originalPrice}>
                ${content.pricing.originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {showActions && !isCompactLayout && (
          <View style={styles.actionsContainer}>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, isLiked && styles.actionButtonActive]}
                onPress={handleLikeToggle}
              >
                <Text style={{ color: isLiked ? theme.colors.primary : theme.colors.textSecondary }}>
                  {isLiked ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, isBookmarked && styles.actionButtonActive]}
                onPress={handleBookmarkToggle}
              >
                <Text style={{ color: isBookmarked ? theme.colors.primary : theme.colors.textSecondary }}>
                  {isBookmarked ? '🔖' : '📑'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleSharePress}
              >
                <Text style={{ color: theme.colors.textSecondary }}>↗️</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPress || handlePress}
            >
              <Text style={styles.playButtonText}>
                {content.type === 'AUDIO' ? '🎵 Play' : '▶️ Watch'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

ContentCard.displayName = 'ContentCard';

export default ContentCard;
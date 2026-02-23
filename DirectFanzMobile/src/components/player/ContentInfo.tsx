import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ContentItem } from '../../types/discovery';

interface ContentInfoProps {
  content: ContentItem;
  onLike: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onCreatorPress: (creatorId: string) => void;
}

const ContentInfo: React.FC<ContentInfoProps> = ({
  content,
  onLike,
  onBookmark,
  onShare,
  onCreatorPress,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      padding: 20,
    },
    
    // Content Header
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
      lineHeight: 28,
    },
    metadata: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    metadataText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginRight: 16,
    },
    
    // Creator Section
    creatorSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    creatorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.background,
      marginRight: 12,
    },
    creatorInfo: {
      flex: 1,
    },
    creatorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    creatorStats: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    followButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.medium,
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
    },
    
    // Actions
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 24,
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    action: {
      alignItems: 'center',
      flex: 1,
    },
    actionIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionCount: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    // Description
    descriptionSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    showMoreButton: {
      alignSelf: 'flex-start',
    },
    showMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    
    // Tags
    tagsSection: {
      marginBottom: 20,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      backgroundColor: theme.colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.medium,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.primary,
    },
    
    // Details
    detailsSection: {},
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
  });

  const formatNumber = (num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Content Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{content.title}</Text>
        
        <View style={styles.metadata}>
          <Text style={styles.metadataText}>
            {formatNumber(content.viewsCount)} views
          </Text>
          <Text style={styles.metadataText}>•</Text>
          <Text style={styles.metadataText}>
            {formatDate(content.createdAt)}
          </Text>
        </View>
      </View>

      {/* Creator Section */}
      <TouchableOpacity 
        style={styles.creatorSection}
        onPress={() => onCreatorPress(content.creator.id)}
      >
        <Image
          source={{ uri: content.creator.avatarUrl }}
          style={styles.creatorAvatar}
        />
        
        <View style={styles.creatorInfo}>
          <Text style={styles.creatorName}>
            {content.creator.displayName}
          </Text>
          <Text style={styles.creatorStats}>
            {formatNumber(content.creator.followersCount)} followers
          </Text>
        </View>
        
        <TouchableOpacity style={styles.followButton}>
          <Text style={styles.followButtonText}>
            {content.creator.isFollowed ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={onLike}>
          <Text style={[
            styles.actionIcon,
            { color: content.isLiked ? '#FF6B6B' : theme.colors.textSecondary }
          ]}>
            {content.isLiked ? '❤️' : '🤍'}
          </Text>
          <Text style={styles.actionText}>Like</Text>
          <Text style={styles.actionCount}>
            {formatNumber(content.likesCount)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.action} onPress={onBookmark}>
          <Text style={[
            styles.actionIcon,
            { color: content.isBookmarked ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            {content.isBookmarked ? '🔖' : '🏷️'}
          </Text>
          <Text style={styles.actionText}>Save</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.action} onPress={onShare}>
          <Text style={[styles.actionIcon, { color: theme.colors.textSecondary }]}>
            📤
          </Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.action}>
          <Text style={[styles.actionIcon, { color: theme.colors.textSecondary }]}>
            💬
          </Text>
          <Text style={styles.actionText}>Comment</Text>
          <Text style={styles.actionCount}>
            {formatNumber(content.commentsCount || 0)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      {content.description && (
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            {content.description}
          </Text>
          {content.description.length > 150 && (
            <TouchableOpacity style={styles.showMoreButton}>
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tags */}
      {content.tags && content.tags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tags}>
            {content.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Details */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>
            {formatDuration(content.duration)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category</Text>
          <Text style={styles.detailValue}>
            {content.category.name}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>
            {content.type === 'VIDEO' ? 'Video' : 'Audio'}
          </Text>
        </View>
        
        {content.price && content.price > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>
              ${content.price.toFixed(2)}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Published</Text>
          <Text style={styles.detailValue}>
            {formatDate(content.createdAt)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default ContentInfo;
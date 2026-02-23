import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ContentItem } from '../../types/discovery';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

interface RelatedContentProps {
  content: ContentItem[];
  onContentPress: (content: ContentItem) => void;
  onCreatorPress: (creatorId: string) => void;
  loading?: boolean;
}

const RelatedContent: React.FC<RelatedContentProps> = ({
  content,
  onContentPress,
  onCreatorPress,
  loading = false,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
    },
    
    // Header
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    
    // Content List
    contentList: {
      flex: 1,
    },
    contentItem: {
      flexDirection: 'row',
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contentThumbnail: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.background,
      marginRight: 12,
      position: 'relative',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
      borderRadius: theme.borderRadius.small,
    },
    thumbnailOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: theme.borderRadius.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playIcon: {
      fontSize: 24,
      color: 'white',
    },
    durationBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
    },
    durationText: {
      fontSize: 10,
      color: 'white',
      fontWeight: '600',
    },
    contentInfo: {
      flex: 1,
      justifyContent: 'space-between',
    },
    contentTop: {
      flex: 1,
    },
    contentTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      lineHeight: 18,
    },
    contentDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
      marginBottom: 8,
    },
    contentBottom: {
      gap: 4,
    },
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    creatorAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      marginRight: 6,
    },
    creatorName: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.text,
      flex: 1,
    },
    contentStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    statIcon: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    
    // Content Type Badge
    typeBadge: {
      position: 'absolute',
      top: 4,
      left: 4,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
    },
    typeBadgeText: {
      fontSize: 8,
      color: 'white',
      fontWeight: '700',
    },
    
    // Premium Content
    premiumBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: '#FFD700',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
    },
    premiumIcon: {
      fontSize: 8,
      color: '#000',
    },
    
    // More Button
    moreButton: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 8,
    },
    moreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    
    // Loading State
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    
    // Categories
    categoriesSection: {
      marginBottom: 20,
    },
    categoriesTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    categories: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryTag: {
      backgroundColor: theme.colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.primary,
    },
  });

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  const renderContentItem = ({ item: contentItem, index }: { item: ContentItem; index: number }) => (
    <TouchableOpacity
      style={styles.contentItem}
      onPress={() => onContentPress(contentItem)}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={styles.contentThumbnail}>
        <Image
          source={{ uri: contentItem.thumbnailUrl }}
          style={styles.thumbnailImage}
        />
        
        {/* Thumbnail Overlay */}
        <View style={styles.thumbnailOverlay}>
          <Text style={styles.playIcon}>
            {contentItem.type === 'VIDEO' ? '▶' : '🎵'}
          </Text>
        </View>
        
        {/* Type Badge */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {contentItem.type === 'VIDEO' ? 'VIDEO' : 'AUDIO'}
          </Text>
        </View>
        
        {/* Premium Badge */}
        {contentItem.isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumIcon}>👑</Text>
          </View>
        )}
        
        {/* Duration */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(contentItem.duration)}
          </Text>
        </View>
      </View>

      {/* Content Info */}
      <View style={styles.contentInfo}>
        <View style={styles.contentTop}>
          <Text style={styles.contentTitle} numberOfLines={2}>
            {contentItem.title}
          </Text>
          
          {contentItem.description && (
            <Text style={styles.contentDescription} numberOfLines={2}>
              {contentItem.description}
            </Text>
          )}
        </View>

        <View style={styles.contentBottom}>
          {/* Creator Info */}
          <TouchableOpacity
            style={styles.creatorInfo}
            onPress={() => onCreatorPress(contentItem.creator.id)}
          >
            <Image
              source={{ uri: contentItem.creator.avatarUrl }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creatorName} numberOfLines={1}>
              {contentItem.creator.displayName}
            </Text>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.contentStats}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👁</Text>
              <Text style={styles.statText}>
                {formatNumber(contentItem.viewsCount)}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>❤️</Text>
              <Text style={styles.statText}>
                {formatNumber(contentItem.likesCount)}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>📅</Text>
              <Text style={styles.statText}>
                {formatTimeAgo(contentItem.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getUniqueCategories = () => {
    const categories = content.map(item => item.category);
    const uniqueCategories = categories.filter(
      (category, index, self) => 
        index === self.findIndex(c => c.id === category.id)
    );
    return uniqueCategories.slice(0, 5); // Show max 5 categories
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading related content...</Text>
      </View>
    );
  }

  if (!content || content.length === 0) {
    return (
      <EmptyState
        title="No related content"
        message="We couldn't find any related content at the moment. Check back later!"
        actionText="Browse All"
        onAction={() => {
          // Navigate to browse all content
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Related Content</Text>
        <Text style={styles.subtitle}>
          {content.length} {content.length === 1 ? 'item' : 'items'} • Based on your interests
        </Text>
      </View>

      {/* Categories Section */}
      {content.length > 0 && (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesTitle}>Categories</Text>
          <View style={styles.categories}>
            {getUniqueCategories().map((category) => (
              <View key={category.id} style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{category.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Content List */}
      <FlatList
        data={content}
        renderItem={renderContentItem}
        keyExtractor={(item) => item.id}
        style={styles.contentList}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={10}
        ListFooterComponent={
          content.length > 10 ? (
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>View More</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
};

export default RelatedContent;
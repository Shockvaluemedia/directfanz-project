import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentItem,
  FeedSection,
  DISCOVERY_CONSTANTS,
} from '../../types/discovery';

// Import common components
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const ITEM_WIDTH = screenWidth - 40; // 20px margin on each side
const GRID_ITEM_WIDTH = (screenWidth - 60) / 2; // For grid layout with 3 items per row

interface ContentFeedScreenProps {}

const ContentFeedScreen: React.FC<ContentFeedScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    feed,
    feedLoading,
    feedError,
    feedRefreshing,
    fetchFeed,
    loadMoreFeed,
    followCreator,
    unfollowCreator,
    interactWithContent,
    isCreatorFollowed,
    isContentLiked,
    isContentBookmarked,
    loadCategories,
    activeTab,
    gridView,
  } = useDiscovery();

  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    headerButton: {
      padding: 8,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary + '20',
    },
    headerButtonText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    tabsContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.large,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    tabTextActive: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    feedContainer: {
      flex: 1,
    },
    sectionContainer: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    sectionAction: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.small,
    },
    sectionActionText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    sectionContent: {
      paddingVertical: 8,
    },
    horizontalList: {
      paddingHorizontal: 16,
    },
    gridList: {
      paddingHorizontal: 20,
    },
    
    // Content Item Styles (List View)
    contentItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      marginHorizontal: 4,
      marginVertical: 6,
      overflow: 'hidden',
      width: ITEM_WIDTH,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    contentItemGrid: {
      width: GRID_ITEM_WIDTH,
      marginHorizontal: 5,
      marginVertical: 8,
    },
    contentImage: {
      width: '100%',
      height: 120,
      backgroundColor: theme.colors.border,
    },
    contentImageGrid: {
      height: 100,
    },
    contentOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      gap: 4,
    },
    overlayBadge: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
    },
    overlayText: {
      color: 'white',
      fontSize: 10,
      fontWeight: '600',
    },
    contentInfo: {
      padding: 12,
    },
    contentInfoGrid: {
      padding: 8,
    },
    contentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      lineHeight: 20,
    },
    contentTitleGrid: {
      fontSize: 14,
    },
    contentDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      lineHeight: 18,
    },
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    creatorAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
      marginRight: 8,
    },
    creatorName: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: '500',
      flex: 1,
    },
    verifiedIcon: {
      marginLeft: 4,
    },
    followButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary,
    },
    followButtonFollowing: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    followButtonText: {
      fontSize: 10,
      color: 'white',
      fontWeight: '600',
    },
    followButtonTextFollowing: {
      color: theme.colors.primary,
    },
    contentStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    statIcon: {
      marginRight: 4,
    },
    statText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    contentPricing: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    priceTag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
      marginRight: 8,
    },
    priceText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    freeTag: {
      backgroundColor: theme.colors.success + '20',
    },
    freeText: {
      color: theme.colors.success,
    },
    contentActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      padding: 6,
      borderRadius: theme.borderRadius.small,
      backgroundColor: 'transparent',
    },
    actionButtonActive: {
      backgroundColor: theme.colors.primary + '20',
    },
    playButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.medium,
    },
    playButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    
    // Loading and Error States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.medium,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    loadMoreContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
  });

  // Load initial data
  useEffect(() => {
    if (!feed) {
      fetchFeed();
      loadCategories();
    }
  }, [feed, fetchFeed, loadCategories]);

  // Refresh feed when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'home') {
        // Auto-refresh if data is stale (older than threshold)
        const shouldRefresh = !feed || 
          (feed.lastUpdated && 
           Date.now() - new Date(feed.lastUpdated).getTime() > DISCOVERY_CONSTANTS.FEED_REFRESH_THRESHOLD);
        
        if (shouldRefresh) {
          handleRefresh();
        }
      }
    }, [activeTab, feed])
  );

  const handleRefresh = useCallback(async () => {
    try {
      await fetchFeed(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh feed. Please try again.');
    }
  }, [fetchFeed]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !feed?.hasMore) return;
    
    setLoadingMore(true);
    try {
      await loadMoreFeed();
    } catch (error) {
      console.error('Failed to load more content:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, feed?.hasMore, loadMoreFeed]);

  const handleContentPress = useCallback((content: ContentItem) => {
    // Navigate to content detail screen
    navigation.navigate('ContentDetail' as never, { contentId: content.id } as never);
  }, [navigation]);

  const handleCreatorPress = useCallback((creator: any) => {
    // Navigate to creator profile
    navigation.navigate('CreatorProfile' as never, { creatorId: creator.id } as never);
  }, [navigation]);

  const handleFollowToggle = useCallback(async (creatorId: string) => {
    try {
      if (isCreatorFollowed(creatorId)) {
        await unfollowCreator(creatorId);
      } else {
        await followCreator(creatorId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  }, [isCreatorFollowed, followCreator, unfollowCreator]);

  const handleLikeToggle = useCallback(async (contentId: string) => {
    try {
      await interactWithContent({
        contentId,
        type: isContentLiked(contentId) ? 'unlike' : 'like',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  }, [isContentLiked, interactWithContent]);

  const handleBookmarkToggle = useCallback(async (contentId: string) => {
    try {
      await interactWithContent({
        contentId,
        type: isContentBookmarked(contentId) ? 'unbookmark' : 'bookmark',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update bookmark status. Please try again.');
    }
  }, [isContentBookmarked, interactWithContent]);

  const handleSectionAction = useCallback((sectionId: string) => {
    // Navigate to section-specific screen or load more content
    setSelectedSection(sectionId);
    // Could navigate to category screen or load more items
  }, []);

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

  const renderContentItem = useCallback(({ item }: { item: ContentItem }) => {
    const isLiked = isContentLiked(item.id);
    const isBookmarked = isContentBookmarked(item.id);
    const isFollowing = isCreatorFollowed(item.creator.id);
    const isGrid = gridView;

    return (
      <TouchableOpacity
        style={[styles.contentItem, isGrid && styles.contentItemGrid]}
        onPress={() => handleContentPress(item)}
        activeOpacity={0.7}
      >
        {/* Content Image/Thumbnail */}
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: item.thumbnailUrl || 'https://via.placeholder.com/300x200' }}
            style={[styles.contentImage, isGrid && styles.contentImageGrid]}
            resizeMode="cover"
          />
          
          {/* Overlay Badges */}
          <View style={styles.contentOverlay}>
            {item.isLive && (
              <View style={[styles.overlayBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.overlayText}>LIVE</Text>
              </View>
            )}
            {item.metadata.duration && (
              <View style={styles.overlayBadge}>
                <Text style={styles.overlayText}>{formatDuration(item.metadata.duration)}</Text>
              </View>
            )}
            {item.trending && (
              <View style={[styles.overlayBadge, { backgroundColor: theme.colors.warning }]}>
                <Text style={styles.overlayText}>🔥</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content Info */}
        <View style={[styles.contentInfo, isGrid && styles.contentInfoGrid]}>
          <Text
            style={[styles.contentTitle, isGrid && styles.contentTitleGrid]}
            numberOfLines={isGrid ? 2 : 2}
          >
            {item.title}
          </Text>

          {!isGrid && item.description && (
            <Text style={styles.contentDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Creator Info */}
          <View style={styles.creatorInfo}>
            <Image
              source={{ uri: item.creator.avatar || 'https://via.placeholder.com/40' }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creatorName} numberOfLines={1}>
              {item.creator.name}
            </Text>
            {item.creator.verified && (
              <Text style={[styles.verifiedIcon, { color: theme.colors.primary }]}>✓</Text>
            )}
            {!isGrid && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonFollowing]}
                onPress={() => handleFollowToggle(item.creator.id)}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextFollowing]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content Stats */}
          {!isGrid && (
            <View style={styles.contentStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statIcon, { color: theme.colors.textSecondary }]}>👁</Text>
                <Text style={styles.statText}>{formatNumber(item.stats.views)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statIcon, { color: theme.colors.error }]}>❤️</Text>
                <Text style={styles.statText}>{formatNumber(item.stats.likes)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statIcon, { color: theme.colors.warning }]}>⭐</Text>
                <Text style={styles.statText}>{item.stats.rating.average.toFixed(1)}</Text>
              </View>
            </View>
          )}

          {/* Pricing */}
          {!isGrid && (
            <View style={styles.contentPricing}>
              <View style={[styles.priceTag, item.pricing.type === 'free' && styles.freeTag]}>
                <Text style={[styles.priceText, item.pricing.type === 'free' && styles.freeText]}>
                  {item.pricing.type === 'free' 
                    ? 'FREE' 
                    : `$${item.pricing.amount?.toFixed(2)}`
                  }
                </Text>
              </View>
              {item.pricing.originalPrice && item.pricing.originalPrice > (item.pricing.amount || 0) && (
                <Text style={[styles.statText, { textDecorationLine: 'line-through' }]}>
                  ${item.pricing.originalPrice.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          {!isGrid && (
            <View style={styles.contentActions}>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, isLiked && styles.actionButtonActive]}
                  onPress={() => handleLikeToggle(item.id)}
                >
                  <Text style={{ color: isLiked ? theme.colors.primary : theme.colors.textSecondary }}>
                    {isLiked ? '❤️' : '🤍'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, isBookmarked && styles.actionButtonActive]}
                  onPress={() => handleBookmarkToggle(item.id)}
                >
                  <Text style={{ color: isBookmarked ? theme.colors.primary : theme.colors.textSecondary }}>
                    {isBookmarked ? '🔖' : '📑'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Text style={{ color: theme.colors.textSecondary }}>↗️</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.playButton}
                onPress={() => handleContentPress(item)}
              >
                <Text style={styles.playButtonText}>
                  {item.type === 'AUDIO' ? '🎵 Play' : '▶️ Watch'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [
    gridView,
    isContentLiked,
    isContentBookmarked,
    isCreatorFollowed,
    handleContentPress,
    handleFollowToggle,
    handleLikeToggle,
    handleBookmarkToggle,
    formatNumber,
    formatDuration,
    theme,
    styles,
  ]);

  const renderSectionHeader = useCallback(({ section }: { section: FeedSection }) => (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.description && (
          <Text style={styles.sectionSubtitle}>{section.description}</Text>
        )}
      </View>
      {section.hasMore && (
        <TouchableOpacity
          style={styles.sectionAction}
          onPress={() => handleSectionAction(section.id)}
        >
          <Text style={styles.sectionActionText}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [handleSectionAction, styles]);

  const renderSection = useCallback(({ item: section }: { item: FeedSection }) => (
    <View style={styles.sectionContainer} key={section.id}>
      {renderSectionHeader({ section })}
      <View style={styles.sectionContent}>
        <FlatList
          data={section.items}
          renderItem={renderContentItem}
          keyExtractor={(item) => item.id}
          horizontal={!gridView}
          numColumns={gridView ? 2 : undefined}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={gridView ? styles.gridList : styles.horizontalList}
          ItemSeparatorComponent={() => <View style={{ width: gridView ? 0 : 8 }} />}
        />
      </View>
    </View>
  ), [gridView, renderContentItem, renderSectionHeader, styles]);

  const renderLoadMoreFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadMoreText}>Loading more content...</Text>
      </View>
    );
  }, [loadingMore, theme.colors.primary, styles]);

  const handleEndReached = useCallback(() => {
    if (feed?.hasMore && !loadingMore) {
      handleLoadMore();
    }
  }, [feed?.hasMore, loadingMore, handleLoadMore]);

  // Loading state
  if (feedLoading && !feed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadMoreText}>Loading your personalized feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (feedError && !feed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{feedError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!feed?.sections?.length) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="🎵"
          title="No Content Yet"
          description="Follow some creators or check back later for personalized recommendations."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Discover</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <Text style={styles.headerButtonText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Categories' as never)}
            >
              <Text style={styles.headerButtonText}>📂</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          {(['trending', 'recommended', 'new', 'following'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedSection === tab && styles.tabActive]}
              onPress={() => setSelectedSection(selectedSection === tab ? null : tab)}
            >
              <Text style={[styles.tabText, selectedSection === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Feed Content */}
      <FlatList
        ref={flatListRef}
        data={feed.sections}
        renderItem={renderSection}
        keyExtractor={(section) => section.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feedRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={DISCOVERY_CONSTANTS.INFINITE_SCROLL_THRESHOLD}
        ListFooterComponent={renderLoadMoreFooter}
        contentContainerStyle={{ paddingBottom: 20 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={5}
        windowSize={10}
      />
    </SafeAreaView>
  );
};

export default ContentFeedScreen;
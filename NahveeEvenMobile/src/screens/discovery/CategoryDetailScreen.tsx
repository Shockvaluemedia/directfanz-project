import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentCategory,
  ContentItem,
  ContentType,
  SortOption,
  SearchFilters,
} from '../../types/discovery';
import ContentCard from '../../components/discovery/ContentCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth } = Dimensions.get('window');

interface CategoryDetailScreenProps {
  route: RouteProp<{ params: { categoryId: string; categoryName: string } }>;
}

const CategoryDetailScreen: React.FC<CategoryDetailScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { categoryId, categoryName } = route.params as { categoryId: string; categoryName: string };
  
  const {
    categories,
    getCategoryContent,
    getCategoryById,
    loadMoreCategoryContent,
  } = useDiscovery();

  const [category, setCategory] = useState<ContentCategory | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreContent, setHasMoreContent] = useState(true);
  
  // Filters and Sorting
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 200;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    
    // Animated Header
    animatedHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      backgroundColor: theme.colors.background,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: 10,
      zIndex: 1000,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginHorizontal: 16,
    },
    
    // Category Header
    categoryHeader: {
      height: headerHeight,
      position: 'relative',
      backgroundColor: theme.colors.surface,
    },
    categoryImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    categoryOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '70%',
      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
      justifyContent: 'flex-end',
      padding: 20,
    },
    categoryIcon: {
      fontSize: 40,
      marginBottom: 8,
    },
    categoryName: {
      fontSize: 28,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 8,
    },
    categoryDescription: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.9)',
      lineHeight: 22,
      marginBottom: 12,
    },
    categoryStats: {
      flexDirection: 'row',
      gap: 20,
    },
    categoryStatItem: {
      alignItems: 'center',
    },
    categoryStatValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
    },
    categoryStatLabel: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    
    // Controls Section
    controlsSection: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    controlsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    resultCount: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginRight: 16,
    },
    
    // Sort and Filter Controls
    controlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      marginRight: 8,
    },
    controlButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    controlButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      marginLeft: 4,
    },
    controlButtonTextActive: {
      color: 'white',
    },
    
    // Content Type Filters
    contentTypeFilters: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    contentTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.large,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contentTypeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    contentTypeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    contentTypeChipTextActive: {
      color: 'white',
    },
    
    // Layout Toggle
    layoutToggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    layoutButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
    },
    layoutButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    layoutButtonText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    layoutButtonTextActive: {
      color: 'white',
    },
    
    // Content List
    contentContainer: {
      flex: 1,
    },
    contentList: {
      paddingHorizontal: layout === 'grid' ? 10 : 20,
      paddingTop: 16,
    },
    gridItem: {
      width: (screenWidth - 30) / 2,
      marginHorizontal: 5,
      marginBottom: 16,
    },
    listItem: {
      marginBottom: 16,
    },
    
    // Loading States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
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
    
    // Load More
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

  // Load category and content
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get category info
        const categoryData = await getCategoryById(categoryId);
        setCategory(categoryData);

        // Load initial content
        const contentData = await getCategoryContent(categoryId, {
          limit: 20,
          sortBy,
          contentTypes: contentTypeFilter === 'all' ? undefined : [contentTypeFilter],
        });

        setContent(contentData.items);
        setHasMoreContent(contentData.hasMore);

      } catch (err) {
        console.error('Failed to load category content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categoryId, getCategoryById, getCategoryContent, sortBy, contentTypeFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [categoryData, contentData] = await Promise.all([
        getCategoryById(categoryId),
        getCategoryContent(categoryId, {
          limit: 20,
          sortBy,
          contentTypes: contentTypeFilter === 'all' ? undefined : [contentTypeFilter],
        }),
      ]);

      setCategory(categoryData);
      setContent(contentData.items);
      setHasMoreContent(contentData.hasMore);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [categoryId, getCategoryById, getCategoryContent, sortBy, contentTypeFilter]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMoreContent) return;
    
    setLoadingMore(true);
    try {
      const contentData = await loadMoreCategoryContent(categoryId, content.length);
      setContent(prev => [...prev, ...contentData.items]);
      setHasMoreContent(contentData.hasMore);
    } catch (error) {
      console.error('Failed to load more content:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreContent, categoryId, content.length, loadMoreCategoryContent]);

  const handleContentPress = useCallback((content: ContentItem) => {
    navigation.navigate('ContentDetail' as never, { contentId: content.id } as never);
  }, [navigation]);

  const handleCreatorPress = useCallback((creatorId: string) => {
    navigation.navigate('CreatorProfile' as never, { creatorId } as never);
  }, [navigation]);

  const formatNumber = useCallback((num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }, []);

  // Animated header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderContentItem = useCallback(({ item }: { item: ContentItem }) => (
    <View style={layout === 'grid' ? styles.gridItem : styles.listItem}>
      <ContentCard
        content={item}
        layout={layout === 'grid' ? 'grid' : 'vertical'}
        size="medium"
        onPress={handleContentPress}
        onCreatorPress={handleCreatorPress}
      />
    </View>
  ), [layout, handleContentPress, handleCreatorPress, styles]);

  const renderLoadMoreFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <LoadingSpinner size="small" />
        <Text style={styles.loadMoreText}>Loading more content...</Text>
      </View>
    );
  }, [loadingMore, styles]);

  // Sort options
  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'popular', label: 'Popular' },
    { value: 'newest', label: 'Newest' },
    { value: 'trending', label: 'Trending' },
    { value: 'rating', label: 'Top Rated' },
  ];

  // Content type filters
  const contentTypes: Array<{ value: ContentType | 'all'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '🎯' },
    { value: 'AUDIO', label: 'Music', icon: '🎵' },
    { value: 'VIDEO', label: 'Video', icon: '🎬' },
    { value: 'IMAGE', label: 'Photos', icon: '📷' },
    { value: 'TEXT', label: 'Text', icon: '📝' },
    { value: 'LIVE', label: 'Live', icon: '🔴' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadMoreText}>Loading {categoryName}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 18, color: theme.colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {category?.name || categoryName}
        </Text>
        <View style={styles.headerButton} />
      </Animated.View>

      <Animated.FlatList
        data={content}
        renderItem={renderContentItem}
        keyExtractor={(item) => item.id}
        numColumns={layout === 'grid' ? 2 : 1}
        key={layout} // Force re-render when layout changes
        contentContainerStyle={styles.contentList}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderLoadMoreFooter}
        ListHeaderComponent={
          <View>
            {/* Category Header */}
            <View style={styles.categoryHeader}>
              <Image
                source={{ uri: category?.thumbnailUrl }}
                style={styles.categoryImage}
              />
              <View style={styles.categoryOverlay}>
                <Text style={styles.categoryIcon}>{category?.icon}</Text>
                <Text style={styles.categoryName}>
                  {category?.name || categoryName}
                </Text>
                <Text style={styles.categoryDescription} numberOfLines={3}>
                  {category?.description}
                </Text>
                <View style={styles.categoryStats}>
                  <View style={styles.categoryStatItem}>
                    <Text style={styles.categoryStatValue}>
                      {formatNumber(category?.contentCount || 0)}
                    </Text>
                    <Text style={styles.categoryStatLabel}>Content</Text>
                  </View>
                  <View style={styles.categoryStatItem}>
                    <Text style={styles.categoryStatValue}>
                      {formatNumber(category?.creatorCount || 0)}
                    </Text>
                    <Text style={styles.categoryStatLabel}>Creators</Text>
                  </View>
                  <View style={styles.categoryStatItem}>
                    <Text style={styles.categoryStatValue}>
                      {formatNumber(category?.followersCount || 0)}
                    </Text>
                    <Text style={styles.categoryStatLabel}>Followers</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Controls Section */}
            <View style={styles.controlsSection}>
              {/* Top Row - Stats and Layout */}
              <View style={styles.controlsRow}>
                <View style={styles.controlsLeft}>
                  <Text style={styles.resultCount}>
                    {formatNumber(content.length)} results
                  </Text>
                </View>
                
                <View style={styles.layoutToggle}>
                  <TouchableOpacity
                    style={[
                      styles.layoutButton,
                      layout === 'grid' && styles.layoutButtonActive,
                    ]}
                    onPress={() => setLayout('grid')}
                  >
                    <Text style={[
                      styles.layoutButtonText,
                      layout === 'grid' && styles.layoutButtonTextActive,
                    ]}>
                      ▦
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.layoutButton,
                      layout === 'list' && styles.layoutButtonActive,
                    ]}
                    onPress={() => setLayout('list')}
                  >
                    <Text style={[
                      styles.layoutButtonText,
                      layout === 'list' && styles.layoutButtonTextActive,
                    ]}>
                      ☰
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Content Type Filters */}
              <View style={styles.contentTypeFilters}>
                {contentTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.contentTypeChip,
                      contentTypeFilter === type.value && styles.contentTypeChipActive,
                    ]}
                    onPress={() => setContentTypeFilter(type.value)}
                  >
                    <Text style={[
                      styles.contentTypeChipText,
                      contentTypeFilter === type.value && styles.contentTypeChipTextActive,
                    ]}>
                      {type.icon} {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort Options */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.controlButton,
                      sortBy === option.value && styles.controlButtonActive,
                    ]}
                    onPress={() => setSortBy(option.value)}
                  >
                    <Text style={[
                      styles.controlButtonText,
                      sortBy === option.value && styles.controlButtonTextActive,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="🔍"
              title="No Content Found"
              description={`No ${contentTypeFilter === 'all' ? '' : contentTypes.find(t => t.value === contentTypeFilter)?.label.toLowerCase() + ' '}content available in this category.`}
            />
          )
        }
      />
    </View>
  );
};

export default CategoryDetailScreen;